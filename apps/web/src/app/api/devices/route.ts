import { requireAuthenticatedApiSession } from "@/lib/api-auth";
import { listDevicesForUser } from "@ember/database";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const authResult = await requireAuthenticatedApiSession();
  if (!authResult.ok) return authResult.response;

  const devices = await listDevicesForUser(authResult.userContext.profile.id);
  return NextResponse.json({
    devices,
    syncConsentEnabled: authResult.userContext.preferences.extensionTrackingConsent,
  });
}
