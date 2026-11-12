import { createHash, randomBytes, randomInt } from "node:crypto";
import {
  addDaysToDateKey,
  classifyUsageTarget,
  getDateKeysRange,
  getDayOfWeekFromDateKey,
  getDesktopAppDisplayName,
  getLocalDateKey,
  normalizeDesktopAppName,
  normalizeHostnamePattern,
  type CreatePairingCodeInput,
  type DeviceType,
  type PairDeviceInput,
  type PairedDeviceDto,
  type PairingCodeResponseDto,
  type SyncDesktopAppEntryInput,
  type SyncWellbeingResultDto,
  type SyncWebsiteEntryInput,
  type UpsertCategoryInput,
  type UsageCategory,
  type UsageTargetType,
  type WellbeingDailyTrendDto,
  type WellbeingSummaryDto,
  type WellbeingUsageItemDto,
} from "@ember/shared";
import { and, desc, eq, gte, isNull, lte, sql } from "drizzle-orm";
import { getDb, type EmberDatabase } from "./client";
import {
  appUsageDaily,
  devicePairingCodes,
  extensionDevices,
  focusSessions,
  userPreferences,
  websiteCategories,
  websiteUsageDaily,
} from "./schema";

const SHORT_WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const PAIRING_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export class WellbeingServiceError extends Error {
  readonly code:
    | "INVALID_PAIRING_CODE"
    | "PAIRING_CODE_EXPIRED"
    | "CONSENT_REQUIRED"
    | "INVALID_PATTERN"
    | "DEVICE_NOT_FOUND";
  readonly status: number;

  constructor(
    code: WellbeingServiceError["code"],
    message: string,
    status: number
  ) {
    super(message);
    this.name = "WellbeingServiceError";
    this.code = code;
    this.status = status;
  }
}

export function hashSecretToken(rawToken: string): string {
  return createHash("sha256").update(rawToken, "utf8").digest("hex");
}

export function generatePairingCode(): string {
  let chars = "";
  for (let i = 0; i < 8; i += 1) {
    chars += PAIRING_ALPHABET[randomInt(0, PAIRING_ALPHABET.length)] ?? "A";
  }
  return `${chars.slice(0, 4)}-${chars.slice(4, 8)}`;
}

export function generateDeviceBearerToken(): string {
  return `emb_dev_${randomBytes(32).toString("hex")}`;
}

