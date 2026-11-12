import { z } from "zod";

export const THEME_OPTIONS = ["ember-dark", "obsidian", "slate"] as const;
export type ThemeOption = (typeof THEME_OPTIONS)[number];

export const COMPANION_STYLES = ["classic-flame", "ember-spark", "calm-hearth"] as const;
export type CompanionStyle = (typeof COMPANION_STYLES)[number];

export const SOUNDSCAPE_PREFERENCES = [
  "none",
  "rain",
  "lofi",
  "cafe",
  "white-noise",
] as const;
export type SoundscapePreference = (typeof SOUNDSCAPE_PREFERENCES)[number];

export function isValidIanaTimezone(value: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export const DEFAULT_USER_PREFERENCES = {
  timezone: "UTC",
  theme: "ember-dark" as ThemeOption,
  pomodoroMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  dailyFocusGoalMinutes: 120,
  companionStyle: "classic-flame" as CompanionStyle,
  soundscapePreference: "none" as SoundscapePreference,
  extensionTrackingConsent: false,
  notificationsEnabled: true,
} as const;

export const updateUserPreferencesSchema = z.object({
  timezone: z
    .string()
    .trim()
    .min(1, "Timezone is required")
    .max(64)
    .refine(isValidIanaTimezone, "Must be a valid IANA timezone (e.g. UTC, Asia/Kolkata)")
    .optional(),
  theme: z.enum(THEME_OPTIONS).optional(),
  pomodoroMinutes: z.number().int().min(5).max(120).optional(),
  shortBreakMinutes: z.number().int().min(1).max(30).optional(),
  longBreakMinutes: z.number().int().min(5).max(60).optional(),
  dailyFocusGoalMinutes: z.number().int().min(15).max(720).optional(),
  companionStyle: z.enum(COMPANION_STYLES).optional(),
  soundscapePreference: z.enum(SOUNDSCAPE_PREFERENCES).optional(),
  extensionTrackingConsent: z.boolean().optional(),
  notificationsEnabled: z.boolean().optional(),
});

export type UpdateUserPreferencesInput = z.infer<typeof updateUserPreferencesSchema>;

export interface UserPreferencesDto {
  id: string;
  userId: string;
  timezone: string;
  theme: ThemeOption;
  pomodoroMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  dailyFocusGoalMinutes: number;
  companionStyle: CompanionStyle;
  soundscapePreference: SoundscapePreference;
  extensionTrackingConsent: boolean;
  extensionConsentUpdatedAt: string | null;
  notificationsEnabled: boolean;
  updatedAt: string;
}

export interface UserProfileDto {
  id: string;
  clerkUserId: string;
  email: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  onboardingCompleted: boolean;
  createdAt: string;
  updatedAt: string;
}
