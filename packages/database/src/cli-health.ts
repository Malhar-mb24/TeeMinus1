import { closeDbPool } from "./client";
import { checkDatabaseHealth } from "./health";

async function main() {
  const result = await checkDatabaseHealth();
  console.log(JSON.stringify(result, null, 2));
  await closeDbPool();
  process.exit(result.status === "connected" ? 0 : 1);
}

main().catch((error) => {
  console.error("Database health check failed:", error instanceof Error ? error.message : "unknown error");
  process.exit(1);
});
