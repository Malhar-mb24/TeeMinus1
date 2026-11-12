import {
  buildSyncPayloadEntries,
  createInitialExtensionState,
  flushElapsedTime,
  pruneOldDailyUsage,
  setActiveTabTarget,
  setIdleStateValue,
  setPausedState,
  setWindowFocusState,
  type PersistedExtensionState,
  type TrackerSettings,
} from "./tracker";

const STORAGE_KEY = "emberExtensionState";
const FLUSH_ALARM_NAME = "ember-wellbeing-flush";
const SYNC_ALARM_NAME = "ember-wellbeing-sync";

let queuePromise: Promise<unknown> = Promise.resolve();

function serializeStateOp<T>(fn: () => Promise<T>): Promise<T> {
  const next = queuePromise.then(fn, fn);
  queuePromise = next.catch(() => undefined);
  return next;
}

async function loadState(): Promise<PersistedExtensionState> {
  const raw = await chrome.storage.local.get(STORAGE_KEY);
  const stored = raw[STORAGE_KEY] as Partial<PersistedExtensionState> | undefined;
  const base = createInitialExtensionState();
  if (!stored) {
    return base;
  }
  return {
    dailyUsage: stored.dailyUsage ?? {},
    activeSession: stored.activeSession ?? base.activeSession,
    windowFocused: stored.windowFocused ?? true,
    idleState: stored.idleState ?? "active",
    settings: {
      ...base.settings,
      ...(stored.settings ?? {}),
    },
  };
}

async function saveState(state: PersistedExtensionState): Promise<void> {
  const prunedState: PersistedExtensionState = {
    ...state,
    dailyUsage: pruneOldDailyUsage(state.dailyUsage),
  };
  await chrome.storage.local.set({ [STORAGE_KEY]: prunedState });
}

