import {
  DEFAULT_USER_PREFERENCES,
  updateUserPreferencesSchema,
  type CompanionStyle,
  type SoundscapePreference,
  type ThemeOption,
  type UpdateUserPreferencesInput,
  type UserPreferencesDto,
  type UserProfileDto,
} from "@ember/shared";
import { and, count, eq } from "drizzle-orm";
import { getDb, type EmberDatabase } from "./client";
import {
  extensionDevices,
  userPreferences,
  userProgress,
  users,
  type DbUser,
  type DbUserPreferences,
} from "./schema";

export interface VerifiedIdentityInput {
  clerkUserId: string;
  email?: string | null;
  displayName?: string | null;
  avatarUrl?: string | null;
}

export interface UserContextDto {
  profile: UserProfileDto;
  preferences: UserPreferencesDto;
  extensionDeviceCount: number;
}

function mapUserDto(row: DbUser): UserProfileDto {
  return {
    id: row.id,
    clerkUserId: row.clerkUserId,
    email: row.email,
    displayName: row.displayName,
    avatarUrl: row.avatarUrl,
    onboardingCompleted: row.onboardingCompleted,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function mapPreferencesDto(row: DbUserPreferences): UserPreferencesDto {
  return {
    id: row.id,
    userId: row.userId,
    timezone: row.timezone,
    theme: row.theme as ThemeOption,
    pomodoroMinutes: row.pomodoroMinutes,
    shortBreakMinutes: row.shortBreakMinutes,
    longBreakMinutes: row.longBreakMinutes,
    dailyFocusGoalMinutes: row.dailyFocusGoalMinutes,
    companionStyle: row.companionStyle as CompanionStyle,
    soundscapePreference: row.soundscapePreference as SoundscapePreference,
    extensionTrackingConsent: row.extensionTrackingConsent,
    extensionConsentUpdatedAt: row.extensionConsentUpdatedAt
      ? row.extensionConsentUpdatedAt.toISOString()
      : null,
    notificationsEnabled: row.notificationsEnabled,
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * Idempotently provisions or retrieves a user profile and default preferences
 * using ONLY server-verified Clerk identity claims.
 */
export async function ensureUserProfile(
  identity: VerifiedIdentityInput,
  dbOverride?: EmberDatabase
): Promise<UserContextDto> {
  if (!identity.clerkUserId) {
    throw new Error("Verified clerkUserId is required");
  }

  const db = dbOverride ?? getDb();

  return db.transaction(async (tx) => {
    await tx
      .insert(users)
      .values({
        clerkUserId: identity.clerkUserId,
        email: identity.email ?? null,
        displayName: identity.displayName ?? null,
        avatarUrl: identity.avatarUrl ?? null,
      })
      .onConflictDoNothing({ target: users.clerkUserId });

    const [existingUser] = await tx
      .select()
      .from(users)
      .where(eq(users.clerkUserId, identity.clerkUserId))
      .limit(1);

    if (!existingUser) {
      throw new Error("Failed to provision or retrieve user profile");
    }

    const shouldSyncIdentityMetadata =
      (identity.email !== undefined && identity.email !== existingUser.email) ||
      (identity.displayName !== undefined &&
        identity.displayName !== existingUser.displayName) ||
      (identity.avatarUrl !== undefined && identity.avatarUrl !== existingUser.avatarUrl);

    let currentUser = existingUser;
    if (shouldSyncIdentityMetadata) {
      const [updated] = await tx
        .update(users)
        .set({
          email: identity.email ?? existingUser.email,
          displayName: identity.displayName ?? existingUser.displayName,
          avatarUrl: identity.avatarUrl ?? existingUser.avatarUrl,
          updatedAt: new Date(),
        })
        .where(eq(users.id, existingUser.id))
        .returning();

      if (updated) {
        currentUser = updated;
      }
    }

    await tx
      .insert(userPreferences)
      .values({
        userId: currentUser.id,
        timezone: DEFAULT_USER_PREFERENCES.timezone,
        theme: DEFAULT_USER_PREFERENCES.theme,
        pomodoroMinutes: DEFAULT_USER_PREFERENCES.pomodoroMinutes,
        shortBreakMinutes: DEFAULT_USER_PREFERENCES.shortBreakMinutes,
        longBreakMinutes: DEFAULT_USER_PREFERENCES.longBreakMinutes,
        dailyFocusGoalMinutes: DEFAULT_USER_PREFERENCES.dailyFocusGoalMinutes,
        companionStyle: DEFAULT_USER_PREFERENCES.companionStyle,
        soundscapePreference: DEFAULT_USER_PREFERENCES.soundscapePreference,
        extensionTrackingConsent: DEFAULT_USER_PREFERENCES.extensionTrackingConsent,
        notificationsEnabled: DEFAULT_USER_PREFERENCES.notificationsEnabled,
      })
      .onConflictDoNothing({ target: userPreferences.userId });

    const [prefs] = await tx
      .select()
      .from(userPreferences)
      .where(eq(userPreferences.userId, currentUser.id))
      .limit(1);

    if (!prefs) {
      throw new Error("Failed to provision or retrieve user preferences");
    }

    await tx
      .insert(userProgress)
      .values({
        userId: currentUser.id,
        totalXp: 0,
        level: 1,
        currentFocusStreakDays: 0,
        bestFocusStreakDays: 0,
        unlockedCosmetics: ["classic-flame"],
      })
      .onConflictDoNothing({ target: userProgress.userId });

    const [deviceAggregate] = await tx
      .select({ total: count() })
      .from(extensionDevices)
      .where(
        and(
          eq(extensionDevices.userId, currentUser.id),
          eq(extensionDevices.status, "active")
        )
      );

    return {
      profile: mapUserDto(currentUser),
      preferences: mapPreferencesDto(prefs),
      extensionDeviceCount: Number(deviceAggregate?.total ?? 0),
    };
  });
}

/**
 * Updates preferences strictly scoped to the verified internal user ID.
 */
export async function updateUserPreferencesForUser(
  internalUserId: string,
  rawInput: UpdateUserPreferencesInput,
  dbOverride?: EmberDatabase
): Promise<UserPreferencesDto> {
  const input = updateUserPreferencesSchema.parse(rawInput);
  const db = dbOverride ?? getDb();

  const updateFields: Partial<typeof userPreferences.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (input.timezone !== undefined) updateFields.timezone = input.timezone;
  if (input.theme !== undefined) updateFields.theme = input.theme;
  if (input.pomodoroMinutes !== undefined) {
    updateFields.pomodoroMinutes = input.pomodoroMinutes;
  }
  if (input.shortBreakMinutes !== undefined) {
    updateFields.shortBreakMinutes = input.shortBreakMinutes;
  }
  if (input.longBreakMinutes !== undefined) {
    updateFields.longBreakMinutes = input.longBreakMinutes;
  }
  if (input.dailyFocusGoalMinutes !== undefined) {
    updateFields.dailyFocusGoalMinutes = input.dailyFocusGoalMinutes;
  }
  if (input.companionStyle !== undefined) {
    updateFields.companionStyle = input.companionStyle;
  }
  if (input.soundscapePreference !== undefined) {
    updateFields.soundscapePreference = input.soundscapePreference;
  }
  if (input.notificationsEnabled !== undefined) {
    updateFields.notificationsEnabled = input.notificationsEnabled;
  }
  if (input.extensionTrackingConsent !== undefined) {
    updateFields.extensionTrackingConsent = input.extensionTrackingConsent;
    updateFields.extensionConsentUpdatedAt = new Date();
  }

  const [updated] = await db
    .update(userPreferences)
    .set(updateFields)
    .where(eq(userPreferences.userId, internalUserId))
    .returning();

  if (!updated) {
    throw new Error("Preferences record not found for authenticated user");
  }

  return mapPreferencesDto(updated);
}
