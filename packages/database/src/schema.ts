import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * User profile mapping table linked to verified Clerk external identity.
 */
export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    clerkUserId: text("clerk_user_id").notNull(),
    email: text("email"),
    displayName: text("display_name"),
    avatarUrl: text("avatar_url"),
    onboardingCompleted: boolean("onboarding_completed").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex("users_clerk_user_id_uidx").on(table.clerkUserId)]
);

/**
 * User preferences table storing timer defaults, timezone, theme, and explicit tracking consent.
 */
export const userPreferences = pgTable(
  "user_preferences",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    timezone: text("timezone").notNull().default("UTC"),
    theme: text("theme").notNull().default("ember-dark"),
    pomodoroMinutes: integer("pomodoro_minutes").notNull().default(25),
    shortBreakMinutes: integer("short_break_minutes").notNull().default(5),
    longBreakMinutes: integer("long_break_minutes").notNull().default(15),
    dailyFocusGoalMinutes: integer("daily_focus_goal_minutes").notNull().default(120),
    companionStyle: text("companion_style").notNull().default("classic-flame"),
    soundscapePreference: text("soundscape_preference").notNull().default("none"),
    extensionTrackingConsent: boolean("extension_tracking_consent")
      .notNull()
      .default(false),
    extensionConsentUpdatedAt: timestamp("extension_consent_updated_at", {
      withTimezone: true,
    }),
    notificationsEnabled: boolean("notifications_enabled").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex("user_preferences_user_id_uidx").on(table.userId)]
);

/**
 * Extension & Windows desktop tracker devices with revocable SHA-256 hashed bearer tokens.
 */
export const extensionDevices = pgTable(
  "extension_devices",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    deviceName: text("device_name").notNull(),
    deviceType: text("device_type").notNull().default("chrome_extension"),
    browser: text("browser").notNull().default("chrome"),
    tokenHash: text("token_hash").notNull(),
    status: text("status").notNull().default("pending"),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("extension_devices_token_hash_uidx").on(table.tokenHash),
    index("extension_devices_user_id_idx").on(table.userId),
    index("extension_devices_status_idx").on(table.status),
  ]
);

/**
 * Short-lived one-time pairing codes hashed at rest for device linking.
 */
export const devicePairingCodes = pgTable(
  "device_pairing_codes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    codeHash: text("code_hash").notNull(),
    deviceType: text("device_type").notNull().default("chrome_extension"),
    suggestedName: text("suggested_name"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("device_pairing_codes_code_hash_uidx").on(table.codeHash),
    index("device_pairing_codes_user_expires_idx").on(table.userId, table.expiresAt),
  ]
);

/**
 * Daily website hostname totals aggregated per paired extension device (no full URLs/paths).
 */
export const websiteUsageDaily = pgTable(
  "website_usage_daily",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    deviceId: uuid("device_id")
      .notNull()
      .references(() => extensionDevices.id, { onDelete: "cascade" }),
    localDate: text("local_date").notNull(),
    hostname: text("hostname").notNull(),
    activeSeconds: integer("active_seconds").notNull().default(0),
    visitCount: integer("visit_count").notNull().default(1),
    lastUpdatedAt: timestamp("last_updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("website_usage_daily_device_date_host_uidx").on(
      table.userId,
      table.deviceId,
      table.localDate,
      table.hostname
    ),
    index("website_usage_daily_user_date_idx").on(table.userId, table.localDate),
  ]
);

/**
 * Daily Windows desktop application usage aggregated per paired tracker device.
 */
export const appUsageDaily = pgTable(
  "app_usage_daily",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    deviceId: uuid("device_id")
      .notNull()
      .references(() => extensionDevices.id, { onDelete: "cascade" }),
    localDate: text("local_date").notNull(),
    appName: text("app_name").notNull(),
    displayName: text("display_name").notNull(),
    activeSeconds: integer("active_seconds").notNull().default(0),
    launchCount: integer("launch_count").notNull().default(1),
    lastUpdatedAt: timestamp("last_updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("app_usage_daily_device_date_app_uidx").on(
      table.userId,
      table.deviceId,
      table.localDate,
      table.appName
    ),
    index("app_usage_daily_user_date_idx").on(table.userId, table.localDate),
  ]
);

