import {
  addDaysToDateKey,
  getDateKeysRange,
  getDayOfWeekFromDateKey,
  getLocalDateKey,
  parseDateKeyUtc,
  type AnalyticsSummaryDto,
  type DailyBucketDto,
} from "@ember/shared";
import { and, eq, gte, inArray } from "drizzle-orm";
import { getDb, type EmberDatabase } from "./client";
import {
  focusSessions,
  habitEntries,
  habits,
  tasks,
  userPreferences,
} from "./schema";

const SHORT_WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export async function getAnalyticsSummaryForUser(
  userId: string,
  timezone: string,
  dbOverride?: EmberDatabase
): Promise<AnalyticsSummaryDto> {
  const db = dbOverride ?? getDb();
  const todayDate = getLocalDateKey(new Date(), timezone);
  const weekStartDate = addDaysToDateKey(todayDate, -6);
  const monthStartDate = addDaysToDateKey(todayDate, -89);

  const [prefs] = await db
    .select({ dailyFocusGoalMinutes: userPreferences.dailyFocusGoalMinutes })
    .from(userPreferences)
    .where(eq(userPreferences.userId, userId))
    .limit(1);
  const dailyGoalMinutes = prefs?.dailyFocusGoalMinutes ?? 120;

  // Indexed query over last 90 days of completed/interrupted focus sessions
  const sessionRows = await db
    .select({
      localDate: focusSessions.localDate,
      accumulatedSeconds: focusSessions.accumulatedSeconds,
      status: focusSessions.status,
      mode: focusSessions.mode,
      taskId: focusSessions.taskId,
      category: tasks.category,
    })
    .from(focusSessions)
    .leftJoin(tasks, eq(focusSessions.taskId, tasks.id))
    .where(
      and(
        eq(focusSessions.userId, userId),
        gte(focusSessions.localDate, monthStartDate),
        inArray(focusSessions.status, ["completed", "interrupted"]),
        inArray(focusSessions.mode, ["pomodoro", "custom", "stopwatch"])
      )
    );

  // Completed tasks in the last 7 days
  const recentTasks = await db
    .select({
      status: tasks.status,
      completedAt: tasks.completedAt,
      scheduledDate: tasks.scheduledDate,
    })
    .from(tasks)
    .where(and(eq(tasks.userId, userId), eq(tasks.status, "completed")));

  // Active habits & entries over last 7 days
  const activeHabits = await db
    .select({
      id: habits.id,
      scheduledDays: habits.scheduledDays,
    })
    .from(habits)
    .where(and(eq(habits.userId, userId), eq(habits.archived, false)));

  const recentHabitEntries = await db
    .select({
      localDate: habitEntries.localDate,
      status: habitEntries.status,
    })
    .from(habitEntries)
    .where(
      and(
        eq(habitEntries.userId, userId),
        gte(habitEntries.localDate, weekStartDate),
        eq(habitEntries.status, "completed")
      )
    );

  const focusMinutesByDate = new Map<string, number>();
  const completedSessionsByDate = new Map<string, number>();
  const categoryMinutes = new Map<string, number>();

  let monthlyFocusSeconds = 0;
  for (const row of sessionRows) {
    monthlyFocusSeconds += row.accumulatedSeconds;
    const prevSec = focusMinutesByDate.get(row.localDate) ?? 0;
    focusMinutesByDate.set(row.localDate, prevSec + row.accumulatedSeconds);

    if (row.status === "completed") {
      completedSessionsByDate.set(
        row.localDate,
        (completedSessionsByDate.get(row.localDate) ?? 0) + 1
      );
    }

    if (row.localDate >= weekStartDate) {
      const cat = row.category ?? "General Focus";
      categoryMinutes.set(
        cat,
        (categoryMinutes.get(cat) ?? 0) + Math.round(row.accumulatedSeconds / 60)
      );
    }
  }

  const tasksCompletedByDate = new Map<string, number>();
  for (const task of recentTasks) {
    const taskDate = task.completedAt
      ? getLocalDateKey(task.completedAt, timezone)
      : task.scheduledDate;
    if (taskDate && taskDate >= weekStartDate) {
      tasksCompletedByDate.set(
        taskDate,
        (tasksCompletedByDate.get(taskDate) ?? 0) + 1
      );
    }
  }

  const habitsCompletedByDate = new Map<string, number>();
  for (const entry of recentHabitEntries) {
    habitsCompletedByDate.set(
      entry.localDate,
      (habitsCompletedByDate.get(entry.localDate) ?? 0) + 1
    );
  }

  const weekKeys = getDateKeysRange(todayDate, 7);
  const buckets: DailyBucketDto[] = weekKeys.map((dateKey) => {
    const dayIdx = getDayOfWeekFromDateKey(dateKey);
    const label = SHORT_WEEKDAY_LABELS[dayIdx] ?? "Day";
    const mins = Math.round((focusMinutesByDate.get(dateKey) ?? 0) / 60);
    return {
      localDate: dateKey,
      label,
      focusMinutes: mins,
      sessionsCount: completedSessionsByDate.get(dateKey) ?? 0,
      tasksCompleted: tasksCompletedByDate.get(dateKey) ?? 0,
      habitsCompleted: habitsCompletedByDate.get(dateKey) ?? 0,
    };
  });

  const weeklyFocusMinutes = buckets.reduce((acc, b) => acc + b.focusMinutes, 0);
  const weeklySessions = buckets.reduce((acc, b) => acc + b.sessionsCount, 0);
  const consistencyDays = buckets.filter((b) => b.focusMinutes > 0).length;

  const todayDow = parseDateKeyUtc(todayDate).getUTCDay();
  const habitsScheduledToday = activeHabits.filter((h) =>
    h.scheduledDays.includes(todayDow)
  ).length;

  const heatmapKeys = getDateKeysRange(todayDate, 84);
  const heatmap = heatmapKeys.map((dateKey) => ({
    localDate: dateKey,
    focusMinutes: Math.round((focusMinutesByDate.get(dateKey) ?? 0) / 60),
  }));

  const activeDays = heatmap.filter((cell) => cell.focusMinutes > 0).length;

  return {
    todayDate,
    timezone,
    daily: {
      focusMinutes: Math.round((focusMinutesByDate.get(todayDate) ?? 0) / 60),
      dailyGoalMinutes,
      sessionsCompleted: completedSessionsByDate.get(todayDate) ?? 0,
      tasksCompleted: tasksCompletedByDate.get(todayDate) ?? 0,
      habitsCompleted: habitsCompletedByDate.get(todayDate) ?? 0,
      habitsScheduledToday,
    },
    weekly: {
      totalFocusMinutes: weeklyFocusMinutes,
      sessionsCompleted: weeklySessions,
      consistencyDays,
      weeklyGoalMinutes: dailyGoalMinutes * 5,
      buckets,
      categoryBreakdown: Array.from(categoryMinutes.entries()).map(
        ([category, minutes]) => ({ category, minutes })
      ),
    },
    monthly: {
      totalFocusMinutes: Math.round(monthlyFocusSeconds / 60),
      activeDays,
      heatmap,
    },
  };
}
