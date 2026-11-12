import { extractTrackableHostname } from "@ember/shared";

export interface DailyHostUsage {
  activeSeconds: number;
  visitCount: number;
  lastVisitedAt: string;
}

export type DailyUsageMap = Record<string, Record<string, DailyHostUsage>>;

export interface ActiveSessionState {
  hostname: string | null;
  startedAtMs: number | null;
  isIncognito: boolean;
}

export interface TrackerSettings {
  paused: boolean;
  syncEnabled: boolean;
  apiBaseUrl: string;
  deviceToken: string | null;
  deviceId: string | null;
  deviceName: string;
  idleDetectionSeconds: number;
  lastSyncedAt: string | null;
  lastSyncError: string | null;
}

export interface PersistedExtensionState {
  dailyUsage: DailyUsageMap;
  activeSession: ActiveSessionState;
  windowFocused: boolean;
  idleState: "active" | "idle" | "locked";
  settings: TrackerSettings;
}

export const DEFAULT_TRACKER_SETTINGS: TrackerSettings = {
  paused: false,
  syncEnabled: false,
  apiBaseUrl: "https://ember-nine-flame.vercel.app",
  deviceToken: null,
  deviceId: null,
  deviceName: "Chrome Desktop",
  idleDetectionSeconds: 60,
  lastSyncedAt: null,
  lastSyncError: null,
};

export function createInitialExtensionState(): PersistedExtensionState {
  return {
    dailyUsage: {},
    activeSession: {
      hostname: null,
      startedAtMs: null,
      isIncognito: false,
    },
    windowFocused: true,
    idleState: "active",
    settings: { ...DEFAULT_TRACKER_SETTINGS },
  };
}

