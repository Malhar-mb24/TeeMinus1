import {
  addDaysToDateKey,
  calculateSessionXp,
  getLocalDateKey,
  startFocusSessionSchema,
  updateFocusSessionSchema,
  type FocusMode,
  type FocusSessionDto,
  type FocusSessionStatus,
  type StartFocusSessionInput,
  type UpdateFocusSessionInput,
} from "@ember/shared";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { getDb, type EmberDatabase } from "./client";
import {
  awardXpIdempotently,
  ensureUserProgressRow,
  syncUserProgressAndAchievements,
} from "./gamification";
import {
  focusSessions,
  goals,
  tasks,
  userPreferences,
  userProgress,
  type DbFocusSession,
} from "./schema";

function mapFocusSessionDto(
  row: DbFocusSession,
  taskTitle: string | null = null
): FocusSessionDto {
  return {
    id: row.id,
    userId: row.userId,
    taskId: row.taskId,
    taskTitle,
    mode: row.mode as FocusMode,
    status: row.status as FocusSessionStatus,
    plannedDurationSeconds: row.plannedDurationSeconds,
    startedAt: row.startedAt.toISOString(),
    lastResumedAt: row.lastResumedAt ? row.lastResumedAt.toISOString() : null,
    accumulatedSeconds: row.accumulatedSeconds,
    endedAt: row.endedAt ? row.endedAt.toISOString() : null,
    localDate: row.localDate,
    label: row.label,
    notes: row.notes,
    soundscape: row.soundscape,
    xpEarned: row.xpEarned,
    createdAt: row.createdAt.toISOString(),
  };
}

export function computeElapsedSessionSeconds(
  session: Pick<DbFocusSession, "status" | "accumulatedSeconds" | "lastResumedAt">,
  now: Date = new Date()
): number {
  if (session.status !== "running" || !session.lastResumedAt) {
    return session.accumulatedSeconds;
  }
  const deltaSeconds = Math.max(
    0,
    Math.floor((now.getTime() - session.lastResumedAt.getTime()) / 1000)
  );
  return session.accumulatedSeconds + deltaSeconds;
}

export async function getActiveFocusSessionForUser(
  userId: string,
  dbOverride?: EmberDatabase
): Promise<FocusSessionDto | null> {
  const db = dbOverride ?? getDb();
  const [row] = await db
    .select({
      session: focusSessions,
      taskTitle: tasks.title,
    })
    .from(focusSessions)
    .leftJoin(tasks, eq(focusSessions.taskId, tasks.id))
    .where(
      and(
        eq(focusSessions.userId, userId),
        inArray(focusSessions.status, ["running", "paused"])
      )
    )
    .orderBy(desc(focusSessions.startedAt))
    .limit(1);

  if (!row) {
    return null;
  }

  return mapFocusSessionDto(row.session, row.taskTitle ?? null);
}

export async function listFocusSessionsForUser(
  userId: string,
  options?: { limit?: number; localDate?: string },
  dbOverride?: EmberDatabase
): Promise<FocusSessionDto[]> {
  const db = dbOverride ?? getDb();
  const limit = Math.min(100, Math.max(1, options?.limit ?? 25));

  const conditions = [eq(focusSessions.userId, userId)];
  if (options?.localDate) {
    conditions.push(eq(focusSessions.localDate, options.localDate));
  }

  const rows = await db
    .select({
      session: focusSessions,
      taskTitle: tasks.title,
    })
    .from(focusSessions)
    .leftJoin(tasks, eq(focusSessions.taskId, tasks.id))
    .where(and(...conditions))
    .orderBy(desc(focusSessions.startedAt))
    .limit(limit);

  return rows.map((row) => mapFocusSessionDto(row.session, row.taskTitle ?? null));
}

export async function startFocusSessionForUser(
  userId: string,
  timezone: string,
  rawInput: StartFocusSessionInput,
  dbOverride?: EmberDatabase
): Promise<{ session: FocusSessionDto; conflict: boolean }> {
  const input = startFocusSessionSchema.parse(rawInput);
  const db = dbOverride ?? getDb();
  const now = new Date();
  const localDate = getLocalDateKey(now, timezone);

  return db.transaction(async (tx) => {
    const [existingActive] = await tx
      .select({
        session: focusSessions,
        taskTitle: tasks.title,
      })
      .from(focusSessions)
      .leftJoin(tasks, eq(focusSessions.taskId, tasks.id))
      .where(
        and(
          eq(focusSessions.userId, userId),
          inArray(focusSessions.status, ["running", "paused"])
        )
      )
      .limit(1);

    if (existingActive) {
      return {
        session: mapFocusSessionDto(
          existingActive.session,
          existingActive.taskTitle ?? null
        ),
        conflict: true,
      };
    }

    let verifiedTaskTitle: string | null = null;
    if (input.taskId) {
      const [taskRow] = await tx
        .select({ id: tasks.id, title: tasks.title })
        .from(tasks)
        .where(and(eq(tasks.id, input.taskId), eq(tasks.userId, userId)))
        .limit(1);

      if (!taskRow) {
        throw new Error("Referenced task does not belong to user");
      }
      verifiedTaskTitle = taskRow.title;
    }

    const plannedSeconds =
      input.mode === "stopwatch" ? null : (input.plannedDurationSeconds ?? 1500);

    const [created] = await tx
      .insert(focusSessions)
      .values({
        userId,
        taskId: input.taskId ?? null,
        mode: input.mode,
        status: "running",
        plannedDurationSeconds: plannedSeconds,
        startedAt: now,
        lastResumedAt: now,
        accumulatedSeconds: 0,
        localDate,
        label: input.label ?? verifiedTaskTitle ?? null,
        soundscape: input.soundscape,
      })
      .returning();

    if (!created) {
      throw new Error("Unable to start focus session");
    }

    return {
      session: mapFocusSessionDto(created, verifiedTaskTitle),
      conflict: false,
    };
  });
}

