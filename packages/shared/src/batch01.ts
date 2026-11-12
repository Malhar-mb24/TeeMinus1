import { z } from "zod";
import {
  COMPANION_STYLES,
  SOUNDSCAPE_PREFERENCES,
  THEME_OPTIONS,
  isValidIanaTimezone,
} from "./preferences";

// --- Onboarding ---
export const completeOnboardingSchema = z.object({
  timezone: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .refine(isValidIanaTimezone, "Must be a valid IANA timezone"),
  pomodoroMinutes: z.number().int().min(5).max(120),
  shortBreakMinutes: z.number().int().min(1).max(30),
  longBreakMinutes: z.number().int().min(5).max(60),
  dailyFocusGoalMinutes: z.number().int().min(15).max(720),
  theme: z.enum(THEME_OPTIONS),
  companionStyle: z.enum(COMPANION_STYLES),
  soundscapePreference: z.enum(SOUNDSCAPE_PREFERENCES),
  extensionTrackingConsent: z.boolean(),
});

export type CompleteOnboardingInput = z.infer<typeof completeOnboardingSchema>;

// --- Tasks & Goals ---
export const TASK_PRIORITIES = ["low", "medium", "high", "urgent"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const TASK_STATUSES = ["todo", "in_progress", "completed", "archived"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_COLORS = [
  "#38BDF8",
  "#F97316",
  "#10B981",
  "#A855F7",
  "#F43F5E",
] as const;

export const createTaskSchema = z.object({
  title: z.string().trim().min(1, "Task title is required").max(160),
  description: z.string().trim().max(1000).optional(),
  category: z.string().trim().min(1).max(40).default("Study"),
  color: z.string().trim().regex(/^#[0-9A-Fa-f]{6}$/).default("#38BDF8"),
  priority: z.enum(TASK_PRIORITIES).default("medium"),
  plannedMinutes: z.number().int().min(5).max(600).default(30),
  scheduledDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  plannedStartMinute: z.number().int().min(0).max(1439).nullable().optional(),
});

export const updateTaskSchema = z.object({
  title: z.string().trim().min(1).max(160).optional(),
  description: z.string().trim().max(1000).nullable().optional(),
  category: z.string().trim().min(1).max(40).optional(),
  color: z.string().trim().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  priority: z.enum(TASK_PRIORITIES).optional(),
  status: z.enum(TASK_STATUSES).optional(),
  plannedMinutes: z.number().int().min(5).max(600).optional(),
  scheduledDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  plannedStartMinute: z.number().int().min(0).max(1439).nullable().optional(),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;

export interface TaskDto {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  category: string;
  color: string;
  priority: TaskPriority;
  status: TaskStatus;
  plannedMinutes: number;
  actualMinutes: number;
  scheduledDate: string | null;
  plannedStartMinute: number | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export const upsertGoalSchema = z.object({
  periodType: z.enum(["daily", "weekly"]),
  targetMinutes: z.number().int().min(15).max(5000),
  targetSessions: z.number().int().min(0).max(100).default(0),
});

export type UpsertGoalInput = z.infer<typeof upsertGoalSchema>;

export interface GoalDto {
  id: string;
  periodType: "daily" | "weekly";
  periodKey: string;
  targetMinutes: number;
  targetSessions: number;
  actualMinutes: number;
  actualSessions: number;
  completedAt: string | null;
}

// --- Focus Engine ---
export const FOCUS_MODES = [
  "pomodoro",
  "custom",
  "short_break",
  "long_break",
  "stopwatch",
] as const;
export type FocusMode = (typeof FOCUS_MODES)[number];

export const FOCUS_STATUSES = [
  "running",
  "paused",
  "completed",
  "interrupted",
  "cancelled",
] as const;
export type FocusSessionStatus = (typeof FOCUS_STATUSES)[number];

export const startFocusSessionSchema = z.object({
  mode: z.enum(FOCUS_MODES),
  plannedDurationSeconds: z.number().int().min(60).max(28_800).nullable().optional(),
  taskId: z.string().uuid().nullable().optional(),
  label: z.string().trim().max(120).optional(),
  soundscape: z.enum(SOUNDSCAPE_PREFERENCES).default("none"),
});

export const updateFocusSessionSchema = z.object({
  action: z.enum(["pause", "resume", "complete", "interrupt", "cancel", "update_notes"]),
  notes: z.string().trim().max(2000).nullable().optional(),
  label: z.string().trim().max(120).nullable().optional(),
  soundscape: z.enum(SOUNDSCAPE_PREFERENCES).optional(),
  idempotencyKey: z.string().trim().min(8).max(120).optional(),
});

export type StartFocusSessionInput = z.infer<typeof startFocusSessionSchema>;
export type UpdateFocusSessionInput = z.infer<typeof updateFocusSessionSchema>;

export interface FocusSessionDto {
  id: string;
  userId: string;
  taskId: string | null;
  taskTitle: string | null;
  mode: FocusMode;
  status: FocusSessionStatus;
  plannedDurationSeconds: number | null;
  startedAt: string;
  lastResumedAt: string | null;
  accumulatedSeconds: number;
  endedAt: string | null;
  localDate: string;
  label: string | null;
  notes: string | null;
  soundscape: string;
  xpEarned: number;
  createdAt: string;
}

// --- Habits ---
export const HABIT_CATEGORIES = [
  "Betterment",
  "Study",
  "Work",
  "Fitness",
  "Health",
] as const;
export type HabitCategory = (typeof HABIT_CATEGORIES)[number];

export const HABIT_ICONS = [
  "check",
  "book-open",
  "terminal",
  "dumbbell",
  "brain",
  "sparkles",
  "heart",
  "flame",
] as const;

export const createHabitSchema = z.object({
  title: z.string().trim().min(1, "Habit title is required").max(80),
  description: z.string().trim().max(240).optional(),
  category: z.string().trim().min(1).max(32).default("Betterment"),
  icon: z.string().trim().min(1).max(32).default("check"),
  color: z.string().trim().regex(/^#[0-9A-Fa-f]{6}$/).default("#10B981"),
  scheduleType: z.enum(["daily", "weekdays"]).default("daily"),
  scheduledDays: z.array(z.number().int().min(0).max(6)).min(1).max(7).default([0, 1, 2, 3, 4, 5, 6]),
  targetPerDay: z.number().int().min(1).max(20).default(1),
});

export const updateHabitSchema = z.object({
  title: z.string().trim().min(1).max(80).optional(),
  description: z.string().trim().max(240).nullable().optional(),
  category: z.string().trim().min(1).max(32).optional(),
  icon: z.string().trim().min(1).max(32).optional(),
  color: z.string().trim().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  scheduleType: z.enum(["daily", "weekdays"]).optional(),
  scheduledDays: z.array(z.number().int().min(0).max(6)).min(1).max(7).optional(),
  targetPerDay: z.number().int().min(1).max(20).optional(),
  archived: z.boolean().optional(),
});

export const habitCheckInSchema = z.object({
  localDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  action: z.enum(["increment", "complete", "skip", "undo"]),
  note: z.string().trim().max(300).optional(),
});

export type CreateHabitInput = z.infer<typeof createHabitSchema>;
export type UpdateHabitInput = z.infer<typeof updateHabitSchema>;
export type HabitCheckInInput = z.infer<typeof habitCheckInSchema>;

export interface HabitEntryDto {
  id: string;
  habitId: string;
  localDate: string;
  status: "completed" | "partial" | "skipped" | "missed";
  progressCount: number;
  note: string | null;
}

export interface HabitWithStatsDto {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  category: string;
  icon: string;
  color: string;
  scheduleType: "daily" | "weekdays";
  scheduledDays: number[];
  targetPerDay: number;
  archived: boolean;
  createdAt: string;
  entries: HabitEntryDto[];
  stats: {
    currentStreak: number;
    bestStreak: number;
    completedDays: number;
    skippedDays: number;
    missedDays: number;
    completionRate: number;
  };
}

// --- Gamification & Analytics DTOs ---
export interface XpEventDto {
  id: string;
  eventType: string;
  xpDelta: number;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface AchievementStatusDto {
  code: string;
  title: string;
  description: string;
  icon: string;
  xpReward: number;
  category: string;
  unlocked: boolean;
  unlockedAt: string | null;
}

export interface GamificationSummaryDto {
  totalXp: number;
  level: number;
  xpIntoLevel: number;
  xpToNextLevel: number;
  progressPercent: number;
  currentFocusStreakDays: number;
  bestFocusStreakDays: number;
  unlockedCosmetics: string[];
  recentXpEvents: XpEventDto[];
  achievements: AchievementStatusDto[];
}

export interface DailyBucketDto {
  localDate: string;
  label: string;
  focusMinutes: number;
  sessionsCount: number;
  tasksCompleted: number;
  habitsCompleted: number;
}

export interface AnalyticsSummaryDto {
  todayDate: string;
  timezone: string;
  daily: {
    focusMinutes: number;
    dailyGoalMinutes: number;
    sessionsCompleted: number;
    tasksCompleted: number;
    habitsCompleted: number;
    habitsScheduledToday: number;
  };
  weekly: {
    totalFocusMinutes: number;
    sessionsCompleted: number;
    consistencyDays: number;
    weeklyGoalMinutes: number;
    buckets: DailyBucketDto[];
    categoryBreakdown: Array<{ category: string; minutes: number }>;
  };
  monthly: {
    totalFocusMinutes: number;
    activeDays: number;
    heatmap: Array<{ localDate: string; focusMinutes: number }>;
  };
}
