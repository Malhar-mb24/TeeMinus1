import { defineConfig } from "drizzle-kit";
import { loadWorkspaceEnv } from "./src/load-env";

loadWorkspaceEnv();

const isGenerateOnly = process.argv.some((arg) => arg === "generate");
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl && !isGenerateOnly) {
  throw new Error(
    "DATABASE_URL is not set. Configure DATABASE_URL in shell, .env, or apps/web/.env.local before running Drizzle database commands."
  );
}

export default defineConfig({
  out: "./drizzle",
  schema: "./src/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl ?? "postgresql://placeholder:placeholder@localhost:5432/ember",
  },
  strict: true,
  verbose: true,
});
