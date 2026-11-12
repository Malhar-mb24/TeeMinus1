import { requireAuthenticatedApiSession } from "@/lib/api-auth";
import { getAnalyticsSummaryForUser } from "@ember/database";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const authResult = await requireAuthenticatedApiSession();
  if (!authResult.ok) return authResult.response;

  try {
    const analytics = await getAnalyticsSummaryForUser(
      authResult.userContext.profile.id,
      authResult.userContext.preferences.timezone
    );
    return NextResponse.json({ analytics });
  } catch {
    return NextResponse.json(
      { error: "Unable to load analytics" },
      { status: 500 }
    );
  }
}
