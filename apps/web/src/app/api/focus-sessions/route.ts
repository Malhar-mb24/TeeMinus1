import { requireAuthenticatedApiSession } from "@/lib/api-auth";
import {
  getActiveFocusSessionForUser,
  listFocusSessionsForUser,
  startFocusSessionForUser,
} from "@ember/database";
import { startFocusSessionSchema } from "@ember/shared";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authResult = await requireAuthenticatedApiSession();
  if (!authResult.ok) return authResult.response;

  const url = new URL(request.url);
  const localDate = url.searchParams.get("date") ?? undefined;
  const limitParam = url.searchParams.get("limit");
  const limit = limitParam ? Number(limitParam) : 25;

  if (localDate && !/^\d{4}-\d{2}-\d{2}$/.test(localDate)) {
    return NextResponse.json({ error: "Invalid date filter" }, { status: 400 });
  }

  try {
    const [activeSession, sessions] = await Promise.all([
      getActiveFocusSessionForUser(authResult.userContext.profile.id),
      listFocusSessionsForUser(authResult.userContext.profile.id, {
        localDate,
        limit: Number.isFinite(limit) ? limit : 25,
      }),
    ]);

    return NextResponse.json({ activeSession, sessions });
  } catch {
    return NextResponse.json(
      { error: "Unable to load focus sessions" },
      { status: 500 }
    );
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

  const parsed = startFocusSessionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid focus session payload",
        issues: parsed.error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
      },
      { status: 400 }
    );
  }

  try {
    const result = await startFocusSessionForUser(
      authResult.userContext.profile.id,
      authResult.userContext.preferences.timezone,
      parsed.data
    );

    if (result.conflict) {
      return NextResponse.json(
        {
          error: "An active focus session is already in progress",
          activeSession: result.session,
        },
        { status: 409 }
      );
    }

    return NextResponse.json({ session: result.session }, { status: 201 });
  } catch (err) {
    const message =
      err instanceof Error && err.message.includes("Referenced task")
        ? "Selected task not found"
        : "Unable to start focus session";
    return NextResponse.json(
      { error: message },
      { status: message === "Selected task not found" ? 404 : 500 }
    );
  }
}
