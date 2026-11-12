import { describe, expect, it } from "vitest";
import { getEnvReadiness, parseServerEnv, requireServerEnv } from "../env";

describe("shared env validation", () => {
  const validEnv = {
    DATABASE_URL: "postgresql://user:supersecret@ep-demo-pooler.us-east-1.aws.neon.tech/ember?sslmode=require",
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_1234567890",
    CLERK_SECRET_KEY: "sk_test_0987654321",
    NEXT_PUBLIC_CLERK_SIGN_IN_URL: "/sign-in",
    NEXT_PUBLIC_CLERK_SIGN_UP_URL: "/sign-up",
    NEXT_PUBLIC_APP_URL: "https://ember.example.com",
  };

  it("parses a complete valid server environment", () => {
    const result = parseServerEnv(validEnv);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.NEXT_PUBLIC_CLERK_SIGN_IN_URL).toBe("/sign-in");
      expect(result.data.NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL).toBe(
        "/dashboard"
      );
      expect(result.data.NEXT_PUBLIC_APP_URL).toBe("https://ember.example.com");
    }
  });

  it("fails safely when secrets or database URL are missing without leaking values", () => {
    const result = parseServerEnv({
      DATABASE_URL: "mysql://bad-secret-value@host/db",
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_replace_with_clerk_publishable_key",
      CLERK_SECRET_KEY: "invalid-key-secret-value",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.missingOrInvalidKeys).toEqual([
        "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
        "DATABASE_URL",
        "CLERK_SECRET_KEY",
      ]);
      const joined = result.messages.join(" ");
      expect(joined).not.toContain("bad-secret-value");
      expect(joined).not.toContain("invalid-key-secret-value");
    }
  });

  it("reports granular readiness flags", () => {
    const empty = getEnvReadiness({});
    expect(empty.databaseConfigured).toBe(false);
    expect(empty.clerkConfigured).toBe(false);
    expect(empty.fullyConfigured).toBe(false);
    expect(empty.missingOrInvalidKeys).toEqual([
      "DATABASE_URL",
      "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
      "CLERK_SECRET_KEY",
    ]);

    const ready = getEnvReadiness(validEnv);
    expect(ready.fullyConfigured).toBe(true);
    expect(ready.missingOrInvalidKeys).toEqual([]);
  });

  it("requireServerEnv throws with key names only", () => {
    expect(() => requireServerEnv({ DATABASE_URL: "bad" })).toThrowError(
      /DATABASE_URL/
    );
  });
});
