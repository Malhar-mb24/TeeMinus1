import { beforeEach, describe, expect, it, vi } from "vitest";

const mockCheckDatabaseHealth = vi.fn();
const mockUpdateUserPreferencesForUser = vi.fn();
const mockGetVerifiedSession = vi.fn();

vi.mock("@ember/database", () => ({
  checkDatabaseHealth: (...args: unknown[]) => mockCheckDatabaseHealth(...args),
  updateUserPreferencesForUser: (...args: unknown[]) =>
    mockUpdateUserPreferencesForUser(...args),
}));

vi.mock("@/lib/auth", () => ({
  getVerifiedSession: (...args: unknown[]) => mockGetVerifiedSession(...args),
}));

import { GET as getHealth } from "@/app/api/health/route";
import { GET as getMe } from "@/app/api/me/route";
import { PATCH as patchPreferences } from "@/app/api/preferences/route";

describe("API routes security and validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("GET /api/health returns 503 degraded when DB/auth are unconfigured", async () => {
    mockCheckDatabaseHealth.mockResolvedValue({
      status: "unconfigured",
      latencyMs: null,
      errorCode: "MISSING_DATABASE_URL",
    });

    const response = await getHealth();
    const json = (await response.json()) as {
      status: string;
      database: string;
      auth: string;
    };

    expect(response.status).toBe(503);
    expect(json.status).toBe("degraded");
    expect(json.database).toBe("unconfigured");
  });

  it("GET /api/me rejects unauthenticated requests with 401", async () => {
    mockGetVerifiedSession.mockResolvedValue({ status: "unauthenticated" });
    const response = await getMe();
    expect(response.status).toBe(401);
  });

  it("PATCH /api/preferences rejects unauthenticated callers with 401", async () => {
    mockGetVerifiedSession.mockResolvedValue({ status: "unauthenticated" });

    const req = new Request("http://localhost:3000/api/preferences", {
      method: "PATCH",
      body: JSON.stringify({ pomodoroMinutes: 30 }),
    });
    const response = await patchPreferences(req);
    expect(response.status).toBe(401);
    expect(mockUpdateUserPreferencesForUser).not.toHaveBeenCalled();
  });

  it("PATCH /api/preferences scopes updates to verified profile ID and ignores spoofed userId", async () => {
    mockGetVerifiedSession.mockResolvedValue({
      status: "authenticated",
      clerkUserId: "clerk_user_A",
      email: "a@example.com",
      displayName: "User A",
      avatarUrl: null,
      databaseReady: true,
      databaseError: null,
      userContext: {
        profile: {
          id: "uuid-user-a",
          clerkUserId: "clerk_user_A",
          email: "a@example.com",
          displayName: "User A",
          avatarUrl: null,
          onboardingCompleted: false,
          createdAt: "2026-11-11T00:00:00.000Z",
          updatedAt: "2026-11-11T00:00:00.000Z",
        },
        preferences: {
          id: "pref-a",
          userId: "uuid-user-a",
          timezone: "UTC",
          theme: "ember-dark",
          pomodoroMinutes: 25,
          shortBreakMinutes: 5,
          longBreakMinutes: 15,
          dailyFocusGoalMinutes: 120,
          companionStyle: "classic-flame",
          soundscapePreference: "none",
          extensionTrackingConsent: false,
          extensionConsentUpdatedAt: null,
          notificationsEnabled: true,
          updatedAt: "2026-11-11T00:00:00.000Z",
        },
        extensionDeviceCount: 0,
      },
    });

    mockUpdateUserPreferencesForUser.mockResolvedValue({
      id: "pref-a",
      userId: "uuid-user-a",
      pomodoroMinutes: 45,
    });

    const req = new Request("http://localhost:3000/api/preferences", {
      method: "PATCH",
      body: JSON.stringify({
        userId: "uuid-user-b",
        pomodoroMinutes: 45,
      }),
    });

    const response = await patchPreferences(req);
    expect(response.status).toBe(200);
    expect(mockUpdateUserPreferencesForUser).toHaveBeenCalledWith(
      "uuid-user-a",
      expect.objectContaining({ pomodoroMinutes: 45 })
    );
  });

  it("PATCH /api/preferences rejects invalid input with 400", async () => {
    mockGetVerifiedSession.mockResolvedValue({
      status: "authenticated",
      clerkUserId: "clerk_user_A",
      email: "a@example.com",
      displayName: "User A",
      avatarUrl: null,
      databaseReady: true,
      databaseError: null,
      userContext: {
        profile: { id: "uuid-user-a" },
        preferences: {},
        extensionDeviceCount: 0,
      },
    });

    const req = new Request("http://localhost:3000/api/preferences", {
      method: "PATCH",
      body: JSON.stringify({ pomodoroMinutes: 2 }),
    });

    const response = await patchPreferences(req);
    expect(response.status).toBe(400);
    expect(mockUpdateUserPreferencesForUser).not.toHaveBeenCalled();
  });
});
