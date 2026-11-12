import "server-only";

import { auth, currentUser } from "@clerk/nextjs/server";
import { ensureUserProfile, type UserContextDto } from "@ember/database";
import { getEnvReadiness } from "@ember/shared";
import { redirect } from "next/navigation";

export type VerifiedSessionResult =
  | {
      status: "unconfigured";
    }
  | {
      status: "unauthenticated";
    }
  | {
      status: "authenticated";
      clerkUserId: string;
      email: string | null;
      displayName: string | null;
      avatarUrl: string | null;
      databaseReady: boolean;
      userContext: UserContextDto | null;
      databaseError: string | null;
    };

/**
 * Resolves the current authenticated user purely from server-verified Clerk state.
 * Never accepts client-supplied user IDs.
 */
export async function getVerifiedSession(): Promise<VerifiedSessionResult> {
  const readiness = getEnvReadiness(process.env);
  if (!readiness.clerkConfigured) {
    return { status: "unconfigured" };
  }

  const { userId } = await auth();
  if (!userId) {
    return { status: "unauthenticated" };
  }

  const clerkUser = await currentUser();
  const primaryEmail =
    clerkUser?.emailAddresses.find((e) => e.id === clerkUser.primaryEmailAddressId)
      ?.emailAddress ??
    clerkUser?.emailAddresses[0]?.emailAddress ??
    null;
  const fullName = [clerkUser?.firstName, clerkUser?.lastName]
    .filter(Boolean)
    .join(" ")
    .trim();
  const displayName = fullName || clerkUser?.username || primaryEmail || null;
  const avatarUrl = clerkUser?.imageUrl ?? null;

  if (!readiness.databaseConfigured) {
    return {
      status: "authenticated",
      clerkUserId: userId,
      email: primaryEmail,
      displayName,
      avatarUrl,
      databaseReady: false,
      userContext: null,
      databaseError: "DATABASE_URL is not configured",
    };
  }

  try {
    const userContext = await ensureUserProfile({
      clerkUserId: userId,
      email: primaryEmail,
      displayName,
      avatarUrl,
    });

    return {
      status: "authenticated",
      clerkUserId: userId,
      email: primaryEmail,
      displayName,
      avatarUrl,
      databaseReady: true,
      userContext,
      databaseError: null,
    };
  } catch {
    return {
      status: "authenticated",
      clerkUserId: userId,
      email: primaryEmail,
      displayName,
      avatarUrl,
      databaseReady: false,
      userContext: null,
      databaseError: "Unable to connect to database",
    };
  }
}

export async function requireAuthenticatedPage() {
  const session = await getVerifiedSession();
  if (session.status === "unconfigured") {
    redirect("/sign-in?reason=auth_unconfigured");
  }
  if (session.status === "unauthenticated") {
    redirect("/sign-in");
  }
  return session;
}
