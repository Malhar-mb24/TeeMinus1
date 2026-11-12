import { requireAuthenticatedApiSession } from "@/lib/api-auth";
import { getActiveGoalsForUser, upsertGoalForUser } from "@ember/database";
import { upsertGoalSchema } from "@ember/shared";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const authResult = await requireAuthenticatedApiSession();
  if (!authResult.ok) return authResult.response;

  try {
    const goals = await getActiveGoalsForUser(
      authResult.userContext.profile.id,
      authResult.userContext.preferences.timezone
    );
    return NextResponse.json({ goals });
  } catch {
    return NextResponse.json({ error: "Unable to load goals" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const authResult = await requireAuthenticatedApiSession();
  if (!authResult.ok) return authResult.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const parsed = upsertGoalSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid goal payload",
        issues: parsed.error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
      },
      { status: 400 }
    );
  }

  try {
    const goal = await upsertGoalForUser(
      authResult.userContext.profile.id,
      authResult.userContext.preferences.timezone,
      parsed.data
    );
    return NextResponse.json({ goal });
  } catch {
    return NextResponse.json({ error: "Unable to save goal" }, { status: 500 });
  }
}
