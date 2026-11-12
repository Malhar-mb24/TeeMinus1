import {
  completeOnboardingSchema,
  type CompleteOnboardingInput,
} from "@ember/shared";
import { eq } from "drizzle-orm";
import { getDb, type EmberDatabase } from "./client";
import { ensureAchievementsCatalog, ensureUserProgressRow } from "./gamification";
import {
  appUsageDaily,
  extensionDevices,
  focusSessions,
  goals,
  habitEntries,
  habits,
  tasks,
  userAchievements,
  userPreferences,
  userProgress,
  users,
  websiteCategories,
  websiteUsageDaily,
  xpEvents,
} from "./schema";

export async function completeOnboardingForUser(
  userId: string,
  rawInput: CompleteOnboardingInput,
  dbOverride?: EmberDatabase
) {
  const input = completeOnboardingSchema.parse(rawInput);
  const db = dbOverride ?? getDb();
  const now = new Date();

  return db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({
        onboardingCompleted: true,
        updatedAt: now,
      })
      .where(eq(users.id, userId));

    const [updatedPrefs] = await tx
      .update(userPreferences)
      .set({
        timezone: input.timezone,
        pomodoroMinutes: input.pomodoroMinutes,
        shortBreakMinutes: input.shortBreakMinutes,
        longBreakMinutes: input.longBreakMinutes,
        dailyFocusGoalMinutes: input.dailyFocusGoalMinutes,
        theme: input.theme,
        companionStyle: input.companionStyle,
        soundscapePreference: input.soundscapePreference,
        extensionTrackingConsent: input.extensionTrackingConsent,
        extensionConsentUpdatedAt: now,
        updatedAt: now,
      })
      .where(eq(userPreferences.userId, userId))
      .returning();

    await ensureAchievementsCatalog(tx);
    await ensureUserProgressRow(tx, userId);

    return updatedPrefs;
  });
}

/**
 * Exports all user-owned records in JSON format while stripping sensitive hashed credentials.
 */
export async function exportUserDataForUser(
  userId: string,
  dbOverride?: EmberDatabase
) {
  const db = dbOverride ?? getDb();

  const [profile] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  const [preferences] = await db
    .select()
    .from(userPreferences)
    .where(eq(userPreferences.userId, userId))
    .limit(1);
  const userTasks = await db.select().from(tasks).where(eq(tasks.userId, userId));
  const sessions = await db
    .select()
    .from(focusSessions)
    .where(eq(focusSessions.userId, userId));
  const userHabits = await db.select().from(habits).where(eq(habits.userId, userId));
  const entries = await db
    .select()
    .from(habitEntries)
    .where(eq(habitEntries.userId, userId));
  const userGoals = await db.select().from(goals).where(eq(goals.userId, userId));
  const [progress] = await db
    .select()
    .from(userProgress)
    .where(eq(userProgress.userId, userId))
    .limit(1);
  const rewards = await db.select().from(xpEvents).where(eq(xpEvents.userId, userId));
  const unlockedAchievements = await db
    .select()
    .from(userAchievements)
    .where(eq(userAchievements.userId, userId));
  const devices = await db
    .select({
      id: extensionDevices.id,
      deviceName: extensionDevices.deviceName,
      deviceType: extensionDevices.deviceType,
      browser: extensionDevices.browser,
      status: extensionDevices.status,
      lastSeenAt: extensionDevices.lastSeenAt,
      createdAt: extensionDevices.createdAt,
    })
    .from(extensionDevices)
    .where(eq(extensionDevices.userId, userId));

  const websiteUsage = await db
    .select()
    .from(websiteUsageDaily)
    .where(eq(websiteUsageDaily.userId, userId));

  const desktopAppUsage = await db
    .select()
    .from(appUsageDaily)
    .where(eq(appUsageDaily.userId, userId));

  const customCategories = await db
    .select()
    .from(websiteCategories)
    .where(eq(websiteCategories.userId, userId));

  return {
    exportedAt: new Date().toISOString(),
    profile: profile ?? null,
    preferences: preferences ?? null,
    tasks: userTasks,
    focusSessions: sessions,
    habits: userHabits,
    habitEntries: entries,
    goals: userGoals,
    progress: progress ?? null,
    xpEvents: rewards,
    achievements: unlockedAchievements,
    extensionDevices: devices,
    websiteUsageDaily: websiteUsage,
    appUsageDaily: desktopAppUsage,
    websiteCategories: customCategories,
  };
}
