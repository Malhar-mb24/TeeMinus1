import { requireAuthenticatedApiSession } from "@/lib/api-auth";
import { getWellbeingSummaryForUser } from "@ember/database";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authResult = await requireAuthenticatedApiSession();
  if (!authResult.ok) return authResult.response;

  const url = new URL(request.url);
  const rawDays = Number(url.searchParams.get("days") ?? "7");
  const rangeDays = Number.isFinite(rawDays) && rawDays >= 1 && rawDays <= 30 ? Math.floor(rawDays) : 7;

  const summary = await getWellbeingSummaryForUser(
    authResult.userContext.profile.id,
    authResult.userContext.preferences.timezone,
    rangeDays
  );

  return NextResponse.json(summary);
}
