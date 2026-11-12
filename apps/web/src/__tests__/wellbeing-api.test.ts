import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearRateLimitStoreForTests } from "@/lib/rate-limit";

const mockRequireApi = vi.fn();
const mockCreatePairingCode = vi.fn();
const mockPairDevice = vi.fn();
const mockAuthenticateDeviceToken = vi.fn();
const mockSyncDeviceWellbeingData = vi.fn();
const mockListDevicesForUser = vi.fn();
const mockRevokeDeviceForUser = vi.fn();
const mockGetWellbeingSummaryForUser = vi.fn();
const mockUpsertUsageCategoryForUser = vi.fn();
const mockDeleteWellbeingDataForUser = vi.fn();

vi.mock("@/lib/api-auth", () => ({
  isValidUuid: (val: string) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      val
    ),
  requireAuthenticatedApiSession: (...args: unknown[]) => mockRequireApi(...args),
}));

vi.mock("@ember/shared", async () => {
  const actual = await vi.importActual<typeof import("@ember/shared")>("@ember/shared");
  return {
    ...actual,
    getEnvReadiness: () => ({
      databaseConfigured: true,
      clerkConfigured: true,
      fullyConfigured: true,
      missingOrInvalidKeys: [],
    }),
  };
});

vi.mock("@ember/database", async () => {
  const actual = await vi.importActual<typeof import("@ember/database")>("@ember/database");
  return {
    ...actual,
    createPairingCodeForUser: (...args: unknown[]) => mockCreatePairingCode(...args),
    pairDeviceWithCode: (...args: unknown[]) => mockPairDevice(...args),
    authenticateDeviceToken: (...args: unknown[]) => mockAuthenticateDeviceToken(...args),
    syncDeviceWellbeingData: (...args: unknown[]) => mockSyncDeviceWellbeingData(...args),
    listDevicesForUser: (...args: unknown[]) => mockListDevicesForUser(...args),
    revokeDeviceForUser: (...args: unknown[]) => mockRevokeDeviceForUser(...args),
    getWellbeingSummaryForUser: (...args: unknown[]) =>
      mockGetWellbeingSummaryForUser(...args),
    upsertUsageCategoryForUser: (...args: unknown[]) =>
      mockUpsertUsageCategoryForUser(...args),
    deleteWellbeingDataForUser: (...args: unknown[]) =>
      mockDeleteWellbeingDataForUser(...args),
  };
});

import { GET as getDevices } from "@/app/api/devices/route";
import { POST as postPairingCode } from "@/app/api/devices/pairing-code/route";
import { POST as postPairDevice } from "@/app/api/devices/pair/route";
import { POST as postRevokeDevice } from "@/app/api/devices/[id]/revoke/route";
import { GET as getWellbeing } from "@/app/api/wellbeing/route";
import { POST as postWellbeingSync } from "@/app/api/wellbeing/sync/route";
import { PUT as putWellbeingCategory } from "@/app/api/wellbeing/categories/route";
import { DELETE as deleteWellbeingData } from "@/app/api/wellbeing/data/route";
import { WellbeingServiceError } from "@ember/database";

const AUTH_OK = {
  ok: true,
  userContext: {
    profile: { id: "11111111-1111-4111-8111-111111111111" },
    preferences: { timezone: "Asia/Kolkata", extensionTrackingConsent: true },
  },
};

