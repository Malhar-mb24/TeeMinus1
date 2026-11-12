import {
  createTaskSchema,
  getIsoWeekKey,
  getLocalDateKey,
  updateTaskSchema,
  upsertGoalSchema,
  type CreateTaskInput,
  type GoalDto,
  type TaskDto,
  type TaskPriority,
  type TaskStatus,
  type UpdateTaskInput,
  type UpsertGoalInput,
} from "@ember/shared";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { getDb, type EmberDatabase } from "./client";
import type { DbExecutor } from "./gamification";
import { focusSessions, goals, tasks, userPreferences, type DbTask } from "./schema";

function mapTaskDto(row: DbTask, actualMinutes = 0): TaskDto {
  return {
    id: row.id,
    userId: row.userId,
    title: row.title,
    description: row.description,
    category: row.category,
    color: row.color,
    priority: row.priority as TaskPriority,
    status: row.status as TaskStatus,
    plannedMinutes: row.plannedMinutes,
    actualMinutes,
    scheduledDate: row.scheduledDate,
    plannedStartMinute: row.plannedStartMinute,
    completedAt: row.completedAt ? row.completedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listTasksForUser(
  userId: string,
  options?: { scheduledDate?: string; status?: TaskStatus },
  dbOverride?: EmberDatabase
): Promise<TaskDto[]> {
  const db = dbOverride ?? getDb();
  const conditions = [eq(tasks.userId, userId)];
  if (options?.scheduledDate) {
    conditions.push(eq(tasks.scheduledDate, options.scheduledDate));
  }
  if (options?.status) {
    conditions.push(eq(tasks.status, options.status));
  }

  const rows = await db
    .select()
    .from(tasks)
    .where(and(...conditions))
    .orderBy(desc(tasks.createdAt));

  if (rows.length === 0) {
    return [];
  }

  const taskIds = rows.map((r) => r.id);
  const durationRows = await db
    .select({
      taskId: focusSessions.taskId,
      totalSeconds: sql<number>`coalesce(sum(${focusSessions.accumulatedSeconds}), 0)`,
    })
    .from(focusSessions)
    .where(
      and(
        eq(focusSessions.userId, userId),
        inArray(focusSessions.taskId, taskIds),
        inArray(focusSessions.status, ["completed", "interrupted"])
      )
    )
    .groupBy(focusSessions.taskId);

  const actualMinutesByTask = new Map<string, number>();
  for (const row of durationRows) {
    if (row.taskId) {
      actualMinutesByTask.set(
        row.taskId,
        Math.round(Number(row.totalSeconds) / 60)
      );
    }
  }

  return rows.map((row) => mapTaskDto(row, actualMinutesByTask.get(row.id) ?? 0));
}

export async function createTaskForUser(
  userId: string,
  rawInput: CreateTaskInput,
  dbOverride?: EmberDatabase
): Promise<TaskDto> {
  const input = createTaskSchema.parse(rawInput);
  const db = dbOverride ?? getDb();

  const [created] = await db
    .insert(tasks)
    .values({
      userId,
      title: input.title,
      description: input.description ?? null,
      category: input.category,
      color: input.color,
      priority: input.priority,
      status: "todo",
      plannedMinutes: input.plannedMinutes,
      scheduledDate: input.scheduledDate ?? null,
      plannedStartMinute: input.plannedStartMinute ?? null,
    })
    .returning();

  if (!created) {
    throw new Error("Unable to create task");
  }

  return mapTaskDto(created, 0);
}

export async function updateTaskForUser(
  userId: string,
  taskId: string,
  rawInput: UpdateTaskInput,
  dbOverride?: EmberDatabase
): Promise<TaskDto | null> {
  const input = updateTaskSchema.parse(rawInput);
  const db = dbOverride ?? getDb();

  const patch: Partial<typeof tasks.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (input.title !== undefined) patch.title = input.title;
  if (input.description !== undefined) patch.description = input.description;
  if (input.category !== undefined) patch.category = input.category;
  if (input.color !== undefined) patch.color = input.color;
  if (input.priority !== undefined) patch.priority = input.priority;
  if (input.plannedMinutes !== undefined) patch.plannedMinutes = input.plannedMinutes;
  if (input.scheduledDate !== undefined) patch.scheduledDate = input.scheduledDate;
  if (input.plannedStartMinute !== undefined) {
    patch.plannedStartMinute = input.plannedStartMinute;
  }
  if (input.status !== undefined) {
    patch.status = input.status;
    patch.completedAt = input.status === "completed" ? new Date() : null;
  }

  const [updated] = await db
    .update(tasks)
    .set(patch)
    .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)))
    .returning();

  if (!updated) {
    return null;
  }

  return mapTaskDto(updated, 0);
}

export async function deleteTaskForUser(
  userId: string,
  taskId: string,
  dbOverride?: EmberDatabase
): Promise<boolean> {
  const db = dbOverride ?? getDb();
  const deleted = await db
    .delete(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)))
    .returning({ id: tasks.id });

  return deleted.length > 0;
}

