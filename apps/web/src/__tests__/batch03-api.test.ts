import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRequireApi = vi.fn();
const mockGetReminderSettings = vi.fn();
const mockUpsertReminderSettings = vi.fn();
const mockGetFocusIntelligence = vi.fn();
const mockGetAnalytics = vi.fn();
const mockGetHabits = vi.fn();
const mockGetActiveSession = vi.fn();

vi.mock("@/lib/api-auth", () => ({
  requireAuthenticatedApiSession: (...args: unknown[]) => mockRequireApi(...args),
}));

vi.mock("@ember/database", async () => {
  const actual = await vi.importActual<typeof import("@ember/database")>("@ember/database");
  return {
    ...actual,
    getReminderSettingsForUser: (...args: unknown[]) => mockGetReminderSettings(...args),
    upsertReminderSettingsForUser: (...args: unknown[]) => mockUpsertReminderSettings(...args),
    getFocusIntelligenceForUser: (...args: unknown[]) => mockGetFocusIntelligence(...args),
    getAnalyticsSummaryForUser: (...args: unknown[]) => mockGetAnalytics(...args),
    listHabitsWithStatsForUser: (...args: unknown[]) => mockGetHabits(...args),
    getActiveFocusSessionForUser: (...args: unknown[]) => mockGetActiveSession(...args),
  };
});

import { GET as getIntelligence } from "@/app/api/intelligence/route";
import { GET as getReminders, PUT as putReminders } from "@/app/api/reminders/route";

const AUTH_OK = {
  ok: true,
  userContext: {
    profile: { id: "11111111-1111-4111-8111-111111111111" },
    preferences: { timezone: "Asia/Kolkata" },
  },
};

describe("Batch 03 API routes: /api/reminders & /api/intelligence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("blocks unauthenticated callers on /api/reminders and /api/intelligence", async () => {
    mockRequireApi.mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ error: "Authentication required" }), {
        status: 401,
      }),
    });

    expect((await getReminders()).status).toBe(401);
    expect(
      (await getIntelligence(new Request("http://localhost/api/intelligence"))).status
    ).toBe(401);
  });

  it("validates reminder schedules and enforces user ownership on PUT /api/reminders", async () => {
    mockRequireApi.mockResolvedValue(AUTH_OK);

    const invalidTime = await putReminders(
      new Request("http://localhost/api/reminders", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          focusReminderTime: "25:99",
          breakIntervalMinutes: 45,
        }),
      })
    );
    expect(invalidTime.status).toBe(400);

    mockUpsertReminderSettings.mockResolvedValue({
      notificationsEnabled: true,
      focusReminderEnabled: true,
      focusReminderTime: "09:00",
      breakReminderEnabled: true,
      breakIntervalMinutes: 45,
      dailyGoalReminderEnabled: true,
      dailyGoalReminderTime: "18:30",
      habitReminderEnabled: false,
      habitReminderTime: "20:00",
      quietHoursEnabled: true,
      quietHoursStart: "22:30",
      quietHoursEnd: "07:00",
      updatedAt: "2026-11-12T10:00:00.000Z",
    });

    const validRes = await putReminders(
      new Request("http://localhost/api/reminders", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notificationsEnabled: true,
          focusReminderEnabled: true,
          focusReminderTime: "09:00",
          breakReminderEnabled: true,
          breakIntervalMinutes: 45,
          dailyGoalReminderEnabled: true,
          dailyGoalReminderTime: "18:30",
          habitReminderEnabled: false,
          habitReminderTime: "20:00",
          quietHoursEnabled: true,
          quietHoursStart: "22:30",
          quietHoursEnd: "07:00",
        }),
      })
    );
    expect(validRes.status).toBe(200);
    expect(mockUpsertReminderSettings).toHaveBeenCalledWith(
      "11111111-1111-4111-8111-111111111111",
      expect.objectContaining({ focusReminderTime: "09:00", breakIntervalMinutes: 45 })
    );
  });

  it("scopes GET /api/intelligence queries to verified user and clamps day range", async () => {
    mockRequireApi.mockResolvedValue(AUTH_OK);
    mockGetFocusIntelligence.mockResolvedValue({
      timezone: "Asia/Kolkata",
      todayDate: "2026-11-12",
      rangeDays: 14,
    });

    const res = await getIntelligence(new Request("http://localhost/api/intelligence?days=14"));
    expect(res.status).toBe(200);
    expect(mockGetFocusIntelligence).toHaveBeenCalledWith(
      "11111111-1111-4111-8111-111111111111",
      "Asia/Kolkata",
      14
    );
  });

  it("includes live active focus elapsed time and scheduled incomplete habits on GET /api/reminders", async () => {
    mockRequireApi.mockResolvedValue(AUTH_OK);
    mockGetReminderSettings.mockResolvedValue({
      notificationsEnabled: true,
      focusReminderEnabled: true,
      focusReminderTime: "09:30",
      breakReminderEnabled: true,
      breakIntervalMinutes: 50,
      dailyGoalReminderEnabled: false,
      dailyGoalReminderTime: "18:00",
      habitReminderEnabled: true,
      habitReminderTime: "20:00",
      quietHoursEnabled: true,
      quietHoursStart: "22:00",
      quietHoursEnd: "07:30",
      updatedAt: null,
    });
    mockGetAnalytics.mockResolvedValue({
      todayDate: "2026-11-12", // Thursday (dayOfWeek = 4)
      daily: { focusMinutes: 10, dailyGoalMinutes: 120 },
    });
    mockGetHabits.mockResolvedValue([
      {
        id: "hab-1",
        archived: false,
        scheduledDays: [4],
        entries: [],
      },
      {
        id: "hab-2",
        archived: false,
        scheduledDays: [4],
        entries: [{ localDate: "2026-11-12", status: "completed" }],
      },
    ]);
    mockGetActiveSession.mockResolvedValue({
      id: "sess-1",
      status: "running",
      accumulatedSeconds: 3000, // 50 minutes
      lastResumedAt: new Date(Date.now() - 120_000).toISOString(), // +2 minutes
    });

    const res = await getReminders();
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      context: {
        isFocusRunning: boolean;
        activeFocusMinutesElapsed: number;
        incompleteHabitsTodayCount: number;
      };
    };
    expect(body.context.isFocusRunning).toBe(true);
    expect(body.context.activeFocusMinutesElapsed).toBeGreaterThanOrEqual(51);
    expect(body.context.incompleteHabitsTodayCount).toBe(1);
  });
});
