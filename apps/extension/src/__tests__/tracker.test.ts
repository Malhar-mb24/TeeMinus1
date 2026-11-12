import { describe, expect, it } from "vitest";
import {
  buildSyncPayloadEntries,
  createInitialExtensionState,
  flushElapsedTime,
  formatLocalDateKey,
  setActiveTabTarget,
  setIdleStateValue,
  setPausedState,
  setWindowFocusState,
} from "../tracker";

describe("Chrome MV3 extension tracker state machine", () => {
  it("records hostname-only elapsed active time and strips full URLs", () => {
    let state = createInitialExtensionState();
    const t0 = new Date("2026-11-12T10:00:00Z").getTime();

    state = setActiveTabTarget(
      state,
      { url: "https://www.GitHub.com/user/private-repo?token=abc", incognito: false },
      t0
    );
    expect(state.activeSession.hostname).toBe("github.com");

    // Advance 45 seconds then switch to another domain
    state = setActiveTabTarget(
      state,
      { url: "https://docs.python.org/3/library/index.html", incognito: false },
      t0 + 45_000
    );

    const dayKey = formatLocalDateKey(t0);
    expect(state.dailyUsage[dayKey]?.["github.com"]?.activeSeconds).toBe(45);
    expect(state.dailyUsage[dayKey]?.["github.com"]?.visitCount).toBe(1);
    expect(state.activeSession.hostname).toBe("docs.python.org");

    const entries = buildSyncPayloadEntries(state.dailyUsage);
    expect(entries.some((e) => e.hostname === "github.com" && e.activeSeconds === 45)).toBe(
      true
    );
  });

  it("ignores incognito tabs and chrome internal URLs", () => {
    let state = createInitialExtensionState();
    const t0 = new Date("2026-11-12T10:00:00Z").getTime();

    state = setActiveTabTarget(
      state,
      { url: "https://secret-bank.example/login", incognito: true },
      t0
    );
    state = flushElapsedTime(state, t0 + 30_000);
    expect(state.activeSession.hostname).toBeNull();
    expect(Object.keys(state.dailyUsage)).toHaveLength(0);

    state = setActiveTabTarget(state, { url: "chrome://settings", incognito: false }, t0 + 40_000);
    expect(state.activeSession.hostname).toBeNull();
  });

  it("stops accumulating during idle, blur, or user pause and resumes cleanly", () => {
    let state = createInitialExtensionState();
    const t0 = new Date("2026-11-12T12:00:00Z").getTime();

    state = setActiveTabTarget(state, { url: "https://example.com/a", incognito: false }, t0);
    state = setWindowFocusState(state, false, t0 + 20_000); // flushes 20s
    state = setIdleStateValue(state, "idle", t0 + 100_000); // unfocused, should add 0s
    state = setIdleStateValue(state, "active", t0 + 120_000);
    state = setWindowFocusState(state, true, t0 + 130_000); // resumes at +130s
    state = setPausedState(state, true, t0 + 145_000); // flushes +15s = 35s total

    const dayKey = formatLocalDateKey(t0);
    expect(state.dailyUsage[dayKey]?.["example.com"]?.activeSeconds).toBe(35);
  });
});
