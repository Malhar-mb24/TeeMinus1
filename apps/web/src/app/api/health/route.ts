import { checkDatabaseHealth } from "@ember/database";
import { getEnvReadiness, type HealthCheckResponse } from "@ember/shared";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const readiness = getEnvReadiness(process.env);
  const dbHealth = await checkDatabaseHealth();

  const isHealthy = dbHealth.status === "connected" && readiness.clerkConfigured;

  const payload: HealthCheckResponse = {
    status: isHealthy ? "ok" : "degraded",
    database: dbHealth.status,
    auth: readiness.clerkConfigured ? "configured" : "unconfigured",
    latencyMs: dbHealth.latencyMs,
    timestamp: new Date().toISOString(),
    version: "0.1.0",
  };

  return NextResponse.json(payload, {
    status: isHealthy ? 200 : 503,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
