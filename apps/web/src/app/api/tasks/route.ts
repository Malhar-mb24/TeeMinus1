import { requireAuthenticatedApiSession } from "@/lib/api-auth";
import { createTaskForUser, listTasksForUser } from "@ember/database";
import { createTaskSchema, TASK_STATUSES, type TaskStatus } from "@ember/shared";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authResult = await requireAuthenticatedApiSession();
  if (!authResult.ok) return authResult.response;

  const url = new URL(request.url);
  const scheduledDate = url.searchParams.get("date") ?? undefined;
  const rawStatus = url.searchParams.get("status");
  const status =
    rawStatus && (TASK_STATUSES as readonly string[]).includes(rawStatus)
      ? (rawStatus as TaskStatus)
      : undefined;

  if (scheduledDate && !/^\d{4}-\d{2}-\d{2}$/.test(scheduledDate)) {
    return NextResponse.json({ error: "Invalid date filter" }, { status: 400 });
  }

  try {
    const tasks = await listTasksForUser(authResult.userContext.profile.id, {
      scheduledDate,
      status,
    });
    return NextResponse.json({ tasks });
  } catch {
    return NextResponse.json({ error: "Unable to load tasks" }, { status: 500 });
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

  const parsed = createTaskSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid task payload",
        issues: parsed.error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
      },
      { status: 400 }
    );
  }

  try {
    const task = await createTaskForUser(
      authResult.userContext.profile.id,
      parsed.data
    );
    return NextResponse.json({ task }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Unable to create task" }, { status: 500 });
  }
}
