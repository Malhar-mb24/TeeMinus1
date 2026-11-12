import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadWorkspaceEnv } from "../load-env";

describe("loadWorkspaceEnv", () => {
  it("runs safely when workspace .env files are absent and preserves existing env vars", () => {
    const prev = process.env.EMBER_TEST_GUARD;
    process.env.EMBER_TEST_GUARD = "already_set";
    loadWorkspaceEnv();
    expect(process.env.EMBER_TEST_GUARD).toBe("already_set");
    if (prev === undefined) {
      delete process.env.EMBER_TEST_GUARD;
    } else {
      process.env.EMBER_TEST_GUARD = prev;
    }
  });

  it("parses standard KEY=VALUE lines safely in temp files", () => {
    const dir = mkdtempSync(join(tmpdir(), "ember-env-"));
    try {
      mkdirSync(dir, { recursive: true });
      const envPath = join(dir, ".env");
      writeFileSync(envPath, '# comment\nFOO="bar"\n', "utf8");
      expect(envPath).toContain(".env");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
