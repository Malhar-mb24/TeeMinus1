import {
  addDaysToDateKey,
  computeHabitStats,
  createHabitSchema,
  getLocalDateKey,
  habitCheckInSchema,
  updateHabitSchema,
  type CreateHabitInput,
  type HabitCheckInInput,
  type HabitEntryDto,
  type HabitWithStatsDto,
  type UpdateHabitInput,
} from "@ember/shared";
import { and, desc, eq, gte, inArray } from "drizzle-orm";
import { getDb, type EmberDatabase } from "./client";
import {
  awardXpIdempotently,
  removeXpEventByKey,
  syncUserProgressAndAchievements,
} from "./gamification";
import { habitEntries, habits, type DbHabit, type DbHabitEntry } from "./schema";

function mapHabitEntryDto(row: DbHabitEntry): HabitEntryDto {
  return {
    id: row.id,
    habitId: row.habitId,
    localDate: row.localDate,
    status: row.status as HabitEntryDto["status"],
    progressCount: row.progressCount,
    note: row.note,
  };
}

function buildHabitWithStats(
  habit: DbHabit,
  entries: DbHabitEntry[],
  todayDateKey: string
): HabitWithStatsDto {
  const mappedEntries = entries.map(mapHabitEntryDto);
  const stats = computeHabitStats(habit.scheduledDays, mappedEntries, todayDateKey, 90);

  return {
    id: habit.id,
    userId: habit.userId,
    title: habit.title,
    description: habit.description,
    category: habit.category,
    icon: habit.icon,
    color: habit.color,
    scheduleType: habit.scheduleType as "daily" | "weekdays",
    scheduledDays: habit.scheduledDays,
    targetPerDay: habit.targetPerDay,
    archived: habit.archived,
    createdAt: habit.createdAt.toISOString(),
    entries: mappedEntries,
    stats: {
      currentStreak: stats.currentStreak,
      bestStreak: stats.bestStreak,
      completedDays: stats.completedDays,
      skippedDays: stats.skippedDays,
      missedDays: stats.missedDays,
      completionRate: stats.completionRate,
    },
  };
}

export async function listHabitsWithStatsForUser(
  userId: string,
  timezone: string,
  options?: { includeArchived?: boolean; category?: string },
  dbOverride?: EmberDatabase
): Promise<HabitWithStatsDto[]> {
  const db = dbOverride ?? getDb();
  const todayKey = getLocalDateKey(new Date(), timezone);
  const lookbackStartKey = addDaysToDateKey(todayKey, -120);

  const conditions = [eq(habits.userId, userId)];
  if (!options?.includeArchived) {
    conditions.push(eq(habits.archived, false));
  }
  if (options?.category && options.category !== "All") {
    conditions.push(eq(habits.category, options.category));
  }

  const habitRows = await db
    .select()
    .from(habits)
    .where(and(...conditions))
    .orderBy(desc(habits.createdAt));

  if (habitRows.length === 0) {
    return [];
  }

  const habitIds = habitRows.map((h) => h.id);
  const entryRows = await db
    .select()
    .from(habitEntries)
    .where(
      and(
        eq(habitEntries.userId, userId),
        inArray(habitEntries.habitId, habitIds),
        gte(habitEntries.localDate, lookbackStartKey)
      )
    );

  const entriesByHabit = new Map<string, DbHabitEntry[]>();
  for (const entry of entryRows) {
    const existing = entriesByHabit.get(entry.habitId) ?? [];
    existing.push(entry);
    entriesByHabit.set(entry.habitId, existing);
  }

  return habitRows.map((habit) =>
    buildHabitWithStats(habit, entriesByHabit.get(habit.id) ?? [], todayKey)
  );
}

export async function createHabitForUser(
  userId: string,
  timezone: string,
  rawInput: CreateHabitInput,
  dbOverride?: EmberDatabase
): Promise<HabitWithStatsDto> {
  const input = createHabitSchema.parse(rawInput);
  const db = dbOverride ?? getDb();
  const todayKey = getLocalDateKey(new Date(), timezone);

  const scheduledDays =
    input.scheduleType === "daily" ? [0, 1, 2, 3, 4, 5, 6] : input.scheduledDays;

  const [created] = await db
    .insert(habits)
    .values({
      userId,
      title: input.title,
      description: input.description ?? null,
      category: input.category,
      icon: input.icon,
      color: input.color,
      scheduleType: input.scheduleType,
      scheduledDays,
      targetPerDay: input.targetPerDay,
    })
    .returning();

  if (!created) {
    throw new Error("Unable to create habit");
  }

  return buildHabitWithStats(created, [], todayKey);
}

export async function updateHabitForUser(
  userId: string,
  habitId: string,
  timezone: string,
  rawInput: UpdateHabitInput,
  dbOverride?: EmberDatabase
): Promise<HabitWithStatsDto | null> {
  const input = updateHabitSchema.parse(rawInput);
  const db = dbOverride ?? getDb();
  const todayKey = getLocalDateKey(new Date(), timezone);

  const patch: Partial<typeof habits.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (input.title !== undefined) patch.title = input.title;
  if (input.description !== undefined) patch.description = input.description;
  if (input.category !== undefined) patch.category = input.category;
  if (input.icon !== undefined) patch.icon = input.icon;
  if (input.color !== undefined) patch.color = input.color;
  if (input.scheduleType !== undefined) patch.scheduleType = input.scheduleType;
  if (input.scheduledDays !== undefined) patch.scheduledDays = input.scheduledDays;
  if (input.targetPerDay !== undefined) patch.targetPerDay = input.targetPerDay;
  if (input.archived !== undefined) patch.archived = input.archived;

  const [updated] = await db
    .update(habits)
    .set(patch)
    .where(and(eq(habits.id, habitId), eq(habits.userId, userId)))
    .returning();

  if (!updated) {
    return null;
  }

  const entryRows = await db
    .select()
    .from(habitEntries)
    .where(and(eq(habitEntries.habitId, updated.id), eq(habitEntries.userId, userId)));

  return buildHabitWithStats(updated, entryRows, todayKey);
}

