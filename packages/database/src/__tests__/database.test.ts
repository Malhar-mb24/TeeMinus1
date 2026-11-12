import { describe, expect, it, vi } from "vitest";
import type { EmberDatabase } from "../client";
import { checkDatabaseHealth } from "../health";
import { ensureUserProfile, updateUserPreferencesForUser } from "../users";

describe("database health and user repository", () => {
  it("reports unconfigured when DATABASE_URL is absent", async () => {
    const previous = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;

    const result = await checkDatabaseHealth();
    expect(result.status).toBe("unconfigured");
    expect(result.errorCode).toBe("MISSING_DATABASE_URL");
    expect(result.latencyMs).toBeNull();

    if (previous !== undefined) {
      process.env.DATABASE_URL = previous;
    }
  });

  it("reports connected when mocked db.execute resolves", async () => {
    const mockDb = {
      execute: vi.fn().mockResolvedValue({ rows: [{ "?column?": 1 }] }),
    } as unknown as EmberDatabase;

    const result = await checkDatabaseHealth(mockDb);
    expect(result.status).toBe("connected");
    expect(result.errorCode).toBeNull();
    expect(typeof result.latencyMs).toBe("number");
  });

  it("reports safe error without leaking exception details when db.execute rejects", async () => {
    const mockDb = {
      execute: vi
        .fn()
        .mockRejectedValue(new Error("password authentication failed for user secret_admin")),
    } as unknown as EmberDatabase;

    const result = await checkDatabaseHealth(mockDb);
    expect(result.status).toBe("error");
    expect(result.errorCode).toBe("DATABASE_QUERY_FAILED");
    expect(JSON.stringify(result)).not.toContain("secret_admin");
  });

  it("rejects ensureUserProfile when clerkUserId is empty", async () => {
    await expect(
      ensureUserProfile({ clerkUserId: "" }, {} as EmberDatabase)
    ).rejects.toThrow("Verified clerkUserId is required");
  });

  it("validates preferences via Zod before updating DB", async () => {
    const mockDb = {} as EmberDatabase;
    await expect(
      updateUserPreferencesForUser(
        "user-uuid",
        { pomodoroMinutes: 1 },
        mockDb
      )
    ).rejects.toThrow();
  });

  it("idempotently retrieves or creates user profile and preferences inside a transaction", async () => {
    const now = new Date("2026-11-11T10:00:00.000Z");
    const mockUserRow = {
      id: "11111111-1111-1111-1111-111111111111",
      clerkUserId: "user_clerk_123",
      email: "learner@example.com",
      displayName: "Alex",
      avatarUrl: null,
      onboardingCompleted: false,
      createdAt: now,
      updatedAt: now,
    };
    const mockPrefsRow = {
      id: "22222222-2222-2222-2222-222222222222",
      userId: mockUserRow.id,
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
      createdAt: now,
      updatedAt: now,
    };

    let selectCall = 0;
    const mockTx = {
      insert: vi.fn(() => ({
        values: vi.fn(() => ({
          onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
        })),
      })),
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => {
            selectCall += 1;
            if (selectCall === 1) {
              return { limit: vi.fn().mockResolvedValue([mockUserRow]) };
            }
            if (selectCall === 2) {
              return { limit: vi.fn().mockResolvedValue([mockPrefsRow]) };
            }
            return Promise.resolve([{ total: 0 }]);
          }),
        })),
      })),
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn(() => ({
            returning: vi.fn().mockResolvedValue([mockUserRow]),
          })),
        })),
      })),
    };

    const mockDb = {
      transaction: vi.fn(async (fn: (tx: typeof mockTx) => Promise<unknown>) => fn(mockTx)),
    } as unknown as EmberDatabase;

    const result = await ensureUserProfile(
      {
        clerkUserId: "user_clerk_123",
        email: "learner@example.com",
        displayName: "Alex",
      },
      mockDb
    );

    expect(result.profile.clerkUserId).toBe("user_clerk_123");
    expect(result.preferences.pomodoroMinutes).toBe(25);
    expect(result.extensionDeviceCount).toBe(0);
  });
});
