import { getVerifiedSession } from "@/lib/auth";
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
      {
        error: "Profile persistence unavailable",
        clerkUserId: session.clerkUserId,
        databaseReady: false,
      },
      { status: 503 }
    );
  }

  return NextResponse.json({
    profile: session.userContext.profile,
    preferences: session.userContext.preferences,
    extensionDeviceCount: session.userContext.extensionDeviceCount,
  });
}
