export interface HabitEntrySummaryInput {
  localDate: string;
  status: "completed" | "partial" | "skipped" | "missed";
  progressCount: number;
}

export interface HabitComputedStats {
  currentStreak: number;
  bestStreak: number;
  completedDays: number;
  skippedDays: number;
  missedDays: number;
  scheduledDaysCount: number;
  completionRate: number;
}

/**
 * Formats a Date into YYYY-MM-DD inside the provided IANA timezone.
 * Falls back safely to UTC if an unexpected timezone string is encountered.
 */
export function getLocalDateKey(date: Date = new Date(), timezone = "UTC"): string {
  try {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    return formatter.format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

/**
 * Parses a YYYY-MM-DD key into a UTC midnight Date object for deterministic calendar arithmetic.
 */
export function parseDateKeyUtc(dateKey: string): Date {
  const [yStr, mStr, dStr] = dateKey.split("-");
  const year = Number(yStr);
  const month = Number(mStr);
  const day = Number(dStr);
  return new Date(Date.UTC(year, month - 1, day));
}

export function formatUtcDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDaysToDateKey(dateKey: string, deltaDays: number): string {
  const dt = parseDateKeyUtc(dateKey);
  dt.setUTCDate(dt.getUTCDate() + deltaDays);
  return formatUtcDateKey(dt);
}

/**
 * Returns 0 (Sunday) through 6 (Saturday) for a YYYY-MM-DD local date key.
 */
export function getDayOfWeekFromDateKey(dateKey: string): number {
  return parseDateKeyUtc(dateKey).getUTCDay();
}

export function getDateKeysRange(endDateKey: string, daysCount: number): string[] {
  const safeCount = Math.max(1, Math.floor(daysCount));
  const keys: string[] = [];
  for (let offset = safeCount - 1; offset >= 0; offset -= 1) {
    keys.push(addDaysToDateKey(endDateKey, -offset));
  }
  return keys;
}

export function getIsoWeekKey(dateKey: string): string {
  const dt = parseDateKeyUtc(dateKey);
  const dayNum = dt.getUTCDay() || 7;
  dt.setUTCDate(dt.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(dt.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((dt.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${dt.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

export function getMonthCalendarDays(yearMonth: string): Array<{
  dateKey: string;
  dayOfMonth: number;
  dayOfWeek: number;
}> {
  const [yStr, mStr] = yearMonth.split("-");
  const year = Number(yStr);
  const month = Number(mStr);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return [];
  }
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const result: Array<{ dateKey: string; dayOfMonth: number; dayOfWeek: number }> = [];
  for (let day = 1; day <= daysInMonth; day += 1) {
    const dateKey = `${String(year).padStart(4, "0")}-${String(month).padStart(
      2,
      "0"
    )}-${String(day).padStart(2, "0")}`;
    result.push({
      dateKey,
      dayOfMonth: day,
      dayOfWeek: getDayOfWeekFromDateKey(dateKey),
    });
  }
  return result;
}

/**
 * Computes timezone-accurate habit streaks and completion stats.
 * - Completed scheduled days advance current & best streak.
 * - Skipped days are preserved distinctly (do not count as missed, keep streak intact without inflating count).
 * - Past scheduled days without an entry (or marked missed) break the streak and count as missed.
 */
export function computeHabitStats(
  scheduledDays: number[],
  entries: HabitEntrySummaryInput[],
  todayDateKey: string,
  lookbackDays = 60
): HabitComputedStats {
  const scheduleSet = new Set(scheduledDays.length > 0 ? scheduledDays : [0, 1, 2, 3, 4, 5, 6]);
  const entryMap = new Map<string, HabitEntrySummaryInput>();
  for (const entry of entries) {
    entryMap.set(entry.localDate, entry);
  }

  let completedDays = 0;
  let skippedDays = 0;
  let missedDays = 0;
  let scheduledDaysCount = 0;
  let bestStreak = 0;
  let runningStreak = 0;

  const windowKeys = getDateKeysRange(todayDateKey, lookbackDays);
  for (const dateKey of windowKeys) {
    const isScheduled = scheduleSet.has(getDayOfWeekFromDateKey(dateKey));
    const entry = entryMap.get(dateKey);

    if (entry?.status === "completed") {
      completedDays += 1;
      if (isScheduled) {
        scheduledDaysCount += 1;
      }
      runningStreak += 1;
      if (runningStreak > bestStreak) {
        bestStreak = runningStreak;
      }
      continue;
    }

    if (entry?.status === "skipped") {
      skippedDays += 1;
      continue;
    }

    if (isScheduled) {
      if (dateKey < todayDateKey) {
        scheduledDaysCount += 1;
        missedDays += 1;
        runningStreak = 0;
      } else if (entry?.status === "missed") {
        scheduledDaysCount += 1;
        missedDays += 1;
        runningStreak = 0;
      } else if (dateKey === todayDateKey && entry?.status === "partial") {
        scheduledDaysCount += 1;
      }
    }
  }

  // Compute active currentStreak walking backwards from today (allowing today to remain pending without breaking yesterday's streak)
  let currentStreak = 0;
  for (let offset = 0; offset < 365; offset += 1) {
    const dateKey = addDaysToDateKey(todayDateKey, -offset);
    const isScheduled = scheduleSet.has(getDayOfWeekFromDateKey(dateKey));
    const entry = entryMap.get(dateKey);

    if (entry?.status === "completed") {
      currentStreak += 1;
      continue;
    }

    if (entry?.status === "skipped" || !isScheduled) {
      continue;
    }

    // Today is still in progress unless explicitly marked missed
    if (dateKey === todayDateKey && entry?.status !== "missed") {
      continue;
    }

    break;
  }

  const denominator = completedDays + missedDays;
  const completionRate =
    denominator > 0 ? Math.round((completedDays / denominator) * 100) : 0;

  return {
    currentStreak,
    bestStreak: Math.max(bestStreak, currentStreak),
    completedDays,
    skippedDays,
    missedDays,
    scheduledDaysCount,
    completionRate,
  };
}
