import { SignIn } from "@clerk/nextjs";
import { getEnvReadiness } from "@ember/shared";
import { ArrowLeft, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { EmberLogo } from "@/components/ember-logo";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default function SignInPage() {
  const readiness = getEnvReadiness(process.env);

  return (
    <div className="min-h-dvh bg-canvas text-text-primary flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-md space-y-6">
        <div className="flex items-center justify-between">
          <Link href="/" className="rounded-xl">
            <EmberLogo />
          </Link>
          <Button asChild variant="ghost" size="sm">
            <Link href="/">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Link>
          </Button>
        </div>

        {readiness.clerkConfigured ? (
          <div className="flex justify-center">
            <SignIn
              path="/sign-in"
              routing="path"
              signUpUrl="/sign-up"
              fallbackRedirectUrl="/dashboard"
            />
          </div>
        ) : (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2 text-flame-soft">
                <AlertTriangle className="h-5 w-5" />
                <CardTitle>Authentication Not Configured</CardTitle>
              </div>
              <CardDescription>
                Protected routes are locked safely. Configure Clerk environment keys in{" "}
                <code className="rounded bg-surface-elevated px-1.5 py-0.5 text-xs text-text-primary">
                  .env.local
                </code>{" "}
                to enable live sign-in.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-xl border border-border-subtle bg-surface-elevated p-3 text-xs font-mono text-text-secondary space-y-1">
                <p>NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...</p>
                <p>CLERK_SECRET_KEY=sk_...</p>
              </div>
              <Button asChild variant="secondary" className="w-full">
                <Link href="/">Return to home</Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
