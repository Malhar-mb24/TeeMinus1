import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { getEnvReadiness } from "@ember/shared";
import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";

const isProtectedPageRoute = createRouteMatcher([
  "/dashboard(.*)",
  "/onboarding(.*)",
  "/focus(.*)",
  "/tasks(.*)",
  "/habits(.*)",
  "/insights(.*)",
  "/settings(.*)",
]);

const isProtectedApiRoute = createRouteMatcher([
  "/api/me(.*)",
  "/api/preferences(.*)",
  "/api/onboarding(.*)",
  "/api/tasks(.*)",
  "/api/goals(.*)",
  "/api/focus-sessions(.*)",
  "/api/habits(.*)",
  "/api/analytics(.*)",
  "/api/gamification(.*)",
  "/api/export(.*)",
]);

function buildOriginUrl(req: NextRequest, pathname: string): URL {
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  const protocol =
    req.headers.get("x-forwarded-proto") ?? req.nextUrl.protocol.replace(":", "");
  const origin = host ? `${protocol}://${host}` : req.nextUrl.origin;
  return new URL(pathname, origin);
}

const clerkHandler = clerkMiddleware(async (auth, req) => {
  if (isProtectedApiRoute(req)) {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }
    return NextResponse.next();
  }

  if (isProtectedPageRoute(req)) {
    const { userId } = await auth();
    if (!userId) {
      const signInUrl = buildOriginUrl(req, "/sign-in");
      signInUrl.searchParams.set("redirect_url", req.nextUrl.pathname);
      return NextResponse.redirect(signInUrl);
    }
  }
});

export default function middleware(req: NextRequest, event: NextFetchEvent) {
  const readiness = getEnvReadiness(process.env);

  if (!readiness.clerkConfigured) {
    if (isProtectedApiRoute(req)) {
      return NextResponse.json(
        { error: "Authentication service is not configured" },
        { status: 401 }
      );
    }
    if (isProtectedPageRoute(req)) {
      const signInUrl = buildOriginUrl(req, "/sign-in");
      signInUrl.searchParams.set("reason", "auth_unconfigured");
      return NextResponse.redirect(signInUrl);
    }
    return NextResponse.next();
  }

  return clerkHandler(req, event);
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
