import {
  ACHIEVEMENT_CATALOG,
  getLevelProgress,
  getUnlockedCosmeticsForLevel,
  type AchievementStatusDto,
  type GamificationSummaryDto,
} from "@ember/shared";
import { and, count, desc, eq, inArray, sql } from "drizzle-orm";
import { getDb, type EmberDatabase } from "./client";
import {
  achievements,
  focusSessions,
  habitEntries,
  userAchievements,
  userProgress,
  xpEvents,
} from "./schema";

export type DbExecutor = Pick<
  EmberDatabase,
  "select" | "insert" | "update" | "delete" | "execute"
>;

export async function ensureAchievementsCatalog(db: DbExecutor): Promise<void> {
  if (ACHIEVEMENT_CATALOG.length === 0) return;

  await db
    .insert(achievements)
    .values(
      ACHIEVEMENT_CATALOG.map((item) => ({
        code: item.code,
        title: item.title,
        description: item.description,
        icon: item.icon,
        xpReward: item.xpReward,
        category: item.category,
        threshold: item.threshold,
      }))
    )
    .onConflictDoNothing({ target: achievements.code });
}

export async function ensureUserProgressRow(
  db: DbExecutor,
  userId: string
): Promise<void> {
  await db
    .insert(userProgress)
    .values({
      userId,
      totalXp: 0,
      level: 1,
      currentFocusStreakDays: 0,
      bestFocusStreakDays: 0,
      unlockedCosmetics: ["classic-flame"],
    })
    .onConflictDoNothing({ target: userProgress.userId });
}

export async function awardXpIdempotently(
  db: DbExecutor,
  params: {
    userId: string;
    eventType: string;
    xpDelta: number;
    idempotencyKey: string;
    metadata?: Record<string, unknown>;
  }
): Promise<boolean> {
  if (params.xpDelta <= 0) {
    return false;
  }

  const inserted = await db
    .insert(xpEvents)
    .values({
      userId: params.userId,
      eventType: params.eventType,
      xpDelta: params.xpDelta,
      idempotencyKey: params.idempotencyKey,
      metadata: params.metadata ?? null,
    })
    .onConflictDoNothing({
      target: [xpEvents.userId, xpEvents.idempotencyKey],
    })
    .returning({ id: xpEvents.id });

  return inserted.length > 0;
}

export async function removeXpEventByKey(
  db: DbExecutor,
  userId: string,
  idempotencyKey: string
): Promise<void> {
  await db
    .delete(xpEvents)
    .where(
      and(
        eq(xpEvents.userId, userId),
        eq(xpEvents.idempotencyKey, idempotencyKey)
      )
    );
}

/**
 * Recomputes user XP, level, cosmetics, and evaluates achievement unlocks inside the caller's transaction.
 */
