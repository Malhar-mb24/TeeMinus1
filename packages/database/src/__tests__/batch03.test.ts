import { describe, expect, it, vi } from "vitest";
import { getFocusIntelligenceForUser } from "../intelligence";
import { getReminderSettingsForUser } from "../reminders";
import type { EmberDatabase } from "../client";

function createSelectChain(result: unknown[]) {
  const chain: Record<string, unknown> = {};
  chain.from = vi.fn(() => chain);
  chain.where = vi.fn(() => chain);
  chain.leftJoin = vi.fn(() => chain);
  chain.orderBy = vi.fn(() => Promise.resolve(result));
  chain.limit = vi.fn(() => Promise.resolve(result));
  chain.then = (resolve: (val: unknown[]) => unknown) => Promise.resolve(result).then(resolve);
  return chain;
}

describe("Batch 03 database reminders and intelligence services", () => {
  it("falls back cleanly to default reminder settings when user row does not exist yet", async () => {
    let callIdx = 0;
    const responses = [[], [{ notificationsEnabled: false }]];
    const fakeDb = {
      select: vi.fn(() => createSelectChain(responses[callIdx++] ?? [])),
    } as unknown as EmberDatabase;

    const settings = await getReminderSettingsForUser("user-1", fakeDb);
    expect(settings.notificationsEnabled).toBe(false);
    expect(settings.quietHoursEnabled).toBe(true);
    expect(settings.breakIntervalMinutes).toBe(50);
  });

  it("returns unknown/null tracking coverage when no devices or usage logs exist without fabricating time", async () => {
    let callIdx = 0;
    const responses = [
      [{ extensionTrackingConsent: false }],
      [],
      [],
      [],
      [],
      [],
    ];
    const fakeDb = {
      select: vi.fn(() => createSelectChain(responses[callIdx++] ?? [])),
    } as unknown as EmberDatabase;

    const intel = await getFocusIntelligenceForUser("user-1", "Asia/Kolkata", 7, fakeDb);
    expect(intel.coverage.status).toBe("none");
    expect(intel.accounting.trackedWebsiteSeconds).toBeNull();
    expect(intel.accounting.trackedDesktopSeconds).toBeNull();
    expect(intel.accounting.focusSeconds).toBe(0);
    expect(intel.distractionSignals).toHaveLength(0);
  });
});
