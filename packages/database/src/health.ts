import { sql } from "drizzle-orm";
import { getDb, isDatabaseConfigured, type EmberDatabase } from "./client";

export interface DatabaseHealthResult {
  status: "connected" | "unconfigured" | "error";
  latencyMs: number | null;
  errorCode: string | null;
}

export async function checkDatabaseHealth(
  dbOverride?: EmberDatabase
): Promise<DatabaseHealthResult> {
  if (!dbOverride && !isDatabaseConfigured()) {
    return {
      status: "unconfigured",
      latencyMs: null,
      errorCode: "MISSING_DATABASE_URL",
    };
  }

  const startedAt = Date.now();
  try {
    const db = dbOverride ?? getDb();
    await db.execute(sql`SELECT 1`);
    return {
      status: "connected",
      latencyMs: Date.now() - startedAt,
      errorCode: null,
    };
  } catch {
    return {
      status: "error",
      latencyMs: Date.now() - startedAt,
      errorCode: "DATABASE_QUERY_FAILED",
    };
  }
}
