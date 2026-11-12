import { describe, expect, it } from "vitest";
import {
  classifyFocusOutcome,
  computeSessionPauseGapSeconds,
} from "../intelligence";
import {
  DEFAULT_REMINDER_SETTINGS,
  evaluateDueReminders,
  isWithinQuietHours,
} from "../reminders";

describe("Batch 03 reminders & focus intelligence shared logic", () => {
  it("handles overnight and same-day quiet hours accurately", () => {
    // Overnight 22:00 -> 07:30
    expect(isWithinQuietHours("23:15", "22:00", "07:30")).toBe(true);
    expect(isWithinQuietHours("06:45", "22:00", "07:30")).toBe(true);
    expect(isWithinQuietHours("07:30", "22:00", "07:30")).toBe(false);
    expect(isWithinQuietHours("14:00", "22:00", "07:30")).toBe(false);

    // Same-day 13:00 -> 14:30
    expect(isWithinQuietHours("13:45", "13:00", "14:30")).toBe(true);
    expect(isWithinQuietHours("15:00", "13:00", "14:30")).toBe(false);
  });

  it("never triggers reminders when consent is off or inside quiet hours", () => {
    const off = evaluateDueReminders({
      settings: {
        ...DEFAULT_REMINDER_SETTINGS,
        notificationsEnabled: false,
        focusReminderEnabled: true,
        dailyGoalReminderEnabled: true,
      },
      currentHm: "19:00",
      activeFocusMinutesElapsed: 60,
      isFocusRunning: true,
      todayFocusMinutes: 0,
      dailyFocusGoalMinutes: 120,
      incompleteHabitsTodayCount: 2,
    });
    expect(off).toHaveLength(0);

    const quiet = evaluateDueReminders({
      settings: {
        ...DEFAULT_REMINDER_SETTINGS,
        notificationsEnabled: true,
        focusReminderEnabled: true,
        habitReminderEnabled: true,
        quietHoursEnabled: true,
        quietHoursStart: "22:00",
        quietHoursEnd: "07:30",
      },
      currentHm: "22:30",
      activeFocusMinutesElapsed: 0,
      isFocusRunning: false,
      todayFocusMinutes: 0,
      dailyFocusGoalMinutes: 120,
      incompleteHabitsTodayCount: 2,
    });
    expect(quiet).toHaveLength(0);
  });

  it("evaluates due focus, break, goal, and habit reminders and skips already sent items", () => {
    const due = evaluateDueReminders({
      settings: {
        ...DEFAULT_REMINDER_SETTINGS,
        notificationsEnabled: true,
        focusReminderEnabled: true,
        focusReminderTime: "09:00",
        breakReminderEnabled: true,
        breakIntervalMinutes: 50,
        dailyGoalReminderEnabled: true,
        dailyGoalReminderTime: "18:00",
        habitReminderEnabled: true,
        habitReminderTime: "19:00",
        quietHoursEnabled: false,
      },
      currentHm: "20:00",
      activeFocusMinutesElapsed: 55,
      isFocusRunning: true,
      todayFocusMinutes: 45,
      dailyFocusGoalMinutes: 120,
      incompleteHabitsTodayCount: 2,
      alreadySentIds: new Set(["daily_goal"]),
    });

    const ids = due.map((item) => item.id);
    expect(ids).toContain("break");
    expect(ids).toContain("habit");
    expect(ids).not.toContain("daily_goal");
    // focus reminder skipped when todayFocusMinutes > 0 or focus is running
    expect(ids).not.toContain("focus");
  });

  it("classifies focus session outcomes and computes observed pause gaps", () => {
    expect(
      classifyFocusOutcome({
        status: "completed",
        mode: "pomodoro",
        accumulatedSeconds: 1500,
        plannedDurationSeconds: 1500,
      })
    ).toBe("deep_completion");

    expect(
      classifyFocusOutcome({
        status: "interrupted",
        mode: "pomodoro",
        accumulatedSeconds: 600,
        plannedDurationSeconds: 1500,
      })
    ).toBe("interrupted");

    const start = Date.parse("2026-11-12T10:00:00Z");
    const end = Date.parse("2026-11-12T10:30:00Z"); // 1800s wall clock
    expect(
      computeSessionPauseGapSeconds({
        startedAtMs: start,
        endedAtMs: end,
        accumulatedSeconds: 1500,
      })
    ).toBe(300);
  });
});
