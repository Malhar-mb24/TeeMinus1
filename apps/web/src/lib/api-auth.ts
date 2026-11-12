import "server-only";

import type { UserContextDto } from "@ember/database";
import { NextResponse } from "next/server";
import { getVerifiedSession } from "./auth";

export type ApiSessionResult =
  | {
      ok: true;
      userContext: UserContextDto;
    }
  | {
      ok: false;
      response: NextResponse;
    };

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidUuid(value: string): boolean {
  return UUID_REGEX.test(value);
}

export async function requireAuthenticatedApiSession(): Promise<ApiSessionResult> {
  const session = await getVerifiedSession();

  if (session.status !== "authenticated") {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      ),
    };
  }

  if (!session.databaseReady || !session.userContext) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Database is not ready" },
        { status: 503 }
      ),
    };
  }

  return {
    ok: true,
    userContext: session.userContext,
  };
}
