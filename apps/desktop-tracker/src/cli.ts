import { formatDurationCompact } from "@ember/shared";
import fs from "node:fs";
import path from "node:path";
import {
  applyForegroundSample,
  formatLocalDateKey,
  getDefaultDesktopDataDir,
  loadDesktopTrackerState,
  pairDesktopTracker,
  saveDesktopTrackerState,
  syncDesktopTracker,
} from "./tracker";
import { Win32ForegroundSampler } from "./win32-sampler";

function parseArgs(argv: string[]): { command: string; flags: Record<string, string | boolean> } {
  const command = argv[0] && !argv[0].startsWith("--") ? argv[0] : "status";
  const flags: Record<string, string | boolean> = {};
  const startIdx = argv[0] && !argv[0].startsWith("--") ? 1 : 0;

  for (let i = startIdx; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token?.startsWith("--")) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith("--")) {
      flags[key] = next;
      i += 1;
    } else {
      flags[key] = true;
    }
  }
  return { command, flags };
}

function getFlagString(flags: Record<string, string | boolean>, key: string): string | undefined {
  const val = flags[key];
  return typeof val === "string" ? val : undefined;
}

function getFlagNumber(
  flags: Record<string, string | boolean>,
  key: string,
  fallback: number
): number {
  const raw = flags[key];
  if (typeof raw !== "string") return fallback;
  const num = Number(raw);
  return Number.isFinite(num) ? num : fallback;
}

async function runStart(dataDir: string, flags: Record<string, string | boolean>): Promise<void> {
  const pollMs = Math.max(500, Math.min(10_000, getFlagNumber(flags, "poll-ms", 1000)));
  const idleSeconds = Math.max(15, getFlagNumber(flags, "idle-seconds", 60));
  const durationSeconds = Math.max(0, getFlagNumber(flags, "duration", 0));
  const syncIntervalSeconds = Math.max(15, getFlagNumber(flags, "sync-interval-seconds", 60));

  let state = loadDesktopTrackerState(dataDir);
  state = {
    ...state,
    activeSession: { appName: null, lastTickMs: null },
    settings: {
      ...state.settings,
      paused: false,
      idleThresholdSeconds: idleSeconds,
    },
  };
  saveDesktopTrackerState(dataDir, state);

  const sampler = new Win32ForegroundSampler();
  await sampler.start();

  const startedMs = Date.now();
  let lastSavedMs = startedMs;
  let lastSyncedMs = startedMs;
  let stopping = false;

  const stopHandler = () => {
    stopping = true;
  };
  process.on("SIGINT", stopHandler);
  process.on("SIGTERM", stopHandler);

  console.log(
    `[ember-desktop-tracker] Started (poll=${pollMs}ms, idle=${idleSeconds}s, dataDir=${dataDir})`
  );

  try {
    while (!stopping) {
      const sample = await sampler.sample();
      state = applyForegroundSample(state, sample);

      const nowMs = Date.now();
      if (nowMs - lastSavedMs >= 5000) {
        saveDesktopTrackerState(dataDir, state);
        lastSavedMs = nowMs;
      }

      if (
        state.settings.deviceToken &&
        state.settings.syncEnabled &&
        nowMs - lastSyncedMs >= syncIntervalSeconds * 1000
      ) {
        saveDesktopTrackerState(dataDir, state);
        const syncResult = await syncDesktopTracker(dataDir);
        state = syncResult.state;
        lastSyncedMs = nowMs;
        console.log(`[ember-desktop-tracker] Sync: ${syncResult.message}`);
      }

      if (durationSeconds > 0 && nowMs - startedMs >= durationSeconds * 1000) {
        break;
      }

      await new Promise((resolve) => setTimeout(resolve, pollMs));
    }
  } finally {
    saveDesktopTrackerState(dataDir, state);
    await sampler.stop();
    if (state.settings.deviceToken && state.settings.syncEnabled) {
      const finalSync = await syncDesktopTracker(dataDir);
      console.log(`[ember-desktop-tracker] Final sync: ${finalSync.message}`);
    }
  }

  const today = formatLocalDateKey(Date.now());
  const todayApps = Object.values(state.dailyUsage[today] ?? {}).sort(
    (a, b) => b.activeSeconds - a.activeSeconds
  );
  console.log(
    `[ember-desktop-tracker] Stopped. Tracked today (${today}): ${todayApps
      .map((item) => `${item.displayName} (${formatDurationCompact(item.activeSeconds)})`)
      .join(", ") || "none"}`
  );
}

async function main(): Promise<void> {
  const { command, flags } = parseArgs(process.argv.slice(2));
  const dataDir = path.resolve(getFlagString(flags, "data-dir") ?? getDefaultDesktopDataDir());

  if (command === "start") {
    await runStart(dataDir, flags);
    return;
  }

  if (command === "pair") {
    const code = getFlagString(flags, "code");
    if (!code) {
      console.error("Usage: ember-desktop-tracker pair --code XXXX-XXXX [--name MyPC] [--server URL]");
      process.exitCode = 1;
      return;
    }
    const result = await pairDesktopTracker(dataDir, {
      pairingCode: code,
      deviceName: getFlagString(flags, "name"),
      apiBaseUrl: getFlagString(flags, "server"),
    });
    console.log(result.message);
    if (!result.ok) process.exitCode = 1;
    return;
  }

  if (command === "sync") {
    const result = await syncDesktopTracker(dataDir);
    console.log(result.message);
    if (!result.ok) process.exitCode = 1;
    return;
  }

  if (command === "clear") {
    const state = loadDesktopTrackerState(dataDir);
    saveDesktopTrackerState(dataDir, {
      ...state,
      dailyUsage: {},
      activeSession: { appName: null, lastTickMs: null },
    });
    console.log(`Cleared local desktop tracker data in ${dataDir}`);
    return;
  }

  if (command === "export") {
    const state = loadDesktopTrackerState(dataDir);
    const json = JSON.stringify(state.dailyUsage, null, 2);
    const outPath = getFlagString(flags, "out");
    if (outPath) {
      fs.writeFileSync(path.resolve(outPath), json, "utf8");
      console.log(`Exported local desktop usage to ${path.resolve(outPath)}`);
    } else {
      console.log(json);
    }
    return;
  }

  const state = loadDesktopTrackerState(dataDir);
  const today = formatLocalDateKey(Date.now());
  const todayApps = Object.values(state.dailyUsage[today] ?? {}).sort(
    (a, b) => b.activeSeconds - a.activeSeconds
  );
  console.log(
    JSON.stringify(
      {
        dataDir,
        paired: Boolean(state.settings.deviceToken),
        deviceName: state.settings.deviceName,
        syncEnabled: state.settings.syncEnabled,
        today,
        todayApps,
      },
      null,
      2
    )
  );
}

void main().catch((error) => {
  console.error("[ember-desktop-tracker] Fatal error:", error);
  process.exitCode = 1;
});
