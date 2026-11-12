import { requireAuthenticatedApiSession } from "@/lib/api-auth";
import { exportUserDataForUser } from "@ember/database";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const authResult = await requireAuthenticatedApiSession();
  if (!authResult.ok) return authResult.response;

  try {
    const exported = await exportUserDataForUser(authResult.userContext.profile.id);
    return new NextResponse(JSON.stringify(exported, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": 'attachment; filename="ember-export.json"',
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Unable to export personal data" },
      { status: 500 }
    );
  }
}
