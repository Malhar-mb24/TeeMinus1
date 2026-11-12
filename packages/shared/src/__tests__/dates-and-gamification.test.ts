import { describe, expect, it } from "vitest";
import {
  addDaysToDateKey,
  computeHabitStats,
  getDateKeysRange,
  getLocalDateKey,
  getMonthCalendarDays,
} from "../dates";
import {
  calculateSessionXp,
  getLevelProgress,
  getUnlockedCosmeticsForLevel,
  xpRequiredForLevel,
} from "../gamification";

describe("dates and habit streak calculations", () => {
  it("formats local dates in user timezone accurately", () => {
    const utcMidnight = new Date("2026-11-12T00:30:00.000Z");
    expect(getLocalDateKey(utcMidnight, "UTC")).toBe("2026-11-12");
    expect(getLocalDateKey(utcMidnight, "America/Los_Angeles")).toBe("2026-11-11");
    expect(getLocalDateKey(utcMidnight, "Asia/Kolkata")).toBe("2026-11-12");
  });

  it("computes streaks while distinguishing skipped vs missed days", () => {
    const today = "2026-11-12";
    const stats = computeHabitStats(
      [0, 1, 2, 3, 4, 5, 6],
      [
        { localDate: "2026-11-08", status: "completed", progressCount: 1 },
        { localDate: "2026-11-09", status: "missed", progressCount: 0 },
        { localDate: "2026-11-10", status: "completed", progressCount: 1 },
        { localDate: "2026-11-11", status: "skipped", progressCount: 0 },
        { localDate: "2026-11-12", status: "completed", progressCount: 1 },
      ],
      today,
      10
    );

    expect(stats.completedDays).toBe(3);
    expect(stats.skippedDays).toBe(1);
    // Days 03, 04, 05, 06, 07, 09 have no completion (6 missed days in the 10-day window)
    expect(stats.missedDays).toBe(6);
    // Skipped day (Nov 11) preserves streak between Nov 10 and Nov 12 without counting as completed
    expect(stats.currentStreak).toBe(2);
    expect(stats.bestStreak).toBe(2);
  });

  it("builds date ranges and month calendars cleanly", () => {
    expect(addDaysToDateKey("2026-11-12", -2)).toBe("2026-11-10");
    expect(getDateKeysRange("2026-11-12", 3)).toEqual([
      "2026-11-10",
      "2026-11-11",
      "2026-11-12",
    ]);
    const nov = getMonthCalendarDays("2026-11");
    expect(nov).toHaveLength(30);
    expect(nov[0]?.dateKey).toBe("2026-11-01");
    expect(nov[29]?.dateKey).toBe("2026-11-30");
  });
});

describe("gamification calculations", () => {
  it("computes progressive level thresholds accurately", () => {
    expect(xpRequiredForLevel(1)).toBe(0);
    expect(xpRequiredForLevel(2)).toBe(100);
    expect(xpRequiredForLevel(3)).toBe(300);

    const lvl1 = getLevelProgress(50);
    expect(lvl1.level).toBe(1);
    expect(lvl1.xpToNextLevel).toBe(50);
    expect(lvl1.progressPercent).toBe(50);

    const lvl3 = getLevelProgress(350);
    expect(lvl3.level).toBe(3);
    expect(getUnlockedCosmeticsForLevel(2)).toEqual(["classic-flame", "ember-spark"]);
  });

  it("calculates server-authoritative session XP rules cleanly", () => {
    expect(
      calculateSessionXp({ mode: "pomodoro", status: "completed", actualSeconds: 1500 })
    ).toBe(35);
    expect(
      calculateSessionXp({ mode: "short_break", status: "completed", actualSeconds: 300 })
    ).toBe(0);
    expect(
      calculateSessionXp({ mode: "pomodoro", status: "cancelled", actualSeconds: 1200 })
    ).toBe(0);
    expect(
      calculateSessionXp({ mode: "pomodoro", status: "interrupted", actualSeconds: 600 })
    ).toBe(5);
    expect(
      calculateSessionXp({ mode: "stopwatch", status: "completed", actualSeconds: 120 })
    ).toBe(0);
  });
});