async function refreshActiveTab(nowMs: number = Date.now()): Promise<PersistedExtensionState> {
  const state = await loadState();
  const [activeTab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  const next = setActiveTabTarget(
    state,
    activeTab ? { url: activeTab.url ?? null, incognito: activeTab.incognito } : null,
    nowMs
  );
  await saveState(next);
  return next;
}

async function performSync(): Promise<{
  ok: boolean;
  message: string;
  state: PersistedExtensionState;
}> {
  let state = flushElapsedTime(await loadState(), Date.now());
  await saveState(state);

  if (!state.settings.deviceToken) {
    return { ok: false, message: "Pair this browser in Options first.", state };
  }
  if (!state.settings.syncEnabled) {
    return {
      ok: false,
      message: "Cloud sync is paused. Enable opt-in sync in Options to upload.",
      state,
    };
  }

  const baseUrl = state.settings.apiBaseUrl.replace(/\/+$/, "");
  const entries = buildSyncPayloadEntries(state.dailyUsage);

  try {
    const response = await fetch(`${baseUrl}/api/wellbeing/sync`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${state.settings.deviceToken}`,
      },
      body: JSON.stringify({
        entries,
        clientTimestamp: new Date().toISOString(),
      }),
    });

    const data = (await response.json().catch(() => ({}))) as {
      error?: string;
      code?: string;
      lastSeenAt?: string;
      syncedWebsiteRows?: number;
    };

    if (response.status === 401) {
      state = {
        ...state,
        settings: {
          ...state.settings,
          deviceToken: null,
          deviceId: null,
          syncEnabled: false,
          lastSyncError: "Device token revoked or expired. Generate a new pairing code.",
        },
      };
      await saveState(state);
      return {
        ok: false,
        message: state.settings.lastSyncError ?? "Device unpaired.",
        state,
      };
    }

    if (!response.ok) {
      state = {
        ...state,
        settings: {
          ...state.settings,
          lastSyncError: data.error ?? `Sync failed (HTTP ${response.status})`,
        },
      };
      await saveState(state);
      return { ok: false, message: state.settings.lastSyncError ?? "Sync failed.", state };
    }

    state = {
      ...state,
      settings: {
        ...state.settings,
        lastSyncedAt: data.lastSeenAt ?? new Date().toISOString(),
        lastSyncError: null,
      },
    };
    await saveState(state);
    return {
      ok: true,
      message: `Synced ${data.syncedWebsiteRows ?? entries.length} daily site summaries.`,
      state,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Network error during sync.";
    state = {
      ...state,
      settings: {
        ...state.settings,
        lastSyncError: errorMessage,
      },
    };
    await saveState(state);
    return { ok: false, message: errorMessage, state };
  }
}

async function ensureInitialized(): Promise<void> {
  const state = await loadState();
  chrome.idle.setDetectionInterval(
    Math.max(15, Math.min(3600, state.settings.idleDetectionSeconds || 60))
  );
  await chrome.alarms.create(FLUSH_ALARM_NAME, { periodInMinutes: 0.5 });
  await chrome.alarms.create(SYNC_ALARM_NAME, { periodInMinutes: 5 });
  await refreshActiveTab();
}

chrome.runtime.onInstalled.addListener(() => {
  void serializeStateOp(() => ensureInitialized());
});

chrome.runtime.onStartup.addListener(() => {
  void serializeStateOp(() => ensureInitialized());
});

chrome.tabs.onActivated.addListener(() => {
  void serializeStateOp(() => refreshActiveTab());
});

chrome.tabs.onUpdated.addListener((_tabId, changeInfo, tab) => {
  if (tab.active && (changeInfo.url || changeInfo.status === "complete")) {
    void serializeStateOp(() => refreshActiveTab());
  }
});

chrome.windows.onFocusChanged.addListener((windowId) => {
  void serializeStateOp(async () => {
    const focused = windowId !== chrome.windows.WINDOW_ID_NONE;
    const state = setWindowFocusState(await loadState(), focused, Date.now());
    await saveState(state);
    if (focused) {
      await refreshActiveTab();
    }
  });
});

chrome.idle.onStateChanged.addListener((newState) => {
  void serializeStateOp(async () => {
    const state = setIdleStateValue(await loadState(), newState, Date.now());
    await saveState(state);
  });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === FLUSH_ALARM_NAME) {
    void serializeStateOp(async () => {
      const state = flushElapsedTime(await loadState(), Date.now());
      await saveState(state);
    });
  } else if (alarm.name === SYNC_ALARM_NAME) {
    void serializeStateOp(() => performSync());
  }
});

export type ExtensionMessage =
  | { type: "GET_STATE" }
  | { type: "SET_PAUSED"; paused: boolean }
  | { type: "UPDATE_SETTINGS"; patch: Partial<TrackerSettings> }
  | { type: "PAIR_DEVICE"; pairingCode: string; deviceName: string; apiBaseUrl: string }
  | { type: "UNPAIR_DEVICE" }
  | { type: "CLEAR_DATA" }
  | { type: "SYNC_NOW" };

chrome.runtime.onMessage.addListener((message: ExtensionMessage, _sender, sendResponse) => {
  void serializeStateOp(async () => {
    if (message.type === "GET_STATE") {
      await refreshActiveTab();
      const state = flushElapsedTime(await loadState(), Date.now());
      await saveState(state);
      return { ok: true, state };
    }

    if (message.type === "SET_PAUSED") {
      const state = setPausedState(await loadState(), message.paused, Date.now());
      await saveState(state);
      return { ok: true, state };
    }

    if (message.type === "UPDATE_SETTINGS") {
      const current = await loadState();
      const next: PersistedExtensionState = {
        ...current,
        settings: {
          ...current.settings,
          ...message.patch,
        },
      };
      if (typeof message.patch.idleDetectionSeconds === "number") {
        chrome.idle.setDetectionInterval(
          Math.max(15, Math.min(3600, message.patch.idleDetectionSeconds))
        );
      }
      await saveState(next);
      return { ok: true, state: next };
    }

    if (message.type === "PAIR_DEVICE") {
      const current = await loadState();
      const cleanBaseUrl = message.apiBaseUrl.trim().replace(/\/+$/, "");
      try {
        const res = await fetch(`${cleanBaseUrl}/api/devices/pair`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pairingCode: message.pairingCode.trim().toUpperCase(),
            deviceName: message.deviceName.trim() || "Chrome Browser",
            deviceType: "chrome_extension",
            browser: "chrome",
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
            error: data.error ?? `Pairing failed (HTTP ${res.status})`,
            state: current,
          };
        }
        const updated: PersistedExtensionState = {
          ...current,
          settings: {
            ...current.settings,
            apiBaseUrl: cleanBaseUrl,
            deviceToken: data.token,
            deviceId: data.device.id,
            deviceName: data.device.deviceName,
            syncEnabled: true,
            lastSyncError: null,
          },
        };
        await saveState(updated);
        return { ok: true, state: updated };
      } catch (error) {
        return {
          ok: false,
          error: error instanceof Error ? error.message : "Network error while pairing",
          state: current,
        };
      }
    }

    if (message.type === "UNPAIR_DEVICE") {
      const current = await loadState();
      const updated: PersistedExtensionState = {
        ...current,
        settings: {
          ...current.settings,
          deviceToken: null,
          deviceId: null,
          syncEnabled: false,
          lastSyncError: null,
        },
      };
      await saveState(updated);
      return { ok: true, state: updated };
    }

    if (message.type === "CLEAR_DATA") {
      const current = await loadState();
      const updated: PersistedExtensionState = {
        ...current,
        dailyUsage: {},
      };
      await saveState(updated);
      return { ok: true, state: updated };
    }

    if (message.type === "SYNC_NOW") {
      return await performSync();
    }

    return { ok: false, error: "Unsupported message" };
  }).then(sendResponse);

  return true;
});