export async function syncUserProgressAndAchievements(
  tx: DbExecutor,
  params: {
    userId: string;
    maxHabitStreak?: number;
    dailyGoalMetDate?: string | null;
  }
): Promise<{
  totalXp: number;
  level: number;
  newlyUnlockedAchievements: string[];
}> {
  await ensureAchievementsCatalog(tx);
  await ensureUserProgressRow(tx, params.userId);

  const [focusAgg] = await tx
    .select({
      completedCount: count(),
      totalSeconds: sql<number>`coalesce(sum(${focusSessions.accumulatedSeconds}), 0)`,
    })
    .from(focusSessions)
    .where(
      and(
        eq(focusSessions.userId, params.userId),
        eq(focusSessions.status, "completed"),
        inArray(focusSessions.mode, ["pomodoro", "custom", "stopwatch"])
      )
    );

  const [habitAgg] = await tx
    .select({
      completedCount: count(),
    })
    .from(habitEntries)
    .where(
      and(
        eq(habitEntries.userId, params.userId),
        eq(habitEntries.status, "completed")
      )
    );

  const [progressRow] = await tx
    .select()
    .from(userProgress)
    .where(eq(userProgress.userId, params.userId))
    .limit(1);

  const [xpSumRow] = await tx
    .select({
      total: sql<number>`coalesce(sum(${xpEvents.xpDelta}), 0)`,
    })
    .from(xpEvents)
    .where(eq(xpEvents.userId, params.userId));

  let currentTotalXp = Number(xpSumRow?.total ?? 0);
  let levelInfo = getLevelProgress(currentTotalXp);

  const completedFocusCount = Number(focusAgg?.completedCount ?? 0);
  const completedFocusMinutes = Math.floor(Number(focusAgg?.totalSeconds ?? 0) / 60);
  const completedHabitsCount = Number(habitAgg?.completedCount ?? 0);
  const bestStreak = Math.max(
    progressRow?.bestFocusStreakDays ?? 0,
    params.maxHabitStreak ?? 0
  );

  const candidateCodes: string[] = [];
  if (completedFocusCount >= 1) candidateCodes.push("first_focus");
  if (completedFocusMinutes >= 60) candidateCodes.push("hour_of_focus");
  if (completedFocusMinutes >= 300) candidateCodes.push("deep_five_hours");
  if (completedHabitsCount >= 1) candidateCodes.push("habit_starter");
  if (bestStreak >= 7) candidateCodes.push("habit_week_streak");
  if (params.dailyGoalMetDate) candidateCodes.push("daily_goal_hit");
  if (levelInfo.level >= 2) candidateCodes.push("level_2");
  if (levelInfo.level >= 5) candidateCodes.push("level_5");

  const newlyUnlockedAchievements: string[] = [];
  for (const code of candidateCodes) {
    const def = ACHIEVEMENT_CATALOG.find((a) => a.code === code);
    if (!def) continue;

    const inserted = await tx
      .insert(userAchievements)
      .values({
        userId: params.userId,
        achievementCode: code,
      })
      .onConflictDoNothing({
        target: [userAchievements.userId, userAchievements.achievementCode],
      })
      .returning({ id: userAchievements.id });

    if (inserted.length > 0) {
      newlyUnlockedAchievements.push(code);
      await awardXpIdempotently(tx, {
        userId: params.userId,
        eventType: "achievement_unlocked",
        xpDelta: def.xpReward,
        idempotencyKey: `achievement:${code}`,
        metadata: { achievementCode: code, title: def.title },
      });
    }
  }

  if (newlyUnlockedAchievements.length > 0) {
    const [updatedXpRow] = await tx
      .select({
        total: sql<number>`coalesce(sum(${xpEvents.xpDelta}), 0)`,
      })
      .from(xpEvents)
      .where(eq(xpEvents.userId, params.userId));
    currentTotalXp = Number(updatedXpRow?.total ?? currentTotalXp);
    levelInfo = getLevelProgress(currentTotalXp);
  }

  const unlockedCosmetics = getUnlockedCosmeticsForLevel(levelInfo.level);

  await tx
    .update(userProgress)
    .set({
      totalXp: currentTotalXp,
      level: levelInfo.level,
      unlockedCosmetics,
      updatedAt: new Date(),
    })
    .where(eq(userProgress.userId, params.userId));

  return {
    totalXp: currentTotalXp,
    level: levelInfo.level,
    newlyUnlockedAchievements,
  };
}

export async function getGamificationSummaryForUser(
  userId: string,
  dbOverride?: EmberDatabase
): Promise<GamificationSummaryDto> {
  const db = dbOverride ?? getDb();
  await ensureAchievementsCatalog(db);
  await ensureUserProgressRow(db, userId);

  const [progressRow] = await db
    .select()
    .from(userProgress)
    .where(eq(userProgress.userId, userId))
    .limit(1);

  const unlockedRows = await db
    .select()
    .from(userAchievements)
    .where(eq(userAchievements.userId, userId));

  const recentEvents = await db
    .select()
    .from(xpEvents)
    .where(eq(xpEvents.userId, userId))
    .orderBy(desc(xpEvents.createdAt))
    .limit(15);

  const totalXp = progressRow?.totalXp ?? 0;
  const levelSummary = getLevelProgress(totalXp);
  const unlockedMap = new Map(
    unlockedRows.map((row) => [row.achievementCode, row.unlockedAt.toISOString()])
  );

  const achievementStatuses: AchievementStatusDto[] = ACHIEVEMENT_CATALOG.map((def) => {
    const unlockedAt = unlockedMap.get(def.code) ?? null;
    return {
      code: def.code,
      title: def.title,
      description: def.description,
      icon: def.icon,
      xpReward: def.xpReward,
      category: def.category,
      unlocked: unlockedAt !== null,
      unlockedAt,
    };
  });

  return {
    totalXp: levelSummary.totalXp,
    level: levelSummary.level,
    xpIntoLevel: levelSummary.xpIntoLevel,
    xpToNextLevel: levelSummary.xpToNextLevel,
    progressPercent: levelSummary.progressPercent,
    currentFocusStreakDays: progressRow?.currentFocusStreakDays ?? 0,
    bestFocusStreakDays: progressRow?.bestFocusStreakDays ?? 0,
    unlockedCosmetics: progressRow?.unlockedCosmetics ?? ["classic-flame"],
    recentXpEvents: recentEvents.map((evt) => ({
      id: evt.id,
      eventType: evt.eventType,
      xpDelta: evt.xpDelta,
      metadata: evt.metadata ?? null,
      createdAt: evt.createdAt.toISOString(),
    })),
    achievements: achievementStatuses,
  };
}
