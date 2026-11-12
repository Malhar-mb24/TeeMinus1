import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

export type EmberDatabase = NodePgDatabase<typeof schema>;

interface GlobalDbCache {
  __emberPgPool?: Pool;
  __emberDb?: EmberDatabase;
  __emberDbUrl?: string;
}

const globalForDb = globalThis as unknown as GlobalDbCache;

function isValidPostgresUrl(url: string | undefined): url is string {
  if (!url) return false;
  const trimmed = url.trim();
  return trimmed.startsWith("postgres://") || trimmed.startsWith("postgresql://");
}

export function isDatabaseConfigured(): boolean {
  return isValidPostgresUrl(process.env.DATABASE_URL);
}

export function getDb(): EmberDatabase {
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!isValidPostgresUrl(connectionString)) {
    throw new Error(
      "Database is not configured. Set a valid PostgreSQL connection string in DATABASE_URL."
    );
  }

  if (
    globalForDb.__emberDb &&
    globalForDb.__emberDbUrl === connectionString
  ) {
    return globalForDb.__emberDb;
  }

  const requiresSsl =
    connectionString.includes("neon.tech") ||
    connectionString.includes("sslmode=require");

  const pool = new Pool({
    connectionString,
    max: 5,
    idleTimeoutMillis: 20_000,
    connectionTimeoutMillis: 5_000,
    ...(requiresSsl ? { ssl: { rejectUnauthorized: true } } : {}),
  });

  const db = drizzle(pool, { schema });

  globalForDb.__emberPgPool = pool;
  globalForDb.__emberDb = db;
  globalForDb.__emberDbUrl = connectionString;

  return db;
}

export async function closeDbPool(): Promise<void> {
  if (globalForDb.__emberPgPool) {
    await globalForDb.__emberPgPool.end();
    globalForDb.__emberPgPool = undefined;
    globalForDb.__emberDb = undefined;
    globalForDb.__emberDbUrl = undefined;
  }
}