/**
 * User-defined productive/neutral/distracting classifications for hostnames and desktop apps.
 */
export const websiteCategories = pgTable(
  "website_categories",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    targetType: text("target_type").notNull().default("website"),
    pattern: text("pattern").notNull(),
    category: text("category").notNull().default("neutral"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("website_categories_user_target_pattern_uidx").on(
      table.userId,
      table.targetType,
      table.pattern
    ),
  ]
);

/**
 * Study and productivity tasks with optional time-block planning coordinates.
 */
export const tasks = pgTable(
  "tasks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    category: text("category").notNull().default("Study"),
    color: text("color").notNull().default("#38BDF8"),
    priority: text("priority").notNull().default("medium"),
    status: text("status").notNull().default("todo"),
    plannedMinutes: integer("planned_minutes").notNull().default(30),
    scheduledDate: text("scheduled_date"),
    plannedStartMinute: integer("planned_start_minute"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("tasks_user_scheduled_date_idx").on(table.userId, table.scheduledDate),
    index("tasks_user_status_idx").on(table.userId, table.status),
  ]
);

/**
 * Persistent timestamp-anchored focus sessions.
 */
export const focusSessions = pgTable(
  "focus_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    taskId: uuid("task_id").references(() => tasks.id, { onDelete: "set null" }),
    mode: text("mode").notNull(),
    status: text("status").notNull(),
    plannedDurationSeconds: integer("planned_duration_seconds"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    lastResumedAt: timestamp("last_resumed_at", { withTimezone: true }),
    accumulatedSeconds: integer("accumulated_seconds").notNull().default(0),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    localDate: text("local_date").notNull(),
    label: text("label"),
    notes: text("notes"),
    soundscape: text("soundscape").notNull().default("none"),
    xpEarned: integer("xp_earned").notNull().default(0),
    completionIdempotencyKey: text("completion_idempotency_key"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("focus_sessions_user_status_idx").on(table.userId, table.status),
    index("focus_sessions_user_local_date_idx").on(table.userId, table.localDate),
    index("focus_sessions_user_started_at_idx").on(table.userId, table.startedAt),
    uniqueIndex("focus_sessions_user_idempotency_uidx").on(
      table.userId,
      table.completionIdempotencyKey
    ),
  ]
);

/**
 * Custom user habits with weekday schedule and daily step targets.
 */
export const habits = pgTable(
  "habits",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    category: text("category").notNull().default("Betterment"),
    icon: text("icon").notNull().default("check"),
    color: text("color").notNull().default("#10B981"),
    scheduleType: text("schedule_type").notNull().default("daily"),
    scheduledDays: integer("scheduled_days").array().notNull().default([0, 1, 2, 3, 4, 5, 6]),
    targetPerDay: integer("target_per_day").notNull().default(1),
    archived: boolean("archived").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("habits_user_archived_idx").on(table.userId, table.archived)]
);

/**
 * Daily local-calendar habit check-ins (strictly one row per habit per user per localDate).
 */
export const habitEntries = pgTable(
  "habit_entries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    habitId: uuid("habit_id")
      .notNull()
      .references(() => habits.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    localDate: text("local_date").notNull(),
    status: text("status").notNull(),
    progressCount: integer("progress_count").notNull().default(1),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("habit_entries_habit_user_date_uidx").on(
      table.habitId,
      table.userId,
      table.localDate
    ),
    index("habit_entries_user_local_date_idx").on(table.userId, table.localDate),
  ]
);

/**
 * Daily and weekly focus goals.
 */
export const goals = pgTable(
  "goals",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    periodType: text("period_type").notNull(),
    periodKey: text("period_key").notNull(),
    targetMinutes: integer("target_minutes").notNull(),
    targetSessions: integer("target_sessions").notNull().default(0),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("goals_user_period_uidx").on(
      table.userId,
      table.periodType,
      table.periodKey
    ),
  ]
);