describe("Batch 02 Wellbeing & Device API security, validation, and lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearRateLimitStoreForTests();
  });

  it("blocks unauthenticated callers across user wellbeing and device routes", async () => {
    mockRequireApi.mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ error: "Authentication required" }), {
        status: 401,
      }),
    });

    expect((await getWellbeing(new Request("http://localhost/api/wellbeing"))).status).toBe(401);
    expect((await getDevices()).status).toBe(401);
    expect(
      (
        await postPairingCode(
          new Request("http://localhost/api/devices/pairing-code", { method: "POST" })
        )
      ).status
    ).toBe(401);
  });

  it("rejects missing or invalid bearer tokens on POST /api/wellbeing/sync", async () => {
    const missingAuth = await postWellbeingSync(
      new Request("http://localhost/api/wellbeing/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries: [] }),
      })
    );
    expect(missingAuth.status).toBe(401);

    mockAuthenticateDeviceToken.mockResolvedValueOnce(null);
    const revokedAuth = await postWellbeingSync(
      new Request("http://localhost/api/wellbeing/sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer emb_dev_revokedtoken1234567890abcdef12345678",
        },
        body: JSON.stringify({ entries: [] }),
      })
    );
    expect(revokedAuth.status).toBe(401);
  });

  it("rejects sync payloads containing full URLs or paths and enforces opt-in consent", async () => {
    mockAuthenticateDeviceToken.mockResolvedValue({
      deviceId: "22222222-2222-4222-8222-222222222222",
      userId: "11111111-1111-4111-8111-111111111111",
      deviceName: "Work Chrome",
      deviceType: "chrome_extension",
      syncConsentEnabled: false,
      timezone: "UTC",
    });

    const today = new Date().toISOString().slice(0, 10);
    const badHostname = await postWellbeingSync(
      new Request("http://localhost/api/wellbeing/sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer emb_dev_validtoken1234567890abcdef1234567890",
        },
        body: JSON.stringify({
          entries: [
            {
              hostname: "https://github.com/private/repo?secret=1",
              localDate: today,
              activeSeconds: 90,
              visitCount: 2,
            },
          ],
        }),
      })
    );
    expect(badHostname.status).toBe(400);

    mockSyncDeviceWellbeingData.mockRejectedValueOnce(
      new WellbeingServiceError("CONSENT_REQUIRED", "Sync consent is disabled.", 403)
    );
    const noConsent = await postWellbeingSync(
      new Request("http://localhost/api/wellbeing/sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer emb_dev_validtoken1234567890abcdef1234567890",
        },
        body: JSON.stringify({
          entries: [
            {
              hostname: "github.com",
              localDate: today,
              activeSeconds: 90,
              visitCount: 2,
            },
          ],
        }),
      })
    );
    expect(noConsent.status).toBe(403);
  });

  it("completes sync cleanly when bearer token is active and consent is enabled", async () => {
    mockAuthenticateDeviceToken.mockResolvedValue({
      deviceId: "22222222-2222-4222-8222-222222222222",
      userId: "11111111-1111-4111-8111-111111111111",
      deviceName: "Windows Tracker",
      deviceType: "windows_desktop",
      syncConsentEnabled: true,
      timezone: "UTC",
    });
    mockSyncDeviceWellbeingData.mockResolvedValue({
      deviceId: "22222222-2222-4222-8222-222222222222",
      syncedWebsiteRows: 1,
      syncedDesktopAppRows: 1,
      lastSeenAt: new Date().toISOString(),
    });

    const today = new Date().toISOString().slice(0, 10);
    const okRes = await postWellbeingSync(
      new Request("http://localhost/api/wellbeing/sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer emb_dev_validtoken1234567890abcdef1234567890",
        },
        body: JSON.stringify({
          entries: [{ hostname: "docs.python.org", localDate: today, activeSeconds: 240, visitCount: 3 }],
          appEntries: [{ appName: "code.exe", localDate: today, activeSeconds: 600, launchCount: 2 }],
        }),
      })
    );
    expect(okRes.status).toBe(200);
    const data = (await okRes.json()) as { syncedWebsiteRows: number; syncedDesktopAppRows: number };
    expect(data.syncedWebsiteRows).toBe(1);
    expect(data.syncedDesktopAppRows).toBe(1);
  });

  it("rate-limits repeated pairing failures and handles invalid/cross-user revoke cleanly", async () => {
    mockPairDevice.mockRejectedValue(
      new WellbeingServiceError("INVALID_PAIRING_CODE", "Invalid pairing code.", 401)
    );

    for (let i = 0; i < 15; i += 1) {
      const res = await postPairDevice(
        new Request("http://localhost/api/devices/pair", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-forwarded-for": "203.0.113.10" },
          body: JSON.stringify({
            pairingCode: "ABCD-EFGH",
            deviceName: "Test Chrome",
            deviceType: "chrome_extension",
          }),
        })
      );
      expect(res.status).toBe(401);
    }

    const rateLimited = await postPairDevice(
      new Request("http://localhost/api/devices/pair", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-forwarded-for": "203.0.113.10" },
        body: JSON.stringify({
          pairingCode: "ABCD-EFGH",
          deviceName: "Test Chrome",
          deviceType: "chrome_extension",
        }),
      })
    );
    expect(rateLimited.status).toBe(429);

    mockRequireApi.mockResolvedValue(AUTH_OK);
    const badId = await postRevokeDevice(new Request("http://localhost/api/devices/bad/revoke", { method: "POST" }), {
      params: Promise.resolve({ id: "not-a-uuid" }),
    });
    expect(badId.status).toBe(400);

    mockRevokeDeviceForUser.mockResolvedValueOnce(null);
    const notFound = await postRevokeDevice(
      new Request("http://localhost/api/devices/33333333-3333-4333-8333-333333333333/revoke", {
        method: "POST",
      }),
      { params: Promise.resolve({ id: "33333333-3333-4333-8333-333333333333" }) }
    );
    expect(notFound.status).toBe(404);
  });

  it("updates custom usage category and deletes user wellbeing data", async () => {
    mockRequireApi.mockResolvedValue(AUTH_OK);
    mockUpsertUsageCategoryForUser.mockResolvedValue({
      targetType: "desktop_app",
      pattern: "code.exe",
      category: "productive",
    });

    const catRes = await putWellbeingCategory(
      new Request("http://localhost/api/wellbeing/categories", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetType: "desktop_app",
          pattern: "Code.exe",
          category: "productive",
        }),
      })
    );
    expect(catRes.status).toBe(200);

    mockDeleteWellbeingDataForUser.mockResolvedValue({
      deletedWebsiteRows: 4,
      deletedAppRows: 2,
    });
    const delRes = await deleteWellbeingData();
    expect(delRes.status).toBe(200);
    const delBody = (await delRes.json()) as { deletedWebsiteRows: number; deletedAppRows: number };
    expect(delBody.deletedWebsiteRows).toBe(4);
    expect(delBody.deletedAppRows).toBe(2);
  });
});
