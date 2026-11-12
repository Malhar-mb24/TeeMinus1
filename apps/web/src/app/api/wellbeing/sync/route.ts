import { buildDeviceCorsHeaders, checkRateLimit } from "@/lib/rate-limit";
import {
  WellbeingServiceError,
  authenticateDeviceToken,
  syncDeviceWellbeingData,
} from "@ember/database";
import { getEnvReadiness, syncWellbeingSchema } from "@ember/shared";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function OPTIONS(request: Request) {
  return new NextResponse(null, {
    status: 204,
    headers: buildDeviceCorsHeaders(request),
  });
}

function extractBearerToken(request: Request): string | null {
  const authHeader = request.headers.get("authorization") ?? "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) {
    return null;
  }
  const token = authHeader.slice(7).trim();
  return token || null;
}

export async function POST(request: Request) {
  const corsHeaders = buildDeviceCorsHeaders(request);

  if (!getEnvReadiness(process.env).databaseConfigured) {
    return NextResponse.json(
      { error: "Database is not ready" },
      { status: 503, headers: corsHeaders }
    );
  }

  const rawToken = extractBearerToken(request);
  if (!rawToken) {
    return NextResponse.json(
      { error: "Device bearer token required" },
      { status: 401, headers: corsHeaders }
    );
  }

  const device = await authenticateDeviceToken(rawToken);
  if (!device) {
    return NextResponse.json(
      { error: "Invalid or revoked device token" },
      { status: 401, headers: corsHeaders }
    );
  }

  const rate = checkRateLimit(`sync:${device.deviceId}`, 120, 10 * 60 * 1000);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Sync rate limit exceeded" },
      {
        status: 429,
        headers: {
          ...corsHeaders,
          "Retry-After": String(rate.retryAfterSeconds),
        },
      }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON payload" },
      { status: 400, headers: corsHeaders }
    );
  }

  const parsed = syncWellbeingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid wellbeing sync payload",
        issues: parsed.error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
      },
      { status: 400, headers: corsHeaders }
    );
  }

  try {
    const result = await syncDeviceWellbeingData({
      userId: device.userId,
      deviceId: device.deviceId,
      syncConsentEnabled: device.syncConsentEnabled,
      entries: parsed.data.entries,
      appEntries: parsed.data.appEntries,
    });
    return NextResponse.json(result, { status: 200, headers: corsHeaders });
  } catch (error) {
    if (error instanceof WellbeingServiceError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status, headers: corsHeaders }
      );
    }
    throw error;
  }
}