export async function transitionFocusSessionForUser(
  userId: string,
  sessionId: string,
  timezone: string,
  rawInput: UpdateFocusSessionInput,
  dbOverride?: EmberDatabase
): Promise<{
  session: FocusSessionDto;
  xpAwarded: number;
  newlyUnlockedAchievements: string[];
} | null> {
  const input = updateFocusSessionSchema.parse(rawInput);
  const db = dbOverride ?? getDb();
  const now = new Date();

  return db.transaction(async (tx) => {
    const [existingRow] = await tx
      .select({
        session: focusSessions,
        taskTitle: tasks.title,
      })
      .from(focusSessions)
      .leftJoin(tasks, eq(focusSessions.taskId, tasks.id))
      .where(
        and(eq(focusSessions.id, sessionId), eq(focusSessions.userId, userId))
      )
      .limit(1);

    if (!existingRow) {
      return null;
    }

    const session = existingRow.session;

    if (input.action === "update_notes") {
      const [updated] = await tx
        .update(focusSessions)
        .set({
          ...(input.notes !== undefined ? { notes: input.notes } : {}),
          ...(input.label !== undefined ? { label: input.label } : {}),
          ...(input.soundscape !== undefined ? { soundscape: input.soundscape } : {}),
          updatedAt: now,
        })
        .where(and(eq(focusSessions.id, session.id), eq(focusSessions.userId, userId)))
        .returning();

      return {
        session: mapFocusSessionDto(updated!, existingRow.taskTitle ?? null),
        xpAwarded: 0,
        newlyUnlockedAchievements: [],
      };
    }

    // Idempotency guard: if already finalized, return existing terminal session cleanly.
    if (
      session.status === "completed" ||
      session.status === "interrupted" ||
      session.status === "cancelled"
    ) {
      return {
        session: mapFocusSessionDto(session, existingRow.taskTitle ?? null),
        xpAwarded: 0,
        newlyUnlockedAchievements: [],
      };
    }

    const currentAccumulated = computeElapsedSessionSeconds(session, now);

    if (input.action === "pause") {
      if (session.status !== "running") {
        return {
          session: mapFocusSessionDto(session, existingRow.taskTitle ?? null),
          xpAwarded: 0,
          newlyUnlockedAchievements: [],
        };
      }
      const [paused] = await tx
        .update(focusSessions)
        .set({
          status: "paused",
          accumulatedSeconds: currentAccumulated,
          lastResumedAt: null,
          updatedAt: now,
        })
        .where(and(eq(focusSessions.id, session.id), eq(focusSessions.userId, userId)))
        .returning();

      return {
        session: mapFocusSessionDto(paused!, existingRow.taskTitle ?? null),
        xpAwarded: 0,
        newlyUnlockedAchievements: [],
      };
    }

    if (input.action === "resume") {
      if (session.status !== "paused") {
        return {
          session: mapFocusSessionDto(session, existingRow.taskTitle ?? null),
          xpAwarded: 0,
          newlyUnlockedAchievements: [],
        };
      }
      const [resumed] = await tx
        .update(focusSessions)
        .set({
          status: "running",
          lastResumedAt: now,
          updatedAt: now,
        })
        .where(and(eq(focusSessions.id, session.id), eq(focusSessions.userId, userId)))
        .returning();

      return {
        session: mapFocusSessionDto(resumed!, existingRow.taskTitle ?? null),
        xpAwarded: 0,
        newlyUnlockedAchievements: [],
      };
    }

    // Terminal transitions: complete | interrupt | cancel
    const terminalStatus: "completed" | "interrupted" | "cancelled" =
      input.action === "complete"
        ? "completed"
        : input.action === "interrupt"
          ? "interrupted"
          : "cancelled";

    const boundedSeconds =
      session.plannedDurationSeconds !== null && terminalStatus === "completed"
        ? Math.min(currentAccumulated, session.plannedDurationSeconds + 300)
        : currentAccumulated;

    const sessionXp = calculateSessionXp({
      mode: session.mode as FocusMode,
      status: terminalStatus,
      actualSeconds: boundedSeconds,
    });

    const idempotencyKey =
      input.idempotencyKey ?? `session:${session.id}:finalize`;

    const [finalized] = await tx
      .update(focusSessions)
      .set({
        status: terminalStatus,
        accumulatedSeconds: boundedSeconds,
        lastResumedAt: null,
        endedAt: now,
        notes: input.notes !== undefined ? input.notes : session.notes,
        label: input.label !== undefined ? input.label : session.label,
        soundscape:
          input.soundscape !== undefined ? input.soundscape : session.soundscape,
        xpEarned: sessionXp,
        completionIdempotencyKey: idempotencyKey,
        updatedAt: now,
      })
      .where(
        and(
          eq(focusSessions.id, session.id),
          eq(focusSessions.userId, userId),
          inArray(focusSessions.status, ["running", "paused"])
        )
      )
      .returning();

    if (!finalized) {
      const [reread] = await tx
        .select()
        .from(focusSessions)
        .where(and(eq(focusSessions.id, session.id), eq(focusSessions.userId, userId)))
        .limit(1);
      return {
        session: mapFocusSessionDto(reread ?? session, existingRow.taskTitle ?? null),
        xpAwarded: 0,
        newlyUnlockedAchievements: [],
      };
    }

    let totalXpAwarded = 0;
    if (sessionXp > 0) {
      const granted = await awardXpIdempotently(tx, {
        userId,
        eventType: "focus_session_completed",
        xpDelta: sessionXp,
        idempotencyKey: `session:${session.id}`,
        metadata: {
          sessionId: session.id,
          mode: session.mode,
          status: terminalStatus,
          seconds: boundedSeconds,
        },
      });
      if (granted) {
        totalXpAwarded += sessionXp;
      }
    }

    // Update focus streak and check daily focus goal completion
    let dailyGoalMetDate: string | null = null;
    if (
      terminalStatus === "completed" &&
      (session.mode === "pomodoro" ||
        session.mode === "custom" ||
        session.mode === "stopwatch")
    ) {
      await ensureUserProgressRow(tx, userId);

      const sessionLocalDate = session.localDate || getLocalDateKey(now, timezone);

      const [progress] = await tx
        .select()
        .from(userProgress)
        .where(eq(userProgress.userId, userId))
        .limit(1);

      if (progress) {
        const lastDate = progress.lastQualifyingFocusDate;
        const yesterdayKey = addDaysToDateKey(sessionLocalDate, -1);
        let nextStreak = progress.currentFocusStreakDays;
        if (lastDate !== sessionLocalDate) {
          nextStreak = lastDate === yesterdayKey ? progress.currentFocusStreakDays + 1 : 1;
        }
        const nextBest = Math.max(progress.bestFocusStreakDays, nextStreak);
        await tx
          .update(userProgress)
          .set({
            currentFocusStreakDays: nextStreak,
            bestFocusStreakDays: nextBest,
            lastQualifyingFocusDate: sessionLocalDate,
            updatedAt: now,
          })
          .where(eq(userProgress.userId, userId));
      }

      const [prefs] = await tx
        .select({ dailyFocusGoalMinutes: userPreferences.dailyFocusGoalMinutes })
        .from(userPreferences)
        .where(eq(userPreferences.userId, userId))
        .limit(1);
      const dailyTarget = prefs?.dailyFocusGoalMinutes ?? 120;

      const [todayAgg] = await tx
        .select({
          totalSeconds: sql<number>`coalesce(sum(${focusSessions.accumulatedSeconds}), 0)`,
        })
        .from(focusSessions)
        .where(
          and(
            eq(focusSessions.userId, userId),
            eq(focusSessions.localDate, sessionLocalDate),
            eq(focusSessions.status, "completed"),
            inArray(focusSessions.mode, ["pomodoro", "custom", "stopwatch"])
          )
        );

      const totalMinutesToday = Math.floor(Number(todayAgg?.totalSeconds ?? 0) / 60);
      if (totalMinutesToday >= dailyTarget) {
        dailyGoalMetDate = sessionLocalDate;
        const goalBonusGranted = await awardXpIdempotently(tx, {
          userId,
          eventType: "daily_goal_completed",
          xpDelta: 50,
          idempotencyKey: `daily_goal:${sessionLocalDate}`,
          metadata: { localDate: sessionLocalDate, targetMinutes: dailyTarget },
        });
        if (goalBonusGranted) {
          totalXpAwarded += 50;
        }

        await tx
          .update(goals)
          .set({ completedAt: now, updatedAt: now })
          .where(
            and(
              eq(goals.userId, userId),
              eq(goals.periodType, "daily"),
              eq(goals.periodKey, sessionLocalDate)
            )
          );
      }
    }

    const syncResult = await syncUserProgressAndAchievements(tx, {
      userId,
      dailyGoalMetDate,
    });

    return {
      session: mapFocusSessionDto(finalized, existingRow.taskTitle ?? null),
      xpAwarded: totalXpAwarded,
      newlyUnlockedAchievements: syncResult.newlyUnlockedAchievements,
    };
  });
}
