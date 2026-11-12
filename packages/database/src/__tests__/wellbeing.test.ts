import { describe, expect, it, vi } from "vitest";
import {
  WellbeingServiceError,
  generateDeviceBearerToken,
  generatePairingCode,
  hashSecretToken,
  syncDeviceWellbeingData,
} from "../wellbeing";
import type { EmberDatabase } from "../client";

describe("wellbeing database helpers", () => {
  it("hashes secrets deterministically with SHA-256 and never embeds plaintext", () => {
    const token = generateDeviceBearerToken();
    expect(token.startsWith("emb_dev_")).toBe(true);
    expect(token.length).toBeGreaterThanOrEqual(40);

    const hashA = hashSecretToken(token);
    const hashB = hashSecretToken(token);
    expect(hashA).toBe(hashB);
    expect(hashA).toHaveLength(64);
    expect(hashA).not.toContain(token);
  });

  it("generates uppercase pairing codes with 4-4 formatting", () => {
    const code = generatePairingCode();
    expect(code).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  });

  it("refuses sync when user consent is disabled", async () => {
    const fakeDb = { transaction: vi.fn() } as unknown as EmberDatabase;
    await expect(
      syncDeviceWellbeingData(
        {
          userId: "00000000-0000-0000-0000-000000000001",
          deviceId: "00000000-0000-0000-0000-000000000002",
          syncConsentEnabled: false,
          entries: [
            {
              hostname: "github.com",
              localDate: "2026-11-12",
              activeSeconds: 60,
              visitCount: 2,
            },
          ],
          appEntries: [],
        },
        fakeDb
      )
    ).rejects.toThrowError(WellbeingServiceError);
  });

  it("coalesces duplicate entries before executing idempotent DB upsert", async () => {
    const insertedWebsiteBatches: unknown[] = [];
    const insertedAppBatches: unknown[] = [];

    const txMock = {
      insert: vi.fn(() => ({
        values: vi.fn((vals: unknown) => {
          if (Array.isArray(vals) && vals[0] && "hostname" in vals[0]) {
            insertedWebsiteBatches.push(vals);
          } else if (Array.isArray(vals) && vals[0] && "appName" in vals[0]) {
            insertedAppBatches.push(vals);
          }
          return {
            onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
          };
        }),
      })),
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn().mockResolvedValue(undefined),
        })),
      })),
    };

    const fakeDb = {
      transaction: vi.fn(async (fn: (tx: typeof txMock) => Promise<void>) => fn(txMock)),
    } as unknown as EmberDatabase;

    const result = await syncDeviceWellbeingData(
      {
        userId: "00000000-0000-0000-0000-000000000001",
        deviceId: "00000000-0000-0000-0000-000000000002",
        syncConsentEnabled: true,
        entries: [
          { hostname: "github.com", localDate: "2026-11-12", activeSeconds: 120, visitCount: 2 },
          { hostname: "github.com", localDate: "2026-11-12", activeSeconds: 185, visitCount: 4 },
        ],
        appEntries: [
          {
            appName: "code.exe",
            displayName: "VS Code",
            localDate: "2026-11-12",
            activeSeconds: 300,
            launchCount: 1,
          },
        ],
      },
      fakeDb
    );

    expect(result.syncedWebsiteRows).toBe(1);
    expect(result.syncedDesktopAppRows).toBe(1);
    expect(insertedWebsiteBatches).toHaveLength(1);
    const websiteRow = (insertedWebsiteBatches[0] as Array<{ activeSeconds: number }>)[0];
    expect(websiteRow?.activeSeconds).toBe(185);
    expect(insertedAppBatches).toHaveLength(1);
  });
});