function serializeDevice(row: typeof extensionDevices.$inferSelect): PairedDeviceDto {
  return {
    id: row.id,
    deviceName: row.deviceName,
    deviceType: row.deviceType === "windows_desktop" ? "windows_desktop" : "chrome_extension",
    browser: row.browser,
    status: row.status,
    lastSeenAt: row.lastSeenAt ? row.lastSeenAt.toISOString() : null,
    revokedAt: row.revokedAt ? row.revokedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function createPairingCodeForUser(
  userId: string,
  input: CreatePairingCodeInput,
  dbOverride?: EmberDatabase
): Promise<PairingCodeResponseDto> {
  const db = dbOverride ?? getDb();
  const code = generatePairingCode();
  const normalizedCode = code.replace(/[^A-Z0-9]/g, "");
  const codeHash = hashSecretToken(normalizedCode);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 10 * 60 * 1000);

  // Prune expired pairing codes for this user so unused codes do not accumulate.
  await db
    .delete(devicePairingCodes)
    .where(and(eq(devicePairingCodes.userId, userId), lte(devicePairingCodes.expiresAt, now)));

  await db.insert(devicePairingCodes).values({
    userId,
    codeHash,
    deviceType: input.deviceType,
    suggestedName: input.deviceName ?? null,
    expiresAt,
  });

  return {
    code,
    deviceType: input.deviceType,
    expiresAt: expiresAt.toISOString(),
  };
}

export async function pairDeviceWithCode(
  input: PairDeviceInput,
  dbOverride?: EmberDatabase
): Promise<{ device: PairedDeviceDto; bearerToken: string; userId: string }> {
  const db = dbOverride ?? getDb();
  const normalizedCode = input.pairingCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  const codeHash = hashSecretToken(normalizedCode);
  const now = new Date();

  return db.transaction(async (tx) => {
    const [pairingRow] = await tx
      .select()
      .from(devicePairingCodes)
      .where(eq(devicePairingCodes.codeHash, codeHash))
      .limit(1);

    if (!pairingRow) {
      throw new WellbeingServiceError(
        "INVALID_PAIRING_CODE",
        "Invalid pairing code.",
        401
      );
    }
    if (pairingRow.consumedAt !== null || pairingRow.expiresAt.getTime() <= now.getTime()) {
      throw new WellbeingServiceError(
        "PAIRING_CODE_EXPIRED",
        "Pairing code has expired or was already used.",
        401
      );
    }

    const [consumed] = await tx
      .update(devicePairingCodes)
      .set({ consumedAt: now })
      .where(
        and(
          eq(devicePairingCodes.id, pairingRow.id),
          isNull(devicePairingCodes.consumedAt)
        )
      )
      .returning({ id: devicePairingCodes.id });

    if (!consumed) {
      throw new WellbeingServiceError(
        "PAIRING_CODE_EXPIRED",
        "Pairing code was already redeemed.",
        401
      );
    }

    const bearerToken = generateDeviceBearerToken();
    const tokenHash = hashSecretToken(bearerToken);
    const resolvedType: DeviceType =
      input.deviceType ||
      (pairingRow.deviceType === "windows_desktop" ? "windows_desktop" : "chrome_extension");

    const [insertedDevice] = await tx
      .insert(extensionDevices)
      .values({
        userId: pairingRow.userId,
        deviceName: input.deviceName.trim() || pairingRow.suggestedName || "Ember Device",
        deviceType: resolvedType,
        browser:
          resolvedType === "windows_desktop" ? "windows" : input.browser.trim() || "chrome",
        tokenHash,
        status: "active",
        lastSeenAt: now,
        updatedAt: now,
      })
      .returning();

    if (!insertedDevice) {
      throw new Error("Failed to insert paired device record.");
    }

    return {
      device: serializeDevice(insertedDevice),
      bearerToken,
      userId: pairingRow.userId,
    };
  });
}

export interface AuthenticatedDeviceContext {
  deviceId: string;
  userId: string;
  deviceName: string;
  deviceType: DeviceType;
  syncConsentEnabled: boolean;
  timezone: string;
}

export async function authenticateDeviceToken(
  rawBearerToken: string,
  dbOverride?: EmberDatabase
): Promise<AuthenticatedDeviceContext | null> {
  const trimmed = rawBearerToken.trim();
  if (!trimmed.startsWith("emb_dev_") || trimmed.length < 32) {
    return null;
  }

  const db = dbOverride ?? getDb();
  const tokenHash = hashSecretToken(trimmed);

  const [row] = await db
    .select({
      deviceId: extensionDevices.id,
      userId: extensionDevices.userId,
      deviceName: extensionDevices.deviceName,
      deviceType: extensionDevices.deviceType,
      status: extensionDevices.status,
      revokedAt: extensionDevices.revokedAt,
      syncConsentEnabled: userPreferences.extensionTrackingConsent,
      timezone: userPreferences.timezone,
    })
    .from(extensionDevices)
    .leftJoin(userPreferences, eq(userPreferences.userId, extensionDevices.userId))
    .where(eq(extensionDevices.tokenHash, tokenHash))
    .limit(1);

  if (!row || row.status !== "active" || row.revokedAt !== null) {
    return null;
  }

  return {
    deviceId: row.deviceId,
    userId: row.userId,
    deviceName: row.deviceName,
    deviceType: row.deviceType === "windows_desktop" ? "windows_desktop" : "chrome_extension",
    syncConsentEnabled: Boolean(row.syncConsentEnabled),
    timezone: row.timezone ?? "UTC",
  };
}

export async function listDevicesForUser(
  userId: string,
  dbOverride?: EmberDatabase
): Promise<PairedDeviceDto[]> {
  const db = dbOverride ?? getDb();
  const rows = await db
    .select()
    .from(extensionDevices)
    .where(eq(extensionDevices.userId, userId))
    .orderBy(desc(extensionDevices.createdAt));

  return rows.map(serializeDevice);
}

export async function revokeDeviceForUser(
  userId: string,
  deviceId: string,
  dbOverride?: EmberDatabase
): Promise<PairedDeviceDto | null> {
  const db = dbOverride ?? getDb();
  const now = new Date();

  const [updated] = await db
    .update(extensionDevices)
    .set({
      status: "revoked",
      revokedAt: now,
      updatedAt: now,
    })
    .where(and(eq(extensionDevices.id, deviceId), eq(extensionDevices.userId, userId)))
    .returning();

  return updated ? serializeDevice(updated) : null;
}

export async function syncDeviceWellbeingData(
  params: {
    userId: string;
    deviceId: string;
    syncConsentEnabled: boolean;
    entries: SyncWebsiteEntryInput[];
    appEntries: SyncDesktopAppEntryInput[];
  },
  dbOverride?: EmberDatabase
): Promise<SyncWellbeingResultDto> {
  if (!params.syncConsentEnabled) {
    throw new WellbeingServiceError(
      "CONSENT_REQUIRED",
      "Sync consent is disabled. Enable wellbeing sync in Ember Settings or Wellbeing first.",
      403
    );
  }

  const db = dbOverride ?? getDb();
  const now = new Date();

  // Coalesce duplicate entries inside the same batch before writing.
  const mergedWebsites = new Map<string, SyncWebsiteEntryInput>();
  for (const entry of params.entries) {
    const key = `${entry.localDate}|${entry.hostname}`;
    const existing = mergedWebsites.get(key);
    if (!existing) {
      mergedWebsites.set(key, { ...entry });
    } else {
      existing.activeSeconds = Math.min(
        86400,
        Math.max(existing.activeSeconds, entry.activeSeconds)
      );
      existing.visitCount = Math.max(existing.visitCount, entry.visitCount);
    }
  }

  const mergedApps = new Map<string, SyncDesktopAppEntryInput>();
  for (const entry of params.appEntries) {
    const key = `${entry.localDate}|${entry.appName}`;
    const existing = mergedApps.get(key);
    if (!existing) {
      mergedApps.set(key, { ...entry });
    } else {
      existing.activeSeconds = Math.min(
        86400,
        Math.max(existing.activeSeconds, entry.activeSeconds)
      );
      existing.launchCount = Math.max(existing.launchCount, entry.launchCount);
      if (entry.displayName && !existing.displayName) {
        existing.displayName = entry.displayName;
      }
    }
  }

  await db.transaction(async (tx) => {
    const websiteValues = Array.from(mergedWebsites.values()).map((entry) => ({
      userId: params.userId,
      deviceId: params.deviceId,
      localDate: entry.localDate,
      hostname: entry.hostname,
      activeSeconds: entry.activeSeconds,
      visitCount: entry.visitCount,
      lastUpdatedAt: now,
    }));

    if (websiteValues.length > 0) {
      await tx
        .insert(websiteUsageDaily)
        .values(websiteValues)
        .onConflictDoUpdate({
          target: [
            websiteUsageDaily.userId,
            websiteUsageDaily.deviceId,
            websiteUsageDaily.localDate,
            websiteUsageDaily.hostname,
          ],
          set: {
            activeSeconds: sql`GREATEST(${websiteUsageDaily.activeSeconds}, excluded.active_seconds)`,
            visitCount: sql`GREATEST(${websiteUsageDaily.visitCount}, excluded.visit_count)`,
            lastUpdatedAt: now,
          },
        });
    }

    const appValues = Array.from(mergedApps.values()).map((entry) => ({
      userId: params.userId,
      deviceId: params.deviceId,
      localDate: entry.localDate,
      appName: entry.appName,
      displayName: getDesktopAppDisplayName(entry.appName, entry.displayName),
      activeSeconds: entry.activeSeconds,
      launchCount: entry.launchCount,
      lastUpdatedAt: now,
    }));

    if (appValues.length > 0) {
      await tx
        .insert(appUsageDaily)
        .values(appValues)
        .onConflictDoUpdate({
          target: [
            appUsageDaily.userId,
            appUsageDaily.deviceId,
            appUsageDaily.localDate,
            appUsageDaily.appName,
          ],
          set: {
            displayName: sql`excluded.display_name`,
            activeSeconds: sql`GREATEST(${appUsageDaily.activeSeconds}, excluded.active_seconds)`,
            launchCount: sql`GREATEST(${appUsageDaily.launchCount}, excluded.launch_count)`,
            lastUpdatedAt: now,
          },
        });
    }

    await tx
      .update(extensionDevices)
      .set({
        lastSeenAt: now,
        updatedAt: now,
      })
      .where(
        and(
          eq(extensionDevices.id, params.deviceId),
          eq(extensionDevices.userId, params.userId)
        )
      );
  });

  return {
    deviceId: params.deviceId,
    syncedWebsiteRows: mergedWebsites.size,
    syncedDesktopAppRows: mergedApps.size,
    lastSeenAt: now.toISOString(),
  };
}

export async function upsertUsageCategoryForUser(
  userId: string,
  input: UpsertCategoryInput,
  dbOverride?: EmberDatabase
): Promise<{
  targetType: UsageTargetType;
  pattern: string;
  category: UsageCategory;
}> {
  const db = dbOverride ?? getDb();
  const normalizedPattern =
    input.targetType === "website"
      ? normalizeHostnamePattern(input.pattern)
      : normalizeDesktopAppName(input.pattern);

  if (!normalizedPattern) {
    throw new WellbeingServiceError(
      "INVALID_PATTERN",
      "Invalid website hostname or desktop application identifier.",
      400
    );
  }

  const now = new Date();
  await db
    .insert(websiteCategories)
    .values({
      userId,
      targetType: input.targetType,
      pattern: normalizedPattern,
      category: input.category,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [
        websiteCategories.userId,
        websiteCategories.targetType,
        websiteCategories.pattern,
      ],
      set: {
        category: input.category,
        updatedAt: now,
      },
    });

  return {
    targetType: input.targetType,
    pattern: normalizedPattern,
    category: input.category,
  };
}

export async function deleteWellbeingDataForUser(
  userId: string,
  dbOverride?: EmberDatabase
): Promise<{ deletedWebsiteRows: number; deletedAppRows: number }> {
  const db = dbOverride ?? getDb();
  return db.transaction(async (tx) => {
    const deletedWebsites = await tx
      .delete(websiteUsageDaily)
      .where(eq(websiteUsageDaily.userId, userId))
      .returning({ id: websiteUsageDaily.id });

    const deletedApps = await tx
      .delete(appUsageDaily)
      .where(eq(appUsageDaily.userId, userId))
      .returning({ id: appUsageDaily.id });

    return {
      deletedWebsiteRows: deletedWebsites.length,
      deletedAppRows: deletedApps.length,
    };
  });
}

export async function getWellbeingSummaryForUser(
  userId: string,
  timezone: string,
  rangeDays = 7,
  dbOverride?: EmberDatabase
): Promise<WellbeingSummaryDto> {
  const safeRangeDays = Math.min(30, Math.max(1, Math.floor(rangeDays)));
  const db = dbOverride ?? getDb();
  const todayDate = getLocalDateKey(new Date(), timezone);
  const startDate = addDaysToDateKey(todayDate, -(safeRangeDays - 1));
  const dateKeys = getDateKeysRange(todayDate, safeRangeDays);

  const [prefsRows, websiteRows, appRows, categoryRows, focusRows, deviceRows] =
    await Promise.all([
      db
        .select({ extensionTrackingConsent: userPreferences.extensionTrackingConsent })
        .from(userPreferences)
        .where(eq(userPreferences.userId, userId))
        .limit(1),
      db
        .select({
          localDate: websiteUsageDaily.localDate,
          hostname: websiteUsageDaily.hostname,
          activeSeconds: websiteUsageDaily.activeSeconds,
          visitCount: websiteUsageDaily.visitCount,
          lastUpdatedAt: websiteUsageDaily.lastUpdatedAt,
        })
        .from(websiteUsageDaily)
        .where(
          and(
            eq(websiteUsageDaily.userId, userId),
            gte(websiteUsageDaily.localDate, startDate)
          )
        ),
      db
        .select({
          localDate: appUsageDaily.localDate,
          appName: appUsageDaily.appName,
          displayName: appUsageDaily.displayName,
          activeSeconds: appUsageDaily.activeSeconds,
          launchCount: appUsageDaily.launchCount,
          lastUpdatedAt: appUsageDaily.lastUpdatedAt,
        })
        .from(appUsageDaily)
        .where(
          and(eq(appUsageDaily.userId, userId), gte(appUsageDaily.localDate, startDate))
        ),
      db
        .select({
          targetType: websiteCategories.targetType,
          pattern: websiteCategories.pattern,
          category: websiteCategories.category,
        })
        .from(websiteCategories)
        .where(eq(websiteCategories.userId, userId)),
      db
        .select({
          localDate: focusSessions.localDate,
          accumulatedSeconds: focusSessions.accumulatedSeconds,
        })
        .from(focusSessions)
        .where(
          and(
            eq(focusSessions.userId, userId),
            gte(focusSessions.localDate, startDate)
          )
        ),
      db
        .select()
        .from(extensionDevices)
        .where(eq(extensionDevices.userId, userId))
        .orderBy(desc(extensionDevices.createdAt)),
    ]);

  const customRules = categoryRows.map((row) => ({
    targetType: (row.targetType === "desktop_app"
      ? "desktop_app"
      : "website") as UsageTargetType,
    pattern: row.pattern,
    category: (row.category === "productive" || row.category === "distracting"
      ? row.category
      : "neutral") as UsageCategory,
  }));

  const trendMap = new Map<string, WellbeingDailyTrendDto>();
  for (const dateKey of dateKeys) {
    trendMap.set(dateKey, {
      localDate: dateKey,
      dayLabel: SHORT_WEEKDAY_LABELS[getDayOfWeekFromDateKey(dateKey)] ?? "Day",
      websiteSeconds: 0,
      desktopSeconds: 0,
      totalSeconds: 0,
      focusSeconds: 0,
      productiveSeconds: 0,
      neutralSeconds: 0,
      distractingSeconds: 0,
    });
  }

  for (const row of focusRows) {
    const bucket = trendMap.get(row.localDate);
    if (bucket) {
      bucket.focusSeconds += Math.max(0, row.accumulatedSeconds);
    }
  }

  const websiteTotals = new Map<
    string,
    { activeSeconds: number; count: number; lastUpdatedAt: Date; category: UsageCategory }
  >();
  const appTotals = new Map<
    string,
    {
      displayName: string;
      activeSeconds: number;
      count: number;
      lastUpdatedAt: Date;
      category: UsageCategory;
    }
  >();

  let productiveSeconds = 0;
  let neutralSeconds = 0;
  let distractingSeconds = 0;

  for (const row of websiteRows) {
    const category = classifyUsageTarget("website", row.hostname, customRules);
    const bucket = trendMap.get(row.localDate);
    if (bucket) {
      bucket.websiteSeconds += row.activeSeconds;
      bucket.totalSeconds += row.activeSeconds;
      if (category === "productive") bucket.productiveSeconds += row.activeSeconds;
      else if (category === "distracting") bucket.distractingSeconds += row.activeSeconds;
      else bucket.neutralSeconds += row.activeSeconds;
    }

    if (category === "productive") productiveSeconds += row.activeSeconds;
    else if (category === "distracting") distractingSeconds += row.activeSeconds;
    else neutralSeconds += row.activeSeconds;

    const existing = websiteTotals.get(row.hostname);
    if (!existing) {
      websiteTotals.set(row.hostname, {
        activeSeconds: row.activeSeconds,
        count: row.visitCount,
        lastUpdatedAt: row.lastUpdatedAt,
        category,
      });
    } else {
      existing.activeSeconds += row.activeSeconds;
      existing.count += row.visitCount;
      if (row.lastUpdatedAt > existing.lastUpdatedAt) {
        existing.lastUpdatedAt = row.lastUpdatedAt;
      }
    }
  }

  for (const row of appRows) {
    const category = classifyUsageTarget("desktop_app", row.appName, customRules);
    const bucket = trendMap.get(row.localDate);
    if (bucket) {
      bucket.desktopSeconds += row.activeSeconds;
      bucket.totalSeconds += row.activeSeconds;
      if (category === "productive") bucket.productiveSeconds += row.activeSeconds;
      else if (category === "distracting") bucket.distractingSeconds += row.activeSeconds;
      else bucket.neutralSeconds += row.activeSeconds;
    }

    if (category === "productive") productiveSeconds += row.activeSeconds;
    else if (category === "distracting") distractingSeconds += row.activeSeconds;
    else neutralSeconds += row.activeSeconds;

    const existing = appTotals.get(row.appName);
    if (!existing) {
      appTotals.set(row.appName, {
        displayName: getDesktopAppDisplayName(row.appName, row.displayName),
        activeSeconds: row.activeSeconds,
        count: row.launchCount,
        lastUpdatedAt: row.lastUpdatedAt,
        category,
      });
    } else {
      existing.activeSeconds += row.activeSeconds;
      existing.count += row.launchCount;
      if (row.lastUpdatedAt > existing.lastUpdatedAt) {
        existing.lastUpdatedAt = row.lastUpdatedAt;
      }
    }
  }

  const websiteTotalSeconds = Array.from(websiteTotals.values()).reduce(
    (sum, item) => sum + item.activeSeconds,
    0
  );
  const appTotalSeconds = Array.from(appTotals.values()).reduce(
    (sum, item) => sum + item.activeSeconds,
    0
  );

  const topWebsites: WellbeingUsageItemDto[] = Array.from(websiteTotals.entries())
    .sort((a, b) => b[1].activeSeconds - a[1].activeSeconds)
    .slice(0, 25)
    .map(([pattern, stats]) => ({
      targetType: "website",
      pattern,
      displayName: pattern,
      category: stats.category,
      activeSeconds: stats.activeSeconds,
      count: stats.count,
      sharePercent:
        websiteTotalSeconds > 0
          ? Math.round((stats.activeSeconds / websiteTotalSeconds) * 100)
          : 0,
      lastUpdatedAt: stats.lastUpdatedAt.toISOString(),
    }));

  const topDesktopApps: WellbeingUsageItemDto[] = Array.from(appTotals.entries())
    .sort((a, b) => b[1].activeSeconds - a[1].activeSeconds)
    .slice(0, 25)
    .map(([pattern, stats]) => ({
      targetType: "desktop_app",
      pattern,
      displayName: stats.displayName,
      category: stats.category,
      activeSeconds: stats.activeSeconds,
      count: stats.count,
      sharePercent:
        appTotalSeconds > 0
          ? Math.round((stats.activeSeconds / appTotalSeconds) * 100)
          : 0,
      lastUpdatedAt: stats.lastUpdatedAt.toISOString(),
    }));

  const dailyTrend = dateKeys.map((dateKey) => trendMap.get(dateKey)!);
  const todayBucket = trendMap.get(todayDate);
  const rangeTotalSeconds = dailyTrend.reduce((sum, day) => sum + day.totalSeconds, 0);

  return {
    timezone,
    todayDate,
    syncConsentEnabled: Boolean(prefsRows[0]?.extensionTrackingConsent),
    todayTotalSeconds: todayBucket?.totalSeconds ?? 0,
    todayWebsiteSeconds: todayBucket?.websiteSeconds ?? 0,
    todayDesktopSeconds: todayBucket?.desktopSeconds ?? 0,
    todayFocusSeconds: todayBucket?.focusSeconds ?? 0,
    rangeTotalSeconds,
    rangeDays: safeRangeDays,
    categoryBreakdown: {
      productiveSeconds,
      neutralSeconds,
      distractingSeconds,
    },
    dailyTrend,
    topWebsites,
    topDesktopApps,
    devices: deviceRows.map(serializeDevice),
  };
}