export async function getActiveGoalsForUser(
  userId: string,
  timezone: string,
  dbOverride?: DbExecutor
): Promise<{ daily: GoalDto; weekly: GoalDto }> {
  const db = dbOverride ?? getDb();
  const todayKey = getLocalDateKey(new Date(), timezone);
  const weekKey = getIsoWeekKey(todayKey);

  const [prefs] = await db
    .select({ dailyFocusGoalMinutes: userPreferences.dailyFocusGoalMinutes })
    .from(userPreferences)
    .where(eq(userPreferences.userId, userId))
    .limit(1);

  const defaultDailyMinutes = prefs?.dailyFocusGoalMinutes ?? 120;

  const existingGoals = await db
    .select()
    .from(goals)
    .where(
      and(
        eq(goals.userId, userId),
        inArray(goals.periodKey, [todayKey, weekKey])
      )
    );

  const dailyGoalRow = existingGoals.find(
    (g) => g.periodType === "daily" && g.periodKey === todayKey
  );
  const weeklyGoalRow = existingGoals.find(
    (g) => g.periodType === "weekly" && g.periodKey === weekKey
  );

  // Aggregate today's & week's completed focus sessions
  const [todayAgg] = await db
    .select({
      totalSeconds: sql<number>`coalesce(sum(${focusSessions.accumulatedSeconds}), 0)`,
      sessionCount: sql<number>`count(*)`,
    })
    .from(focusSessions)
    .where(
      and(
        eq(focusSessions.userId, userId),
        eq(focusSessions.localDate, todayKey),
        eq(focusSessions.status, "completed"),
        inArray(focusSessions.mode, ["pomodoro", "custom", "stopwatch"])
      )
    );

  // Compute Monday..Sunday range for current week
  const weekRows = await db
    .select({
      localDate: focusSessions.localDate,
      accumulatedSeconds: focusSessions.accumulatedSeconds,
    })
    .from(focusSessions)
    .where(
      and(
        eq(focusSessions.userId, userId),
        eq(focusSessions.status, "completed"),
        inArray(focusSessions.mode, ["pomodoro", "custom", "stopwatch"])
      )
    );

  let weeklySeconds = 0;
  let weeklySessions = 0;
  for (const row of weekRows) {
    if (getIsoWeekKey(row.localDate) === weekKey) {
      weeklySeconds += row.accumulatedSeconds;
      weeklySessions += 1;
    }
  }

  return {
    daily: {
      id: dailyGoalRow?.id ?? "default-daily",
      periodType: "daily",
      periodKey: todayKey,
      targetMinutes: dailyGoalRow?.targetMinutes ?? defaultDailyMinutes,
      targetSessions: dailyGoalRow?.targetSessions ?? 0,
      actualMinutes: Math.floor(Number(todayAgg?.totalSeconds ?? 0) / 60),
      actualSessions: Number(todayAgg?.sessionCount ?? 0),
      completedAt: dailyGoalRow?.completedAt
        ? dailyGoalRow.completedAt.toISOString()
        : null,
    },
    weekly: {
      id: weeklyGoalRow?.id ?? "default-weekly",
      periodType: "weekly",
      periodKey: weekKey,
      targetMinutes: weeklyGoalRow?.targetMinutes ?? defaultDailyMinutes * 5,
      targetSessions: weeklyGoalRow?.targetSessions ?? 0,
      actualMinutes: Math.floor(weeklySeconds / 60),
      actualSessions: weeklySessions,
      completedAt: weeklyGoalRow?.completedAt
        ? weeklyGoalRow.completedAt.toISOString()
        : null,
    },
  };
}

export async function upsertGoalForUser(
  userId: string,
  timezone: string,
  rawInput: UpsertGoalInput,
  dbOverride?: EmberDatabase
): Promise<GoalDto> {
  const input = upsertGoalSchema.parse(rawInput);
  const db = dbOverride ?? getDb();
  const todayKey = getLocalDateKey(new Date(), timezone);
  const periodKey =
    input.periodType === "daily" ? todayKey : getIsoWeekKey(todayKey);

  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(goals)
      .where(
        and(
          eq(goals.userId, userId),
          eq(goals.periodType, input.periodType),
          eq(goals.periodKey, periodKey)
        )
      )
      .limit(1);

    let savedId: string;
    if (existing) {
      const [updated] = await tx
        .update(goals)
        .set({
          targetMinutes: input.targetMinutes,
          targetSessions: input.targetSessions,
          updatedAt: new Date(),
        })
        .where(eq(goals.id, existing.id))
        .returning();
      savedId = updated!.id;
    } else {
      const [inserted] = await tx
        .insert(goals)
        .values({
          userId,
          periodType: input.periodType,
          periodKey,
          targetMinutes: input.targetMinutes,
          targetSessions: input.targetSessions,
        })
        .returning();
      savedId = inserted!.id;
    }

    if (input.periodType === "daily") {
      await tx
        .update(userPreferences)
        .set({
          dailyFocusGoalMinutes: input.targetMinutes,
          updatedAt: new Date(),
        })
        .where(eq(userPreferences.userId, userId));
    }

    const refreshed = await getActiveGoalsForUser(userId, timezone, tx);
    return {
      ...(input.periodType === "daily" ? refreshed.daily : refreshed.weekly),
      id: savedId,
    };
  });
}
