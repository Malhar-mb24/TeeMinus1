import { requireAuthenticatedApiSession } from "@/lib/api-auth";
import { completeOnboardingForUser } from "@ember/database";
import { completeOnboardingSchema } from "@ember/shared";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const authResult = await requireAuthenticatedApiSession();
  if (!authResult.ok) return authResult.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const parsed = completeOnboardingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid onboarding configuration",
        issues: parsed.error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
      },
      { status: 400 }
    );
  }

  try {
    const preferences = await completeOnboardingForUser(
      authResult.userContext.profile.id,
      parsed.data
    );
    return NextResponse.json({ ok: true, preferences });
  } catch {
    return NextResponse.json(
      { error: "Unable to complete onboarding" },
      { status: 500 }
    );
  }
}
