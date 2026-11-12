import { requireAuthenticatedApiSession } from "@/lib/api-auth";
import { createHabitForUser, listHabitsWithStatsForUser } from "@ember/database";
import { createHabitSchema } from "@ember/shared";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authResult = await requireAuthenticatedApiSession();
  if (!authResult.ok) return authResult.response;

  const url = new URL(request.url);
  const category = url.searchParams.get("category") ?? undefined;
  const includeArchived = url.searchParams.get("archived") === "true";

  try {
    const habits = await listHabitsWithStatsForUser(
      authResult.userContext.profile.id,
      authResult.userContext.preferences.timezone,
      { category, includeArchived }
    );
    return NextResponse.json({ habits });
  } catch {
    return NextResponse.json({ error: "Unable to load habits" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const authResult = await requireAuthenticatedApiSession();
  if (!authResult.ok) return authResult.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const parsed = createHabitSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid habit payload",
        issues: parsed.error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
      },
      { status: 400 }
    );
  }

  try {
    const habit = await createHabitForUser(
      authResult.userContext.profile.id,
      authResult.userContext.preferences.timezone,
      parsed.data
    );
    return NextResponse.json({ habit }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Unable to create habit" }, { status: 500 });
  }
}
