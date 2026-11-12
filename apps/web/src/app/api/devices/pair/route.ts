import {
  buildDeviceCorsHeaders,
  checkRateLimit,
  getClientIdentifier,
} from "@/lib/rate-limit";
import { WellbeingServiceError, pairDeviceWithCode } from "@ember/database";
import { getEnvReadiness, pairDeviceSchema } from "@ember/shared";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function OPTIONS(request: Request) {
  return new NextResponse(null, {
    status: 204,
    headers: buildDeviceCorsHeaders(request),
  });
}

export async function POST(request: Request) {
  const corsHeaders = buildDeviceCorsHeaders(request);

  if (!getEnvReadiness(process.env).databaseConfigured) {
    return NextResponse.json(
      { error: "Database is not ready" },
      { status: 503, headers: corsHeaders }
    );
  }

  const clientIp = getClientIdentifier(request);
  const rate = checkRateLimit(`pair:${clientIp}`, 15, 10 * 60 * 1000);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many pairing attempts. Please try again later." },
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

  const parsed = pairDeviceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid pairing payload",
        issues: parsed.error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
      },
      { status: 400, headers: corsHeaders }
    );
  }

  try {
    const result = await pairDeviceWithCode(parsed.data);
    return NextResponse.json(
      {
        device: result.device,
        token: result.bearerToken,
      },
      { status: 201, headers: corsHeaders }
    );
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
