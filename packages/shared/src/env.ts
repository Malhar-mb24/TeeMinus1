import { z } from "zod";

const postgresUrlSchema = z
  .string()
  .trim()
  .min(1, "DATABASE_URL is required")
  .refine(
    (value) => value.startsWith("postgres://") || value.startsWith("postgresql://"),
    "DATABASE_URL must be a PostgreSQL connection string (postgres:// or postgresql://)"
  );

const clerkPublishableKeySchema = z
  .string()
  .trim()
  .min(1, "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is required")
  .refine(
    (value) => value.startsWith("pk_") && !value.includes("replace_with"),
    "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY must be a valid Clerk publishable key"
  );

const clerkSecretKeySchema = z
  .string()
  .trim()
  .min(1, "CLERK_SECRET_KEY is required")
  .refine(
    (value) => value.startsWith("sk_") && !value.includes("replace_with"),
    "CLERK_SECRET_KEY must be a valid Clerk secret key"
  );

export const clientEnvSchema = z.object({
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: clerkPublishableKeySchema,
  NEXT_PUBLIC_CLERK_SIGN_IN_URL: z.string().trim().default("/sign-in"),
  NEXT_PUBLIC_CLERK_SIGN_UP_URL: z.string().trim().default("/sign-up"),
  NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL: z.string().trim().default("/dashboard"),
  NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL: z.string().trim().default("/dashboard"),
  NEXT_PUBLIC_APP_URL: z.string().trim().url().optional(),
});

export const serverEnvSchema = clientEnvSchema.extend({
  DATABASE_URL: postgresUrlSchema,
  CLERK_SECRET_KEY: clerkSecretKeySchema,
});

export type ClientEnv = z.infer<typeof clientEnvSchema>;
export type ServerEnv = z.infer<typeof serverEnvSchema>;

export interface EnvReadiness {
  databaseConfigured: boolean;
  clerkPublishableConfigured: boolean;
  clerkSecretConfigured: boolean;
  clerkConfigured: boolean;
  fullyConfigured: boolean;
  missingOrInvalidKeys: string[];
}

export function getEnvReadiness(rawEnv: Record<string, string | undefined>): EnvReadiness {
  const missingOrInvalidKeys: string[] = [];

  const databaseConfigured = postgresUrlSchema.safeParse(rawEnv.DATABASE_URL).success;
  if (!databaseConfigured) {
    missingOrInvalidKeys.push("DATABASE_URL");
  }

  const clerkPublishableConfigured = clerkPublishableKeySchema.safeParse(
    rawEnv.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
  ).success;
  if (!clerkPublishableConfigured) {
    missingOrInvalidKeys.push("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY");
  }

  const clerkSecretConfigured = clerkSecretKeySchema.safeParse(
    rawEnv.CLERK_SECRET_KEY
  ).success;
  if (!clerkSecretConfigured) {
    missingOrInvalidKeys.push("CLERK_SECRET_KEY");
  }

  const clerkConfigured = clerkPublishableConfigured && clerkSecretConfigured;

  return {
    databaseConfigured,
    clerkPublishableConfigured,
    clerkSecretConfigured,
    clerkConfigured,
    fullyConfigured: databaseConfigured && clerkConfigured,
    missingOrInvalidKeys,
  };
}

export type ParseServerEnvResult =
  | { ok: true; data: ServerEnv }
  | { ok: false; missingOrInvalidKeys: string[]; messages: string[] };

export function parseServerEnv(
  rawEnv: Record<string, string | undefined>
): ParseServerEnvResult {
  const parsed = serverEnvSchema.safeParse({
    DATABASE_URL: rawEnv.DATABASE_URL,
    CLERK_SECRET_KEY: rawEnv.CLERK_SECRET_KEY,
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: rawEnv.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
    NEXT_PUBLIC_CLERK_SIGN_IN_URL: rawEnv.NEXT_PUBLIC_CLERK_SIGN_IN_URL || undefined,
    NEXT_PUBLIC_CLERK_SIGN_UP_URL: rawEnv.NEXT_PUBLIC_CLERK_SIGN_UP_URL || undefined,
    NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL:
      rawEnv.NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL || undefined,
    NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL:
      rawEnv.NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL || undefined,
    NEXT_PUBLIC_APP_URL: rawEnv.NEXT_PUBLIC_APP_URL || undefined,
  });

  if (parsed.success) {
    return { ok: true, data: parsed.data };
  }

  const keys = Array.from(
    new Set(
      parsed.error.issues
        .map((issue) => String(issue.path[0] ?? "ENVIRONMENT"))
        .filter(Boolean)
    )
  );

  // Never include raw env values in returned messages.
  const messages = parsed.error.issues.map(
    (issue) => `${String(issue.path[0] ?? "ENV")}: ${issue.message}`
  );

  return {
    ok: false,
    missingOrInvalidKeys: keys,
    messages,
  };
}

export function requireServerEnv(rawEnv: Record<string, string | undefined>): ServerEnv {
  const result = parseServerEnv(rawEnv);
  if (!result.ok) {
    throw new Error(
      `Invalid or missing server environment configuration (${result.missingOrInvalidKeys.join(", ")})`
    );
  }
  return result.data;
}
