import { z } from "zod";

const TIME_HM_REGEX = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

export function isValidTimeHm(value: string): boolean {
  return TIME_HM_REGEX.test(value);
}

export function parseHmToMinutes(hm: string): number {
  const [hStr, mStr] = hm.split(":");
  const hours = Number(hStr);
  const minutes = Number(mStr);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) {
    return 0;
  }
  return hours * 60 + minutes;
}

export const reminderSettingsSchema = z.object({
  notificationsEnabled: z.boolean().default(true),
  focusReminderEnabled: z.boolean().default(false),
  focusReminderTime: z
    .string()
    .regex(TIME_HM_REGEX, "Must be HH:MM (24-hour)")
    .default("09:30"),
  breakReminderEnabled: z.boolean().default(true),
  breakIntervalMinutes: z.number().int().min(10).max(180).default(50),
  dailyGoalReminderEnabled: z.boolean().default(false),
  dailyGoalReminderTime: z
    .string()
    .regex(TIME_HM_REGEX, "Must be HH:MM (24-hour)")
    .default("18:00"),
  habitReminderEnabled: z.boolean().default(false),
  habitReminderTime: z
    .string()
    .regex(TIME_HM_REGEX, "Must be HH:MM (24-hour)")
    .default("20:00"),
  quietHoursEnabled: z.boolean().default(true),
  quietHoursStart: z
    .string()
    .regex(TIME_HM_REGEX, "Must be HH:MM (24-hour)")
    .default("22:00"),
  quietHoursEnd: z
    .string()
    .regex(TIME_HM_REGEX, "Must be HH:MM (24-hour)")
    .default("07:30"),
});

export type ReminderSettingsInput = z.infer<typeof reminderSettingsSchema>;

export interface ReminderSettingsDto extends ReminderSettingsInput {
  updatedAt: string | null;
}

export const DEFAULT_REMINDER_SETTINGS: ReminderSettingsDto = {
  notificationsEnabled: true,
  focusReminderEnabled: false,
  focusReminderTime: "09:30",
  breakReminderEnabled: true,
  breakIntervalMinutes: 50,
  dailyGoalReminderEnabled: false,
  dailyGoalReminderTime: "18:00",
  habitReminderEnabled: false,
  habitReminderTime: "20:00",
  quietHoursEnabled: true,
  quietHoursStart: "22:00",
  quietHoursEnd: "07:30",
  updatedAt: null,
};

/**
 * Checks whether currentHm falls inside [startHm, endHm) across either same-day or overnight windows.
 */
export function isWithinQuietHours(
  currentHm: string,
  startHm: string,
  endHm: string
): boolean {
  if (!isValidTimeHm(currentHm) || !isValidTimeHm(startHm) || !isValidTimeHm(endHm)) {
    return false;
  }
  if (startHm === endHm) {
    return false;
  }

  const current = parseHmToMinutes(currentHm);
  const start = parseHmToMinutes(startHm);
  const end = parseHmToMinutes(endHm);

  if (start < end) {
    return current >= start && current < end;
  }
  // Overnight quiet window (e.g. 22:00 -> 07:30)
  return current >= start || current < end;
}

export interface DueReminderCandidate {
  id: "focus" | "break" | "daily_goal" | "habit";
  title: string;
  body: string;
  href: string;
}

export interface EvaluateRemindersInput {
  settings: ReminderSettingsInput;
  currentHm: string;
  activeFocusMinutesElapsed: number;
  isFocusRunning: boolean;
  todayFocusMinutes: number;
  dailyFocusGoalMinutes: number;
  incompleteHabitsTodayCount: number;
  alreadySentIds?: Set<string>;
}

/**
 * Evaluates which configured reminders should surface cleanly right now,
 * respecting user consent, quiet hours, and already-delivered de-duplication.
 */
export function evaluateDueReminders(
  input: EvaluateRemindersInput
): DueReminderCandidate[] {
  const { settings } = input;
  if (!settings.notificationsEnabled) {
    return [];
  }
  if (
    settings.quietHoursEnabled &&
    isWithinQuietHours(currentHmOrFallback(input.currentHm), settings.quietHoursStart, settings.quietHoursEnd)
  ) {
    return [];
  }

  const currentMin = parseHmToMinutes(currentHmOrFallback(input.currentHm));
  const sent = input.alreadySentIds ?? new Set<string>();
  const due: DueReminderCandidate[] = [];

  if (
    settings.focusReminderEnabled &&
    !sent.has("focus") &&
    !input.isFocusRunning &&
    input.todayFocusMinutes === 0 &&
    currentMin >= parseHmToMinutes(settings.focusReminderTime)
  ) {
    due.push({
      id: "focus",
      title: "Ready for a focus block?",
      body: "No focus time logged yet today. Start a calm 25-minute block whenever you're ready.",
      href: "/focus",
    });
  }

  if (
    settings.breakReminderEnabled &&
    !sent.has("break") &&
    input.isFocusRunning &&
    input.activeFocusMinutesElapsed >= settings.breakIntervalMinutes
  ) {
    due.push({
      id: "break",
      title: "Time for a quick stretch or break",
      body: `You've stayed focused for ${Math.round(input.activeFocusMinutesElapsed)}m. Step away for water or a short break.`,
      href: "/focus",
    });
  }

  if (
    settings.dailyGoalReminderEnabled &&
    !sent.has("daily_goal") &&
    input.todayFocusMinutes < input.dailyFocusGoalMinutes &&
    currentMin >= parseHmToMinutes(settings.dailyGoalReminderTime)
  ) {
    const remaining = Math.max(1, input.dailyFocusGoalMinutes - input.todayFocusMinutes);
    due.push({
      id: "daily_goal",
      title: "Daily focus goal check-in",
      body: `${remaining}m remaining to reach today's ${input.dailyFocusGoalMinutes}m focus goal.`,
      href: "/focus",
    });
  }

  if (
    settings.habitReminderEnabled &&
    !sent.has("habit") &&
    input.incompleteHabitsTodayCount > 0 &&
    currentMin >= parseHmToMinutes(settings.habitReminderTime)
  ) {
    due.push({
      id: "habit",
      title: "Evening habit check-in",
      body: `${input.incompleteHabitsTodayCount} scheduled habit(s) still open for today.`,
      href: "/habits",
    });
  }

  return due;
}

function currentHmOrFallback(value: string): string {
  return isValidTimeHm(value) ? value : "12:00";
}
