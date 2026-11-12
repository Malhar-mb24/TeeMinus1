import {
  addDaysToDateKey,
  classifyFocusOutcome,
  classifyUsageTarget,
  computeSessionPauseGapSeconds,
  formatDurationCompact,
  getDesktopAppDisplayName,
  getLocalDateKey,
  type DistractionSignalDto,
  type FocusIntelligenceSummaryDto,
  type FocusSessionTimelineItemDto,
  type TrackingCoverageDto,
  type UsageCategory,
  type UsageTargetType,
} from "@ember/shared";
import { and, desc, eq, gte } from "drizzle-orm";
import { getDb, type EmberDatabase } from "./client";
import {
  appUsageDaily,
  extensionDevices,
  focusSessions,
  tasks,
  userPreferences,
  websiteCategories,
  websiteUsageDaily,
} from "./schema";

export async function getFocusIntelligenceForUser(
  userId: string,
  timezone: string,
  rangeDays = 7,
  dbOverride?: EmberDatabase
): Promise<FocusIntelligenceSummaryDto> {
  const safeRangeDays = Math.min(30, Math.max(1, Math.floor(rangeDays)));
  const db = dbOverride ?? getDb();
  const todayDate = getLocalDateKey(new Date(), timezone);
  const startDate = addDaysToDateKey(todayDate, -(safeRangeDays - 1));

  const [prefsRows, deviceRows, sessionRows, websiteRows, appRows, categoryRows] =
    await Promise.all([
      db
        .select({ extensionTrackingConsent: userPreferences.extensionTrackingConsent })
        .from(userPreferences)
        .where(eq(userPreferences.userId, userId))
        .limit(1),
      db
        .select({
          id: extensionDevices.id,
          deviceType: extensionDevices.deviceType,
          status: extensionDevices.status,
          lastSeenAt: extensionDevices.lastSeenAt,
        })
        .from(extensionDevices)
        .where(eq(extensionDevices.userId, userId)),
      db
        .select({
          id: focusSessions.id,
          localDate: focusSessions.localDate,
          startedAt: focusSessions.startedAt,
          endedAt: focusSessions.endedAt,
          mode: focusSessions.mode,
          status: focusSessions.status,
          label: focusSessions.label,
          taskTitle: tasks.title,
          plannedDurationSeconds: focusSessions.plannedDurationSeconds,
          accumulatedSeconds: focusSessions.accumulatedSeconds,
          xpEarned: focusSessions.xpEarned,
        })
        .from(focusSessions)
        .leftJoin(tasks, eq(focusSessions.taskId, tasks.id))
        .where(
          and(
            eq(focusSessions.userId, userId),
            gte(focusSessions.localDate, startDate)
          )
        )
        .orderBy(desc(focusSessions.startedAt)),
      db
        .select({
          localDate: websiteUsageDaily.localDate,
          hostname: websiteUsageDaily.hostname,
          activeSeconds: websiteUsageDaily.activeSeconds,
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
        })
        .from(appUsageDaily)
        .where(
          and(
            eq(appUsageDaily.userId, userId),
            gte(appUsageDaily.localDate, startDate)
          )
        ),
      db
        .select({
          targetType: websiteCategories.targetType,
          pattern: websiteCategories.pattern,
          category: websiteCategories.category,
        })
        .from(websiteCategories)
        .where(eq(websiteCategories.userId, userId)),
    ]);

  const syncConsentEnabled = Boolean(prefsRows[0]?.extensionTrackingConsent);
  const activeDevices = deviceRows.filter((d) => d.status === "active");
  const hasActiveExtension = activeDevices.some(
    (d) => d.deviceType === "chrome_extension"
  );
  const hasActiveDesktopTracker = activeDevices.some(
    (d) => d.deviceType === "windows_desktop"
  );

  const hasAnySyncedWebData = websiteRows.length > 0;
  const hasAnySyncedDesktopData = appRows.length > 0;

  let coverageStatus: TrackingCoverageDto["status"] = "none";
  let coverageExplanation =
    "No active tracking devices or synced browser/desktop logs found for this period. Focus session timing remains recorded accurately, while off-timer screen activity is unknown.";

  if (syncConsentEnabled && hasActiveExtension && hasActiveDesktopTracker) {
    coverageStatus = "connected";
    coverageExplanation =
      "Chrome MV3 extension and Windows desktop tracker are both paired with opt-in sync enabled.";
  } else if (
    syncConsentEnabled &&
    (hasActiveExtension ||
      hasActiveDesktopTracker ||
      hasAnySyncedWebData ||
      hasAnySyncedDesktopData)
  ) {
    coverageStatus = "partial";
    coverageExplanation = hasActiveExtension
      ? "Browser tracking is active. Desktop-only applications outside Chrome are only recorded when the Windows desktop tracker is also paired and running."
      : hasActiveDesktopTracker
        ? "Windows desktop tracking is active. Per-hostname website visibility inside browsers requires the paired Chrome extension."
        : "Historical synced data is shown below, but no active tracking device is currently connected.";
  } else if (!syncConsentEnabled && (hasAnySyncedWebData || hasAnySyncedDesktopData)) {
    coverageStatus = "partial";
    coverageExplanation =
      "Cloud sync consent is currently paused. Previously synced history is shown, while new browser/desktop usage remains local.";
  }

  const customRules = categoryRows.map((row) => ({
    targetType: (row.targetType === "desktop_app"
      ? "desktop_app"
      : "website") as UsageTargetType,
    pattern: row.pattern,
    category: (row.category === "productive" || row.category === "distracting"
      ? row.category
      : "neutral") as UsageCategory,
  }));

  const webByDate = new Map<
    string,
    { totalSeconds: number; distractingSeconds: number; distractingHosts: Map<string, number> }
  >();
  let totalTrackedWebSeconds = 0;

  for (const row of websiteRows) {
    totalTrackedWebSeconds += row.activeSeconds;
    const category = classifyUsageTarget("website", row.hostname, customRules);
    const bucket = webByDate.get(row.localDate) ?? {
      totalSeconds: 0,
      distractingSeconds: 0,
      distractingHosts: new Map(),
    };
    bucket.totalSeconds += row.activeSeconds;
    if (category === "distracting") {
      bucket.distractingSeconds += row.activeSeconds;
      bucket.distractingHosts.set(
        row.hostname,
        (bucket.distractingHosts.get(row.hostname) ?? 0) + row.activeSeconds
      );
    }
    webByDate.set(row.localDate, bucket);
  }

  const appByDate = new Map<
    string,
    {
      totalSeconds: number;
      distractingSeconds: number;
      distractingApps: Map<string, { displayName: string; seconds: number }>;
    }
  >();
  let totalTrackedDesktopSeconds = 0;

  for (const row of appRows) {
    totalTrackedDesktopSeconds += row.activeSeconds;
    const category = classifyUsageTarget("desktop_app", row.appName, customRules);
    const bucket = appByDate.get(row.localDate) ?? {
      totalSeconds: 0,
      distractingSeconds: 0,
      distractingApps: new Map(),
    };
    bucket.totalSeconds += row.activeSeconds;
    if (category === "distracting") {
      bucket.distractingSeconds += row.activeSeconds;
      const existing = bucket.distractingApps.get(row.appName);
      bucket.distractingApps.set(row.appName, {
        displayName: getDesktopAppDisplayName(row.appName, row.displayName),
        seconds: (existing?.seconds ?? 0) + row.activeSeconds,
      });
    }
    appByDate.set(row.localDate, bucket);
  }

  let focusSeconds = 0;
  let completedFocusSessions = 0;
  let interruptedFocusSessions = 0;
  let sessionPauseSeconds = 0;

  const focusDatesSet = new Set<string>();
  const distractionSignals: DistractionSignalDto[] = [];

  const sessionsTimeline: FocusSessionTimelineItemDto[] = sessionRows
    .filter((row) => row.mode === "pomodoro" || row.mode === "custom" || row.mode === "stopwatch")
    .slice(0, 25)
    .map((row) => {
      focusDatesSet.add(row.localDate);
      focusSeconds += row.accumulatedSeconds;
      if (row.status === "completed") completedFocusSessions += 1;
      if (row.status === "interrupted") interruptedFocusSessions += 1;

      const pauseGapSeconds = computeSessionPauseGapSeconds({
        startedAtMs: row.startedAt.getTime(),
        endedAtMs: row.endedAt ? row.endedAt.getTime() : null,
        accumulatedSeconds: row.accumulatedSeconds,
      });
      sessionPauseSeconds += pauseGapSeconds;

      const webDay = webByDate.get(row.localDate);
      const appDay = appByDate.get(row.localDate);
      const sameDayTrackedWebSeconds = webDay ? webDay.totalSeconds : null;
      const sameDayTrackedDesktopSeconds = appDay ? appDay.totalSeconds : null;

      const sameDayDistractingSeconds =
        webDay || appDay
          ? (webDay?.distractingSeconds ?? 0) + (appDay?.distractingSeconds ?? 0)
          : null;

      const distractingTargets: string[] = [];
      const plannedDurationSeconds = row.plannedDurationSeconds ?? 0;
      if (webDay) {
        for (const [host, sec] of Array.from(webDay.distractingHosts.entries()).sort(
          (a, b) => b[1] - a[1]
        )) {
          if (sec >= 30) distractingTargets.push(`${host} (${formatDurationCompact(sec)})`);
        }
      }
      if (appDay) {
        for (const [, info] of Array.from(appDay.distractingApps.entries()).sort(
          (a, b) => b[1].seconds - a[1].seconds
        )) {
          if (info.seconds >= 30) {
            distractingTargets.push(`${info.displayName} (${formatDurationCompact(info.seconds)})`);
          }
        }
      }

      if (row.status === "interrupted") {
        distractionSignals.push({
          id: `session-${row.id}`,
          localDate: row.localDate,
          targetType: "focus_session",
          pattern: row.label || row.taskTitle || row.mode,
          displayName: row.label || row.taskTitle || `${row.mode} block`,
          activeSeconds: row.accumulatedSeconds,
          category: "interrupted_session",
          reason: `Ended early as interrupted after ${formatDurationCompact(row.accumulatedSeconds)} (planned ${formatDurationCompact(plannedDurationSeconds)}).`,
        });
      }

      return {
        id: row.id,
        localDate: row.localDate,
        startedAt: row.startedAt.toISOString(),
        endedAt: row.endedAt ? row.endedAt.toISOString() : null,
        mode: row.mode,
        status: row.status,
        title: row.label || row.taskTitle || `${row.mode} session`,
        plannedDurationSeconds,
        accumulatedSeconds: row.accumulatedSeconds,
        pauseGapSeconds,
        xpEarned: row.xpEarned,
        outcomeFlag: classifyFocusOutcome({
          status: row.status,
          mode: row.mode,
          accumulatedSeconds: row.accumulatedSeconds,
          plannedDurationSeconds,
        }),
        sameDayTrackedWebSeconds,
        sameDayTrackedDesktopSeconds,
        sameDayDistractingSeconds,
        sameDayDistractingTargets: distractingTargets.slice(0, 4),
      };
    });

  // Add day-level distracting website/app signals on days where focus sessions occurred.
  for (const localDate of Array.from(focusDatesSet).sort().reverse()) {
    const webDay = webByDate.get(localDate);
    if (webDay) {
      for (const [host, seconds] of webDay.distractingHosts.entries()) {
        if (seconds < 60) continue;
        distractionSignals.push({
          id: `web-${localDate}-${host}`,
          localDate,
          targetType: "website",
          pattern: host,
          displayName: host,
          activeSeconds: seconds,
          category: "distracting",
          reason: `Classified as distracting; ${formatDurationCompact(seconds)} synced on ${localDate} (same day as a focus block; daily rollup does not assert exact minute-level overlap).`,
        });
      }
    }

    const appDay = appByDate.get(localDate);
    if (appDay) {
      for (const [appName, info] of appDay.distractingApps.entries()) {
        if (info.seconds < 60) continue;
        distractionSignals.push({
          id: `app-${localDate}-${appName}`,
          localDate,
          targetType: "desktop_app",
          pattern: appName,
          displayName: info.displayName,
          activeSeconds: info.seconds,
          category: "distracting",
          reason: `Desktop app classified as distracting; ${formatDurationCompact(info.seconds)} synced on ${localDate} (same-day context only).`,
        });
      }
    }
  }

  return {
    timezone,
    todayDate,
    rangeDays: safeRangeDays,
    coverage: {
      status: coverageStatus,
      syncConsentEnabled,
      hasActiveExtension,
      hasActiveDesktopTracker,
      activeDeviceCount: activeDevices.length,
      explanation: coverageExplanation,
    },
    accounting: {
      rangeDays: safeRangeDays,
      focusSeconds,
      completedFocusSessions,
      interruptedFocusSessions,
      trackedWebsiteSeconds: hasAnySyncedWebData ? totalTrackedWebSeconds : null,
      trackedDesktopSeconds: hasAnySyncedDesktopData ? totalTrackedDesktopSeconds : null,
      sessionPauseSeconds,
      idleAndUntrackedNote:
        "Browser/desktop trackers automatically pause during OS idle periods (>60s) and never record locked or excluded windows. Unsynced intervals are treated as unknown rather than estimated.",
    },
    sessionsTimeline,
    distractionSignals: distractionSignals.slice(0, 15),
    methodologyNotes: [
      "Focus time uses server-anchored timestamps (accumulated active timer seconds) inside your IANA timezone.",
      "Website and Windows desktop usage sync as daily totals per hostname or executable, never full URLs or window titles.",
      "Same-day distracting usage indicates shared calendar-day activity alongside focus sessions, not proven causation.",
    ],
  };
}
