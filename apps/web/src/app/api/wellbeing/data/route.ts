import { requireAuthenticatedApiSession } from "@/lib/api-auth";
import { deleteWellbeingDataForUser } from "@ember/database";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function DELETE() {
  const authResult = await requireAuthenticatedApiSession();
  if (!authResult.ok) return authResult.response;

  const result = await deleteWellbeingDataForUser(authResult.userContext.profile.id);
  return NextResponse.json(result);
}
