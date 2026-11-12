import { requireAuthenticatedApiSession } from "@/lib/api-auth";
import { WellbeingServiceError, upsertUsageCategoryForUser } from "@ember/database";
import { upsertCategorySchema } from "@ember/shared";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function PUT(request: Request) {
  const authResult = await requireAuthenticatedApiSession();
  if (!authResult.ok) return authResult.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const parsed = upsertCategorySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid category classification payload",
        issues: parsed.error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
      },
      { status: 400 }
    );
  }

  try {
    const rule = await upsertUsageCategoryForUser(authResult.userContext.profile.id, parsed.data);
    return NextResponse.json({ rule });
  } catch (error) {
    if (error instanceof WellbeingServiceError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    return NextResponse.json(
      { error: "Unable to update category classification" },
      { status: 500 }
    );
  }
}
