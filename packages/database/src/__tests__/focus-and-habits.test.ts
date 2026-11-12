import { describe, expect, it } from "vitest";
import type { EmberDatabase } from "../client";
import { computeElapsedSessionSeconds } from "../focus";
import { checkInHabitForUser } from "../habits";

describe("focus session elapsed time and habit date guards", () => {
  it("computes accumulated seconds accurately while running vs paused", () => {
    const now = new Date("2026-11-12T10:30:00.000Z");

    expect(
      computeElapsedSessionSeconds(
        {
          status: "paused",
          accumulatedSeconds: 420,
          lastResumedAt: new Date("2026-11-12T10:00:00.000Z"),
        },
        now
      )
    ).toBe(420);

    expect(
      computeElapsedSessionSeconds(
        {
          status: "running",
          accumulatedSeconds: 300,
          lastResumedAt: new Date("2026-11-12T10:25:00.000Z"),
        },
        now
      )
    ).toBe(600);
  });

  it("rejects future calendar check-ins and rewriting old historical dates", async () => {
    const mockDb = {} as EmberDatabase;

    await expect(
      checkInHabitForUser(
        "11111111-1111-1111-1111-111111111111",
        "22222222-2222-2222-2222-222222222222",
        "UTC",
        { localDate: "2099-01-01", action: "complete" },
        mockDb
      )
    ).rejects.toThrow("Cannot record habit check-ins for future dates");

    await expect(
      checkInHabitForUser(
        "11111111-1111-1111-1111-111111111111",
        "22222222-2222-2222-2222-222222222222",
        "UTC",
        { localDate: "2020-01-01", action: "complete" },
        mockDb
      )
    ).rejects.toThrow("Historical habit entries older than yesterday cannot be overwritten");
  });
});
