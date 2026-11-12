import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { getEnvReadiness } from "@ember/shared";
import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";

const isProtectedPageRoute = createRouteMatcher(["/dashboard(.*)", "/settings(.*)"]);
const isProtectedApiRoute = createRouteMatcher(["/api/me(.*)", "/api/preferences(.*)"]);

const clerkHandler = clerkMiddleware(async (auth, req) => {
  if (isProtectedPageRoute(req) || isProtectedApiRoute(req)) {
    await auth.protect();
  }
});

export default function middleware(req: NextRequest, event: NextFetchEvent) {
  const readiness = getEnvReadiness(process.env);

  // Fail closed on protected routes even when Clerk keys are not configured yet.
  if (!readiness.clerkConfigured) {
    if (isProtectedApiRoute(req)) {
      return NextResponse.json(
        { error: "Authentication service is not configured" },
        { status: 401 }
      );
    }
    if (isProtectedPageRoute(req)) {
      const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
      const protocol =
        req.headers.get("x-forwarded-proto") ?? req.nextUrl.protocol.replace(":", "");
      const origin = host ? `${protocol}://${host}` : req.nextUrl.origin;
      const signInUrl = new URL("/sign-in", origin);
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
