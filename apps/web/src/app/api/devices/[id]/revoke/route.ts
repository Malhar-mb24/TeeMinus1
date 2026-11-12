import { isValidUuid, requireAuthenticatedApiSession } from "@/lib/api-auth";
import { revokeDeviceForUser } from "@ember/database";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuthenticatedApiSession();
  if (!authResult.ok) return authResult.response;

  const { id } = await context.params;
  if (!isValidUuid(id)) {
    return NextResponse.json({ error: "Invalid device identifier" }, { status: 400 });
  }

  const revoked = await revokeDeviceForUser(authResult.userContext.profile.id, id);
  if (!revoked) {
    return NextResponse.json({ error: "Device not found" }, { status: 404 });
  }

  return NextResponse.json({ device: revoked });
}
