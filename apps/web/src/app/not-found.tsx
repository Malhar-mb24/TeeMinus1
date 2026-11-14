import Link from "next/link";
import { EmberLogo } from "@/components/ember-logo";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Compass } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-dvh bg-canvas text-text-primary flex flex-col items-center justify-center px-4 py-12 text-center">
      <div className="w-full max-w-md space-y-6">
        <div className="flex justify-center">
          <Link href="/">
            <EmberLogo />
          </Link>
        </div>

        <div className="rounded-3xl border border-border-subtle bg-surface p-8 space-y-4 shadow-xl">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-flame/40 bg-flame/15 text-flame shadow-[0_0_20px_rgba(243,107,43,0.3)]">
            <Compass className="h-6 w-6" />
          </span>

          <div className="space-y-1">
            <h1 className="text-3xl font-extrabold tracking-tight text-text-primary">404</h1>
            <h2 className="text-base font-semibold text-text-primary">Sanctuary Room Not Found</h2>
            <p className="text-xs text-text-secondary leading-relaxed pt-1">
              The page or space you are looking for does not exist or has moved.
            </p>
          </div>

          <div className="pt-2">
            <Button asChild variant="ember" className="w-full rounded-full">
              <Link href="/dashboard">
                <ArrowLeft className="h-4 w-4" />
                Return to Dashboard
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
