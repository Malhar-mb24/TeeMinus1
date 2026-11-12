import { isValidUuid, requireAuthenticatedApiSession } from "@/lib/api-auth";
import { transitionFocusSessionForUser } from "@ember/database";
import { updateFocusSessionSchema } from "@ember/shared";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuthenticatedApiSession();
  if (!authResult.ok) return authResult.response;

  const { id } = await context.params;
  if (!isValidUuid(id)) {
    return NextResponse.json({ error: "Invalid session identifier" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const parsed = updateFocusSessionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid focus session action",
        issues: parsed.error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
      },
      { status: 400 }
    );
  }

  try {
    const result = await transitionFocusSessionForUser(
      authResult.userContext.profile.id,
      id,
      authResult.userContext.preferences.timezone,
      parsed.data
    );
    if (!result) {
      return NextResponse.json({ error: "Focus session not found" }, { status: 404 });
    }
    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { error: "Unable to update focus session" },
      { status: 500 }
    );
  }
}
