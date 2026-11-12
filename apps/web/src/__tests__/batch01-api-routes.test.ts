import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRequireApi = vi.fn();
const mockCreateTask = vi.fn();
const mockUpdateTask = vi.fn();
const mockStartFocus = vi.fn();
const mockTransitionFocus = vi.fn();
const mockCheckInHabit = vi.fn();

vi.mock("@/lib/api-auth", () => ({
  isValidUuid: (val: string) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      val
    ),
  requireAuthenticatedApiSession: (...args: unknown[]) => mockRequireApi(...args),
}));

vi.mock("@ember/database", () => ({
  createTaskForUser: (...args: unknown[]) => mockCreateTask(...args),
  listTasksForUser: vi.fn().mockResolvedValue([]),
  updateTaskForUser: (...args: unknown[]) => mockUpdateTask(...args),
  deleteTaskForUser: vi.fn().mockResolvedValue(false),
  startFocusSessionForUser: (...args: unknown[]) => mockStartFocus(...args),
  transitionFocusSessionForUser: (...args: unknown[]) =>
    mockTransitionFocus(...args),
  getActiveFocusSessionForUser: vi.fn().mockResolvedValue(null),
  listFocusSessionsForUser: vi.fn().mockResolvedValue([]),
  checkInHabitForUser: (...args: unknown[]) => mockCheckInHabit(...args),
  getAnalyticsSummaryForUser: vi.fn(),
  getGamificationSummaryForUser: vi.fn(),
}));

import { GET as getAnalytics } from "@/app/api/analytics/route";
import { PATCH as patchFocusSession } from "@/app/api/focus-sessions/[id]/route";
import { POST as postFocusSession } from "@/app/api/focus-sessions/route";
import { POST as postHabitCheckin } from "@/app/api/habits/[id]/checkin/route";
import { POST as postTask } from "@/app/api/tasks/route";
import { PATCH as patchTask } from "@/app/api/tasks/[id]/route";

const AUTH_OK = {
  ok: true,
  userContext: {
    profile: { id: "11111111-1111-4111-8111-111111111111" },
    preferences: { timezone: "Asia/Kolkata" },
  },
};

describe("Batch 01 API security, ownership, and validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("blocks unauthenticated callers on /api/analytics", async () => {
    mockRequireApi.mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ error: "Authentication required" }), {
        status: 401,
      }),
    });

    const res = await getAnalytics();
    expect(res.status).toBe(401);
  });

  it("validates task payloads and enforces ownership on PATCH /api/tasks/[id]", async () => {
    mockRequireApi.mockResolvedValue(AUTH_OK);

    const badRes = await postTask(
      new Request("http://localhost/api/tasks", {
        method: "POST",
        body: JSON.stringify({ title: "" }),
      })
    );
    expect(badRes.status).toBe(400);

    const badUuidRes = await patchTask(
      new Request("http://localhost/api/tasks/not-a-uuid", {
        method: "PATCH",
        body: JSON.stringify({ title: "Hijack" }),
      }),
      { params: Promise.resolve({ id: "not-a-uuid" }) }
    );
    expect(badUuidRes.status).toBe(400);

    mockUpdateTask.mockResolvedValue(null);
    const otherUserRes = await patchTask(
      new Request("http://localhost/api/tasks/22222222-2222-4222-8222-222222222222", {
        method: "PATCH",
        body: JSON.stringify({ title: "Hijack" }),
      }),
      {
        params: Promise.resolve({
          id: "22222222-2222-4222-8222-222222222222",
        }),
      }
    );
    expect(otherUserRes.status).toBe(404);
  });

  it("returns 409 conflict when starting a focus session while one is active", async () => {
    mockRequireApi.mockResolvedValue(AUTH_OK);
    mockStartFocus.mockResolvedValue({
      conflict: true,
      session: { id: "33333333-3333-4333-8333-333333333333", status: "running" },
    });

    const res = await postFocusSession(
      new Request("http://localhost/api/focus-sessions", {
        method: "POST",
        body: JSON.stringify({ mode: "pomodoro", plannedDurationSeconds: 1500 }),
      })
    );
    expect(res.status).toBe(409);
  });

  it("forwards complete action with verified userId and returns XP result", async () => {
    mockRequireApi.mockResolvedValue(AUTH_OK);
    mockTransitionFocus.mockResolvedValue({
      session: { id: "33333333-3333-4333-8333-333333333333", status: "completed" },
      xpAwarded: 35,
      newlyUnlockedAchievements: ["first_focus"],
    });

    const res = await patchFocusSession(
      new Request(
        "http://localhost/api/focus-sessions/33333333-3333-4333-8333-333333333333",
        {
          method: "PATCH",
          body: JSON.stringify({ action: "complete" }),
        }
      ),
      {
        params: Promise.resolve({
          id: "33333333-3333-4333-8333-333333333333",
        }),
      }
    );

    expect(res.status).toBe(200);
    const json = (await res.json()) as { xpAwarded: number };
    expect(json.xpAwarded).toBe(35);
    expect(mockTransitionFocus).toHaveBeenCalledWith(
      "11111111-1111-4111-8111-111111111111",
      "33333333-3333-4333-8333-333333333333",
      "Asia/Kolkata",
      expect.objectContaining({ action: "complete" })
    );
  });

  it("returns 400 when habit check-in rejects future date", async () => {
    mockRequireApi.mockResolvedValue(AUTH_OK);
    mockCheckInHabit.mockRejectedValue(
      new Error("Cannot record habit check-ins for future dates")
    );

    const res = await postHabitCheckin(
      new Request(
        "http://localhost/api/habits/44444444-4444-4444-8444-444444444444/checkin",
        {
          method: "POST",
          body: JSON.stringify({ localDate: "2099-01-01", action: "complete" }),
        }
      ),
      {
        params: Promise.resolve({
          id: "44444444-4444-4444-8444-444444444444",
        }),
      }
    );
    expect(res.status).toBe(400);
  });
});
