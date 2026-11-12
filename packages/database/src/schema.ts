import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * User profile mapping table linked to verified Clerk external identity.
 * Internal surrogate UUID primary key decouples relational ownership from external auth IDs.
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
 * Placeholder table for Chrome MV3 extension pairing and revocable hashed tokens (Batch 04).
 * Raw tokens are never stored; only cryptographic hashes are persisted.
 */
export const extensionDevices = pgTable(
  "extension_devices",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    deviceName: text("device_name").notNull(),
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

export type DbUser = typeof users.$inferSelect;
export type NewDbUser = typeof users.$inferInsert;
export type DbUserPreferences = typeof userPreferences.$inferSelect;
export type NewDbUserPreferences = typeof userPreferences.$inferInsert;
export type DbExtensionDevice = typeof extensionDevices.$inferSelect;
