import { getDesktopAppDisplayName, normalizeDesktopAppName } from "@ember/shared";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { ForegroundAppSample } from "./win32-sampler";

export interface DailyDesktopAppUsage {
  appName: string;
  displayName: string;
  activeSeconds: number;
  launchCount: number;
  lastActiveAt: string;
}

export type DesktopDailyUsageMap = Record<string, Record<string, DailyDesktopAppUsage>>;

export interface DesktopTrackerSettings {
  apiBaseUrl: string;
  deviceToken: string | null;
  deviceId: string | null;
  deviceName: string;
  syncEnabled: boolean;
  paused: boolean;
  idleThresholdSeconds: number;
  lastSyncedAt: string | null;
  lastSyncError: string | null;
}

export interface PersistedDesktopTrackerState {
  dailyUsage: DesktopDailyUsageMap;
  activeSession: {
    appName: string | null;
    lastTickMs: number | null;
  };
  settings: DesktopTrackerSettings;
}

const IGNORED_OS_PROCESSES = new Set([
  "idle.exe",
  "lockapp.exe",
  "logonui.exe",
  "shellexperiencehost.exe",
  "searchhost.exe",
]);

export function formatLocalDateKey(ms: number): string {
  const dt = new Date(ms);
  const year = dt.getFullYear();
  const month = String(dt.getMonth() + 1).padStart(2, "0");
  const day = String(dt.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getDefaultDesktopDataDir(): string {
  const localAppData =
    process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local");
  return path.join(localAppData, "EmberWellbeing");
}

export function createInitialDesktopTrackerState(): PersistedDesktopTrackerState {
  return {
    dailyUsage: {},
    activeSession: {
      appName: null,
      lastTickMs: null,
    },
    settings: {
      apiBaseUrl: "https://ember-nine-flame.vercel.app",
      deviceToken: null,
      deviceId: null,
      deviceName: `${os.hostname()} Desktop`,
      syncEnabled: false,
      paused: false,
      idleThresholdSeconds: 60,
      lastSyncedAt: null,
      lastSyncError: null,
    },
  };
}

export function loadDesktopTrackerState(dataDir: string): PersistedDesktopTrackerState {
  const filePath = path.join(dataDir, "usage.json");
  const base = createInitialDesktopTrackerState();
  if (!fs.existsSync(filePath)) {
    return base;
  }
  try {
    const raw = JSON.parse(fs.readFileSync(filePath, "utf8")) as Partial<PersistedDesktopTrackerState>;
    return {
      dailyUsage: raw.dailyUsage ?? {},
      activeSession: raw.activeSession ?? base.activeSession,
      settings: {
        ...base.settings,
        ...(raw.settings ?? {}),
      },
    };
  } catch {
    return base;
  }
}

export function saveDesktopTrackerState(
  dataDir: string,
  state: PersistedDesktopTrackerState
): void {
  fs.mkdirSync(dataDir, { recursive: true });
  const filePath = path.join(dataDir, "usage.json");
  const tmpPath = path.join(dataDir, `usage.${process.pid}.tmp`);
  fs.writeFileSync(tmpPath, JSON.stringify(state, null, 2), "utf8");
  fs.renameSync(tmpPath, filePath);
}

/**
 * Applies a live Win32 foreground app sample into dailyUsage.
 * Credits elapsed whole seconds only when not paused, not idle, and running a non-lockscreen executable.
 */
export function applyForegroundSample(
  state: PersistedDesktopTrackerState,
  sample: ForegroundAppSample,
  maxDeltaSeconds = 15
): PersistedDesktopTrackerState {
  if (state.settings.paused) {
    return {
      ...state,
      activeSession: { appName: null, lastTickMs: null },
    };
  }

  const idleThresholdMs = Math.max(15, state.settings.idleThresholdSeconds || 60) * 1000;
  if (sample.idleMs >= idleThresholdMs) {
    return {
      ...state,
      activeSession: { appName: null, lastTickMs: null },
    };
  }

  const normalizedApp = sample.processName
    ? normalizeDesktopAppName(sample.processName)
    : null;

  if (!normalizedApp || IGNORED_OS_PROCESSES.has(normalizedApp)) {
    return {
      ...state,
      activeSession: { appName: null, lastTickMs: null },
    };
  }

  const nowMs = sample.timestampMs;
  const localDate = formatLocalDateKey(nowMs);
  const nextDailyUsage: DesktopDailyUsageMap = { ...state.dailyUsage };
  const dayBucket = { ...(nextDailyUsage[localDate] ?? {}) };
  const prevApp = state.activeSession.appName;
  const prevTickMs = state.activeSession.lastTickMs;

  let elapsedSeconds = 0;
  if (prevApp === normalizedApp && prevTickMs !== null && nowMs > prevTickMs) {
    elapsedSeconds = Math.min(maxDeltaSeconds, Math.floor((nowMs - prevTickMs) / 1000));
  }

  const existing = dayBucket[normalizedApp];
  const isNewSessionSwitch = prevApp !== normalizedApp;

  dayBucket[normalizedApp] = {
    appName: normalizedApp,
    displayName: getDesktopAppDisplayName(normalizedApp),
    activeSeconds: Math.min(86400, (existing?.activeSeconds ?? 0) + elapsedSeconds),
    launchCount: existing
      ? existing.launchCount + (isNewSessionSwitch ? 1 : 0)
      : 1,
    lastActiveAt: new Date(nowMs).toISOString(),
  };
  nextDailyUsage[localDate] = dayBucket;

  const nextTickMs =
    prevApp === normalizedApp && prevTickMs !== null && elapsedSeconds > 0
      ? prevTickMs + elapsedSeconds * 1000
      : prevApp === normalizedApp && prevTickMs !== null
        ? prevTickMs
        : nowMs;

  return {
    ...state,
    dailyUsage: nextDailyUsage,
    activeSession: {
      appName: normalizedApp,
      lastTickMs: nextTickMs,
    },
  };
}

export function buildDesktopSyncPayloadEntries(dailyUsage: DesktopDailyUsageMap): Array<{
  appName: string;
  displayName: string;
  localDate: string;
  activeSeconds: number;
  launchCount: number;
}> {
  const entries: Array<{
    appName: string;
    displayName: string;
    localDate: string;
    activeSeconds: number;
    launchCount: number;
  }> = [];

  const recentDates = Object.keys(dailyUsage).sort().reverse().slice(0, 14);
  for (const localDate of recentDates) {
    const apps = dailyUsage[localDate];
    if (!apps) continue;
    for (const usage of Object.values(apps)) {
      if (usage.activeSeconds <= 0 && usage.launchCount <= 0) continue;
      entries.push({
        appName: usage.appName,
        displayName: usage.displayName,
        localDate,
        activeSeconds: Math.min(86400, Math.max(0, Math.round(usage.activeSeconds))),
        launchCount: Math.max(1, Math.round(usage.launchCount)),
      });
    }
  }
  return entries.slice(0, 450);
}

export async function pairDesktopTracker(
  dataDir: string,
  params: { pairingCode: string; deviceName?: string; apiBaseUrl?: string }
): Promise<{ ok: boolean; message: string; state: PersistedDesktopTrackerState }> {
  const state = loadDesktopTrackerState(dataDir);
  const baseUrl = (params.apiBaseUrl ?? state.settings.apiBaseUrl).replace(/\/+$/, "");
  const deviceName = params.deviceName?.trim() || state.settings.deviceName;

  const res = await fetch(`${baseUrl}/api/devices/pair`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      pairingCode: params.pairingCode.trim().toUpperCase(),
      deviceName,
      deviceType: "windows_desktop",
      browser: "windows",
    }),
  });

  const data = (await res.json().catch(() => ({}))) as {
    error?: string;
    token?: string;
    device?: { id: string; deviceName: string };
  };

  if (!res.ok || !data.token || !data.device) {
    return {
      ok: false,
      message: data.error ?? `Pairing failed (HTTP ${res.status})`,
      state,
    };
  }

  const nextState: PersistedDesktopTrackerState = {
    ...state,
    settings: {
      ...state.settings,
      apiBaseUrl: baseUrl,
      deviceToken: data.token,
      deviceId: data.device.id,
      deviceName: data.device.deviceName,
      syncEnabled: true,
      lastSyncError: null,
    },
  };
  saveDesktopTrackerState(dataDir, nextState);
  return {
    ok: true,
    message: `Paired "${nextState.settings.deviceName}" (${nextState.settings.deviceId}).`,
    state: nextState,
  };
}

