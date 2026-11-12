import { getVerifiedSession } from "@/lib/auth";
import { updateUserPreferencesForUser } from "@ember/database";
import { updateUserPreferencesSchema } from "@ember/shared";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getVerifiedSession();

  if (session.status !== "authenticated") {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 }
    );
  }

  if (!session.databaseReady || !session.userContext) {
    return NextResponse.json(
      { error: "Database is not ready" },
      { status: 503 }
    );
  }

  return NextResponse.json({
    preferences: session.userContext.preferences,
  });
}

export async function PATCH(request: Request) {
  const session = await getVerifiedSession();

  if (session.status !== "authenticated") {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 }
    );
  }

  if (!session.databaseReady || !session.userContext) {
    return NextResponse.json(
      { error: "Database is not ready" },
      { status: 503 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON payload" },
      { status: 400 }
    );
  }

  const parsed = updateUserPreferencesSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid preferences payload",
        issues: parsed.error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
      },
      { status: 400 }
    );
  }

  try {
    const updated = await updateUserPreferencesForUser(
      session.userContext.profile.id,
      parsed.data
    );
    return NextResponse.json({ preferences: updated });
  } catch {
    return NextResponse.json(
      { error: "Unable to save preferences" },
      { status: 500 }
    );
  }
}
