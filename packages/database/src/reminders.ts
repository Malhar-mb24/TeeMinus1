import {
  DEFAULT_REMINDER_SETTINGS,
  reminderSettingsSchema,
  type ReminderSettingsDto,
  type ReminderSettingsInput,
} from "@ember/shared";
import { eq } from "drizzle-orm";
import { getDb, type EmberDatabase } from "./client";
import { userPreferences, userReminderPreferences } from "./schema";

export async function getReminderSettingsForUser(
  userId: string,
  dbOverride?: EmberDatabase
): Promise<ReminderSettingsDto> {
  const db = dbOverride ?? getDb();
  const [row] = await db
    .select()
    .from(userReminderPreferences)
    .where(eq(userReminderPreferences.userId, userId))
    .limit(1);

  if (!row) {
    const [prefs] = await db
      .select({ notificationsEnabled: userPreferences.notificationsEnabled })
      .from(userPreferences)
      .where(eq(userPreferences.userId, userId))
      .limit(1);

    return {
      ...DEFAULT_REMINDER_SETTINGS,
      notificationsEnabled: prefs?.notificationsEnabled ?? true,
    };
  }

  return {
    notificationsEnabled: row.notificationsEnabled,
    focusReminderEnabled: row.focusReminderEnabled,
    focusReminderTime: row.focusReminderTime,
    breakReminderEnabled: row.breakReminderEnabled,
    breakIntervalMinutes: row.breakIntervalMinutes,
    dailyGoalReminderEnabled: row.dailyGoalReminderEnabled,
    dailyGoalReminderTime: row.dailyGoalReminderTime,
    habitReminderEnabled: row.habitReminderEnabled,
    habitReminderTime: row.habitReminderTime,
    quietHoursEnabled: row.quietHoursEnabled,
    quietHoursStart: row.quietHoursStart,
    quietHoursEnd: row.quietHoursEnd,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function upsertReminderSettingsForUser(
  userId: string,
  rawInput: ReminderSettingsInput,
  dbOverride?: EmberDatabase
): Promise<ReminderSettingsDto> {
  const input = reminderSettingsSchema.parse(rawInput);
  const db = dbOverride ?? getDb();
  const now = new Date();

  const [saved] = await db.transaction(async (tx) => {
    await tx
      .update(userPreferences)
      .set({
        notificationsEnabled: input.notificationsEnabled,
        updatedAt: now,
      })
      .where(eq(userPreferences.userId, userId));

    return tx
      .insert(userReminderPreferences)
      .values({
        userId,
        ...input,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [userReminderPreferences.userId],
        set: {
          ...input,
          updatedAt: now,
        },
      })
      .returning();
  });

  if (!saved) {
    throw new Error("Failed to save reminder preferences.");
  }

  return {
    notificationsEnabled: saved.notificationsEnabled,
    focusReminderEnabled: saved.focusReminderEnabled,
    focusReminderTime: saved.focusReminderTime,
    breakReminderEnabled: saved.breakReminderEnabled,
    breakIntervalMinutes: saved.breakIntervalMinutes,
    dailyGoalReminderEnabled: saved.dailyGoalReminderEnabled,
    dailyGoalReminderTime: saved.dailyGoalReminderTime,
    habitReminderEnabled: saved.habitReminderEnabled,
    habitReminderTime: saved.habitReminderTime,
    quietHoursEnabled: saved.quietHoursEnabled,
    quietHoursStart: saved.quietHoursStart,
    quietHoursEnd: saved.quietHoursEnd,
    updatedAt: saved.updatedAt.toISOString(),
  };
}
