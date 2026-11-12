import { describe, expect, it } from "vitest";
import {
  applyForegroundSample,
  buildDesktopSyncPayloadEntries,
  createInitialDesktopTrackerState,
  formatLocalDateKey,
} from "../tracker";

describe("Windows desktop application tracker accumulator", () => {
  it("tracks active foreground executables and skips lockscreen/idle intervals", () => {
    let state = createInitialDesktopTrackerState();
    const t0 = new Date("2026-11-12T10:00:00Z").getTime();

    state = applyForegroundSample(state, {
      processName: "Code.exe",
      idleMs: 200,
      timestampMs: t0,
    });
    state = applyForegroundSample(state, {
      processName: "Code.exe",
      idleMs: 1200,
      timestampMs: t0 + 5_000,
    });
    // Idle sample exceeds 60s threshold -> pauses credit
    state = applyForegroundSample(state, {
      processName: "Code.exe",
      idleMs: 65_000,
      timestampMs: t0 + 70_000,
    });
    // Resume on WindowsTerminal.exe
    state = applyForegroundSample(state, {
      processName: "WindowsTerminal.exe",
      idleMs: 100,
      timestampMs: t0 + 75_000,
    });
    state = applyForegroundSample(state, {
      processName: "WindowsTerminal.exe",
      idleMs: 500,
      timestampMs: t0 + 83_000,
    });

    const today = formatLocalDateKey(t0);
    expect(state.dailyUsage[today]?.["code.exe"]?.activeSeconds).toBe(5);
    expect(state.dailyUsage[today]?.["code.exe"]?.displayName).toBe("VS Code");
    expect(state.dailyUsage[today]?.["windowsterminal.exe"]?.activeSeconds).toBe(8);
    expect(state.dailyUsage[today]?.["windowsterminal.exe"]?.displayName).toBe(
      "Windows Terminal"
    );

    const payload = buildDesktopSyncPayloadEntries(state.dailyUsage);
    expect(payload).toHaveLength(2);
    expect(payload.every((row) => !("windowTitle" in row))).toBe(true);
  });

  it("ignores Windows lock screen noise", () => {
    let state = createInitialDesktopTrackerState();
    const t0 = Date.now();
    state = applyForegroundSample(state, {
      processName: "LockApp.exe",
      idleMs: 0,
      timestampMs: t0,
    });
    expect(Object.keys(state.dailyUsage)).toHaveLength(0);
  });
});
