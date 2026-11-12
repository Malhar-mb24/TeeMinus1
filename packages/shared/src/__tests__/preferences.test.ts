import { describe, expect, it } from "vitest";
import { formatMinutesLabel } from "../health";
import { isValidIanaTimezone, updateUserPreferencesSchema } from "../preferences";

describe("shared preferences & helpers", () => {
  it("validates IANA timezones accurately", () => {
    expect(isValidIanaTimezone("UTC")).toBe(true);
    expect(isValidIanaTimezone("Asia/Kolkata")).toBe(true);
    expect(isValidIanaTimezone("America/New_York")).toBe(true);
    expect(isValidIanaTimezone("Mars/Olympus_Mons")).toBe(false);
  });

  it("validates partial preference updates and rejects out-of-range values", () => {
    const valid = updateUserPreferencesSchema.safeParse({
      timezone: "Asia/Kolkata",
      pomodoroMinutes: 50,
      dailyFocusGoalMinutes: 180,
      extensionTrackingConsent: true,
    });
    expect(valid.success).toBe(true);

    const invalid = updateUserPreferencesSchema.safeParse({
      pomodoroMinutes: 1,
      dailyFocusGoalMinutes: 9999,
      timezone: "Invalid/Zone",
    });
    expect(invalid.success).toBe(false);
  });

  it("formats focus minutes cleanly", () => {
    expect(formatMinutesLabel(0)).toBe("0m");
    expect(formatMinutesLabel(45)).toBe("45m");
    expect(formatMinutesLabel(120)).toBe("2h");
    expect(formatMinutesLabel(155)).toBe("2h 35m");
  });
});