export async function syncDesktopTracker(
  dataDir: string
): Promise<{ ok: boolean; message: string; state: PersistedDesktopTrackerState }> {
  let state = loadDesktopTrackerState(dataDir);
  if (!state.settings.deviceToken) {
    return { ok: false, message: "Desktop tracker is not paired yet.", state };
  }
  if (!state.settings.syncEnabled) {
    return { ok: false, message: "Desktop sync is currently disabled.", state };
  }

  const baseUrl = state.settings.apiBaseUrl.replace(/\/+$/, "");
  const appEntries = buildDesktopSyncPayloadEntries(state.dailyUsage);
  if (appEntries.length === 0) {
    return { ok: true, message: "No desktop app usage entries to sync yet.", state };
  }

  const res = await fetch(`${baseUrl}/api/wellbeing/sync`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${state.settings.deviceToken}`,
    },
    body: JSON.stringify({
      entries: [],
      appEntries,
      clientTimestamp: new Date().toISOString(),
    }),
  });

  const data = (await res.json().catch(() => ({}))) as {
    error?: string;
    lastSeenAt?: string;
    syncedDesktopAppRows?: number;
  };

  if (res.status === 401) {
    state = {
      ...state,
      settings: {
        ...state.settings,
        deviceToken: null,
        deviceId: null,
        syncEnabled: false,
        lastSyncError: "Device token revoked or invalid.",
      },
    };
    saveDesktopTrackerState(dataDir, state);
    return { ok: false, message: state.settings.lastSyncError ?? "Unauthorized", state };
  }

  if (!res.ok) {
    state = {
      ...state,
      settings: {
        ...state.settings,
        lastSyncError: data.error ?? `Sync failed (HTTP ${res.status})`,
      },
    };
    saveDesktopTrackerState(dataDir, state);
    return { ok: false, message: state.settings.lastSyncError ?? "Sync failed", state };
  }

  state = {
    ...state,
    settings: {
      ...state.settings,
      lastSyncedAt: data.lastSeenAt ?? new Date().toISOString(),
      lastSyncError: null,
    },
  };
  saveDesktopTrackerState(dataDir, state);
  return {
    ok: true,
    message: `Synced ${data.syncedDesktopAppRows ?? appEntries.length} desktop app row(s).`,
    state,
  };
}
