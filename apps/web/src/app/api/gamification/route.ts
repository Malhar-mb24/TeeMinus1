import { requireAuthenticatedApiSession } from "@/lib/api-auth";
import { getGamificationSummaryForUser } from "@ember/database";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const authResult = await requireAuthenticatedApiSession();
  if (!authResult.ok) return authResult.response;

  try {
    const summary = await getGamificationSummaryForUser(
      authResult.userContext.profile.id
    );
    return NextResponse.json({ gamification: summary });
  } catch {
    return NextResponse.json(
      { error: "Unable to load gamification summary" },
      { status: 500 }
    );
  }
}