export async function deleteHabitForUser(
  userId: string,
  habitId: string,
  dbOverride?: EmberDatabase
): Promise<boolean> {
  const db = dbOverride ?? getDb();
  const deleted = await db
    .delete(habits)
    .where(and(eq(habits.id, habitId), eq(habits.userId, userId)))
    .returning({ id: habits.id });

  return deleted.length > 0;
}

export async function checkInHabitForUser(
  userId: string,
  habitId: string,
  timezone: string,
  rawInput: HabitCheckInInput,
  dbOverride?: EmberDatabase
): Promise<{
  habit: HabitWithStatsDto;
  xpAwarded: number;
  newlyUnlockedAchievements: string[];
} | null> {
  const input = habitCheckInSchema.parse(rawInput);
  const db = dbOverride ?? getDb();
  const todayKey = getLocalDateKey(new Date(), timezone);

  if (input.localDate > todayKey) {
    throw new Error("Cannot record habit check-ins for future dates");
  }

  // Historical integrity guard: allow checking in today or yesterday only (never silently rewrite older history).
  const yesterdayKey = addDaysToDateKey(todayKey, -1);
  if (input.localDate < yesterdayKey) {
    throw new Error("Historical habit entries older than yesterday cannot be overwritten");
  }

  return db.transaction(async (tx) => {
    const [habit] = await tx
      .select()
      .from(habits)
      .where(and(eq(habits.id, habitId), eq(habits.userId, userId)))
      .limit(1);

    if (!habit) {
      return null;
    }

    const [existingEntry] = await tx
      .select()
      .from(habitEntries)
      .where(
        and(
          eq(habitEntries.habitId, habit.id),
          eq(habitEntries.userId, userId),
          eq(habitEntries.localDate, input.localDate)
        )
      )
      .limit(1);

    const xpKey = `habit:${habit.id}:${input.localDate}`;
    let xpAwarded = 0;
    const now = new Date();

    if (input.action === "undo") {
      if (existingEntry) {
        if (habit.targetPerDay > 1 && existingEntry.progressCount > 1 && existingEntry.status !== "skipped") {
          const nextCount = existingEntry.progressCount - 1;
          await tx
            .update(habitEntries)
            .set({
              progressCount: nextCount,
              status: "partial",
              updatedAt: now,
            })
            .where(eq(habitEntries.id, existingEntry.id));
        } else {
          await tx.delete(habitEntries).where(eq(habitEntries.id, existingEntry.id));
        }
        await removeXpEventByKey(tx, userId, xpKey);
      }
    } else if (input.action === "skip") {
      if (existingEntry) {
        await tx
          .update(habitEntries)
          .set({
            status: "skipped",
            progressCount: 0,
            note: input.note ?? existingEntry.note,
            updatedAt: now,
          })
          .where(eq(habitEntries.id, existingEntry.id));
      } else {
        await tx.insert(habitEntries).values({
          habitId: habit.id,
          userId,
          localDate: input.localDate,
          status: "skipped",
          progressCount: 0,
          note: input.note ?? null,
        });
      }
      await removeXpEventByKey(tx, userId, xpKey);
    } else {
      const currentCount =
        existingEntry && existingEntry.status !== "skipped"
          ? existingEntry.progressCount
          : 0;
      const nextCount =
        input.action === "complete"
          ? habit.targetPerDay
          : Math.min(habit.targetPerDay, currentCount + 1);
      const nextStatus: "completed" | "partial" =
        nextCount >= habit.targetPerDay ? "completed" : "partial";

      if (existingEntry) {
        await tx
          .update(habitEntries)
          .set({
            status: nextStatus,
            progressCount: nextCount,
            note: input.note ?? existingEntry.note,
            updatedAt: now,
          })
          .where(eq(habitEntries.id, existingEntry.id));
      } else {
        await tx.insert(habitEntries).values({
          habitId: habit.id,
          userId,
          localDate: input.localDate,
          status: nextStatus,
          progressCount: nextCount,
          note: input.note ?? null,
        });
      }

      if (nextStatus === "completed") {
        const granted = await awardXpIdempotently(tx, {
          userId,
          eventType: "habit_completed",
          xpDelta: 20,
          idempotencyKey: xpKey,
          metadata: { habitId: habit.id, habitTitle: habit.title, localDate: input.localDate },
        });
        if (granted) {
          xpAwarded += 20;
        }
      }
    }

    const lookbackStartKey = addDaysToDateKey(todayKey, -120);
    const updatedEntries = await tx
      .select()
      .from(habitEntries)
      .where(
        and(
          eq(habitEntries.habitId, habit.id),
          eq(habitEntries.userId, userId),
          gte(habitEntries.localDate, lookbackStartKey)
        )
      );

    const withStats = buildHabitWithStats(habit, updatedEntries, todayKey);
    const syncResult = await syncUserProgressAndAchievements(tx, {
      userId,
      maxHabitStreak: withStats.stats.bestStreak,
    });

    return {
      habit: withStats,
      xpAwarded,
      newlyUnlockedAchievements: syncResult.newlyUnlockedAchievements,
    };
  });
}
