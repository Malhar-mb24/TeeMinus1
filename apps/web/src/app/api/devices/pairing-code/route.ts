import { requireAuthenticatedApiSession } from "@/lib/api-auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { createPairingCodeForUser } from "@ember/database";
import { createPairingCodeSchema } from "@ember/shared";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const authResult = await requireAuthenticatedApiSession();
  if (!authResult.ok) return authResult.response;

  const rate = checkRateLimit(
    `pairing-code:${authResult.userContext.profile.id}`,
    20,
    10 * 60 * 1000
  );
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many pairing code requests. Please wait before trying again." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } }
    );
  }

  let body: unknown = {};
  try {
    const rawText = await request.text();
    body = rawText ? JSON.parse(rawText) : {};
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const parsed = createPairingCodeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid pairing code request",
        issues: parsed.error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
      },
      { status: 400 }
    );
  }

  const pairing = await createPairingCodeForUser(authResult.userContext.profile.id, parsed.data);
  return NextResponse.json(pairing, { status: 201 });
}