export function formatLocalDateKey(ms: number): string {
  const dt = new Date(ms);
  const year = dt.getFullYear();
  const month = String(dt.getMonth() + 1).padStart(2, "0");
  const day = String(dt.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function isTrackingPermitted(state: PersistedExtensionState): boolean {
  return (
    !state.settings.paused &&
    state.windowFocused &&
    state.idleState === "active" &&
    !state.activeSession.isIncognito &&
    state.activeSession.hostname !== null
  );
}

/**
 * Flushes whole elapsed seconds from the currently tracked hostname into dailyUsage.
 * Advances startedAtMs by whole seconds so frequent 30s alarms never lose fractional time.
 */
export function flushElapsedTime(
  state: PersistedExtensionState,
  nowMs: number = Date.now()
): PersistedExtensionState {
  const session = state.activeSession;
  if (!session.hostname || session.startedAtMs === null) {
    return state;
  }

  if (
    state.settings.paused ||
    !state.windowFocused ||
    state.idleState !== "active" ||
    session.isIncognito
  ) {
    return {
      ...state,
      activeSession: {
        ...session,
        startedAtMs: null,
      },
    };
  }

  const elapsedMs = nowMs - session.startedAtMs;
  if (elapsedMs < 1000) {
    return state;
  }

  const wholeSeconds = Math.min(86400, Math.floor(elapsedMs / 1000));
  const localDate = formatLocalDateKey(nowMs);
  const nextDailyUsage: DailyUsageMap = { ...state.dailyUsage };
  const dayBucket = { ...(nextDailyUsage[localDate] ?? {}) };
  const existing = dayBucket[session.hostname] ?? {
    activeSeconds: 0,
    visitCount: 0,
    lastVisitedAt: new Date(nowMs).toISOString(),
  };

  dayBucket[session.hostname] = {
    activeSeconds: Math.min(86400, existing.activeSeconds + wholeSeconds),
    visitCount: existing.visitCount,
    lastVisitedAt: new Date(nowMs).toISOString(),
  };
  nextDailyUsage[localDate] = dayBucket;

  return {
    ...state,
    dailyUsage: nextDailyUsage,
    activeSession: {
      ...session,
      startedAtMs: session.startedAtMs + wholeSeconds * 1000,
    },
  };
}

/**
 * Switches the active tracked tab target, flushing prior accumulated seconds first.
 */
export function setActiveTabTarget(
  state: PersistedExtensionState,
  tabInfo: { url?: string | null; incognito?: boolean } | null,
  nowMs: number = Date.now()
): PersistedExtensionState {
  const flushed = flushElapsedTime(state, nowMs);
  const isIncognito = Boolean(tabInfo?.incognito);
  const hostname =
    !isIncognito && tabInfo?.url ? extractTrackableHostname(tabInfo.url) : null;

  if (!hostname || isIncognito) {
    return {
      ...flushed,
      activeSession: {
        hostname: null,
        startedAtMs: null,
        isIncognito,
      },
    };
  }

  const prevHost = flushed.activeSession.hostname;
  const localDate = formatLocalDateKey(nowMs);
  const nextDailyUsage: DailyUsageMap = { ...flushed.dailyUsage };
  const dayBucket = { ...(nextDailyUsage[localDate] ?? {}) };
  const existing = dayBucket[hostname];

  if (!existing) {
    dayBucket[hostname] = {
      activeSeconds: 0,
      visitCount: 1,
      lastVisitedAt: new Date(nowMs).toISOString(),
    };
    nextDailyUsage[localDate] = dayBucket;
  } else if (prevHost !== hostname) {
    dayBucket[hostname] = {
      ...existing,
      visitCount: existing.visitCount + 1,
      lastVisitedAt: new Date(nowMs).toISOString(),
    };
    nextDailyUsage[localDate] = dayBucket;
  }

  const canStartClock =
    !flushed.settings.paused && flushed.windowFocused && flushed.idleState === "active";

  return {
    ...flushed,
    dailyUsage: nextDailyUsage,
    activeSession: {
      hostname,
      startedAtMs: canStartClock ? nowMs : null,
      isIncognito: false,
    },
  };
}

export function setWindowFocusState(
  state: PersistedExtensionState,
  focused: boolean,
  nowMs: number = Date.now()
): PersistedExtensionState {
  const flushed = flushElapsedTime(state, nowMs);
  const shouldTick =
    focused &&
    !flushed.settings.paused &&
    flushed.idleState === "active" &&
    !flushed.activeSession.isIncognito &&
    flushed.activeSession.hostname !== null;

  return {
    ...flushed,
    windowFocused: focused,
    activeSession: {
      ...flushed.activeSession,
      startedAtMs: shouldTick ? flushed.activeSession.startedAtMs ?? nowMs : null,
    },
  };
}

export function setIdleStateValue(
  state: PersistedExtensionState,
  idleState: "active" | "idle" | "locked",
  nowMs: number = Date.now()
): PersistedExtensionState {
  const flushed = flushElapsedTime(state, nowMs);
  const shouldTick =
    idleState === "active" &&
    !flushed.settings.paused &&
    flushed.windowFocused &&
    !flushed.activeSession.isIncognito &&
    flushed.activeSession.hostname !== null;

  return {
    ...flushed,
    idleState,
    activeSession: {
      ...flushed.activeSession,
      startedAtMs: shouldTick ? flushed.activeSession.startedAtMs ?? nowMs : null,
    },
  };
}

export function setPausedState(
  state: PersistedExtensionState,
  paused: boolean,
  nowMs: number = Date.now()
): PersistedExtensionState {
  const flushed = flushElapsedTime(state, nowMs);
  const shouldTick =
    !paused &&
    flushed.windowFocused &&
    flushed.idleState === "active" &&
    !flushed.activeSession.isIncognito &&
    flushed.activeSession.hostname !== null;

  return {
    ...flushed,
    settings: {
      ...flushed.settings,
      paused,
    },
    activeSession: {
      ...flushed.activeSession,
      startedAtMs: shouldTick ? nowMs : null,
    },
  };
}

export function pruneOldDailyUsage(
  dailyUsage: DailyUsageMap,
  nowMs: number = Date.now(),
  keepDays = 30
): DailyUsageMap {
  const cutoffDate = formatLocalDateKey(nowMs - keepDays * 24 * 60 * 60 * 1000);
  const pruned: DailyUsageMap = {};
  for (const [dateKey, hosts] of Object.entries(dailyUsage)) {
    if (dateKey >= cutoffDate) {
      pruned[dateKey] = hosts;
    }
  }
  return pruned;
}

export function buildSyncPayloadEntries(dailyUsage: DailyUsageMap): Array<{
  hostname: string;
  localDate: string;
  activeSeconds: number;
  visitCount: number;
}> {
  const entries: Array<{
    hostname: string;
    localDate: string;
    activeSeconds: number;
    visitCount: number;
  }> = [];

  const dates = Object.keys(dailyUsage).sort().reverse().slice(0, 14);
  for (const localDate of dates) {
    const hosts = dailyUsage[localDate];
    if (!hosts) continue;
    for (const [hostname, usage] of Object.entries(hosts)) {
      if (usage.activeSeconds <= 0 && usage.visitCount <= 0) continue;
      entries.push({
        hostname,
        localDate,
        activeSeconds: Math.min(86400, Math.max(0, Math.round(usage.activeSeconds))),
        visitCount: Math.max(1, Math.round(usage.visitCount)),
      });
    }
  }

  return entries.slice(0, 450);
}