/**
 * Server-authoritative aggregate user gamification state.
 */
export const userProgress = pgTable("user_progress", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  totalXp: integer("total_xp").notNull().default(0),
  level: integer("level").notNull().default(1),
  currentFocusStreakDays: integer("current_focus_streak_days").notNull().default(0),
  bestFocusStreakDays: integer("best_focus_streak_days").notNull().default(0),
  lastQualifyingFocusDate: text("last_qualifying_focus_date"),
  unlockedCosmetics: text("unlocked_cosmetics")
    .array()
    .notNull()
    .default(["classic-flame"]),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

/**
 * Idempotent XP event ledger preventing duplicate rewards.
 */
export const xpEvents = pgTable(
  "xp_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    eventType: text("event_type").notNull(),
    xpDelta: integer("xp_delta").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("xp_events_user_idempotency_uidx").on(
      table.userId,
      table.idempotencyKey
    ),
    index("xp_events_user_created_at_idx").on(table.userId, table.createdAt),
  ]
);

/**
 * Canonical achievements catalog.
 */
export const achievements = pgTable("achievements", {
  code: text("code").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  icon: text("icon").notNull(),
  xpReward: integer("xp_reward").notNull(),
  category: text("category").notNull(),
  threshold: integer("threshold").notNull(),
});

/**
 * User-unlocked achievements.
 */
export const userAchievements = pgTable(
  "user_achievements",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    achievementCode: text("achievement_code")
      .notNull()
      .references(() => achievements.code, { onDelete: "cascade" }),
    unlockedAt: timestamp("unlocked_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("user_achievements_user_code_uidx").on(
      table.userId,
      table.achievementCode
    ),
  ]
);

/**
 * Configurable user reminder schedules & quiet hours preferences.
 */
export const userReminderPreferences = pgTable("user_reminder_preferences", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  notificationsEnabled: boolean("notifications_enabled").notNull().default(true),
  focusReminderEnabled: boolean("focus_reminder_enabled").notNull().default(false),
  focusReminderTime: text("focus_reminder_time").notNull().default("09:30"),
  breakReminderEnabled: boolean("break_reminder_enabled").notNull().default(true),
  breakIntervalMinutes: integer("break_interval_minutes").notNull().default(50),
  dailyGoalReminderEnabled: boolean("daily_goal_reminder_enabled").notNull().default(false),
  dailyGoalReminderTime: text("daily_goal_reminder_time").notNull().default("18:00"),
  habitReminderEnabled: boolean("habit_reminder_enabled").notNull().default(false),
  habitReminderTime: text("habit_reminder_time").notNull().default("20:00"),
  quietHoursEnabled: boolean("quiet_hours_enabled").notNull().default(true),
  quietHoursStart: text("quiet_hours_start").notNull().default("22:00"),
  quietHoursEnd: text("quiet_hours_end").notNull().default("07:30"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type DbUser = typeof users.$inferSelect;
export type NewDbUser = typeof users.$inferInsert;
export type DbUserPreferences = typeof userPreferences.$inferSelect;
export type NewDbUserPreferences = typeof userPreferences.$inferInsert;
export type DbUserReminderPreferences = typeof userReminderPreferences.$inferSelect;
export type DbExtensionDevice = typeof extensionDevices.$inferSelect;
export type DbDevicePairingCode = typeof devicePairingCodes.$inferSelect;
export type DbWebsiteUsageDaily = typeof websiteUsageDaily.$inferSelect;
export type DbAppUsageDaily = typeof appUsageDaily.$inferSelect;
export type DbWebsiteCategory = typeof websiteCategories.$inferSelect;
export type DbTask = typeof tasks.$inferSelect;
export type DbFocusSession = typeof focusSessions.$inferSelect;
export type DbHabit = typeof habits.$inferSelect;
export type DbHabitEntry = typeof habitEntries.$inferSelect;
export type DbGoal = typeof goals.$inferSelect;
export type DbUserProgress = typeof userProgress.$inferSelect;
