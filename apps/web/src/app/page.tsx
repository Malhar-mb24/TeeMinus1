import { auth } from "@clerk/nextjs/server";
import { getEnvReadiness } from "@ember/shared";
import {
  ArrowRight,
  CalendarRange,
  CheckCircle2,
  Flame,
  Grid2x2Check,
  ShieldCheck,
  Sparkles,
  Timer,
} from "lucide-react";
import Link from "next/link";
import { EmberLogo } from "@/components/ember-logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function LandingPage() {
  const readiness = getEnvReadiness(process.env);
  let isSignedIn = false;

  if (readiness.clerkConfigured) {
    try {
      const { userId } = await auth();
      isSignedIn = Boolean(userId);
    } catch {
      isSignedIn = false;
    }
  }

  return (
    <div className="relative min-h-dvh bg-canvas text-text-primary overflow-x-hidden">
      {/* Restrained ambient glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[440px] bg-[radial-gradient(ellipse_60%_50%_at_50%_-10%,rgba(249,115,22,0.16),transparent)]"
      />

      {/* Header */}
      <header className="relative z-10 border-b border-border-subtle/80 bg-canvas/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="rounded-xl">
            <EmberLogo />
          </Link>

          <nav aria-label="Landing actions" className="flex items-center gap-2 sm:gap-3">
            {isSignedIn ? (
              <Button asChild variant="ember" size="sm">
                <Link href="/dashboard">
                  Open Dashboard
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            ) : (
              <>
                <Button asChild variant="ghost" size="sm">
                  <Link href="/sign-in">Sign in</Link>
                </Button>
                <Button asChild variant="ember" size="sm">
                  <Link href="/sign-up">
                    Get started
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </>
            )}
          </nav>
        </div>
      </header>

      {/* Hero */}
      <main className="relative z-10 mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16 lg:py-20">
        <div className="mx-auto max-w-3xl text-center space-y-6">
          <Badge variant="flame" className="mx-auto">
            <Flame className="h-3.5 w-3.5" />
            Foundation Release · Privacy-First Focus Platform
          </Badge>

          <h1 className="text-3xl font-semibold tracking-[-0.03em] text-text-primary sm:text-5xl lg:text-6xl leading-[1.08]">
            Build consistent study habits without noise or gimmicks.
          </h1>

          <p className="mx-auto max-w-2xl text-base text-text-secondary sm:text-lg leading-relaxed">
            Ember brings together reliable timestamped focus timers, timezone-aware
            habit grids, planned-versus-actual task blocks, and privacy-first website
            wellbeing in one calm dark workspace.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            {isSignedIn ? (
              <Button asChild variant="ember" size="lg" className="w-full sm:w-auto">
                <Link href="/dashboard">
                  Go to Dashboard
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            ) : (
              <>
                <Button asChild variant="ember" size="lg" className="w-full sm:w-auto">
                  <Link href="/sign-up">
                    Create your workspace
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button
                  asChild
                  variant="secondary"
                  size="lg"
                  className="w-full sm:w-auto"
                >
                  <Link href="/dashboard" prefetch={false}>
                    Preview Protected Shell
                  </Link>
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Core Architecture Preview Cards (Explicitly labeled as Roadmap Previews, not personal metrics) */}
        <section
          aria-labelledby="modules-heading"
          className="mt-14 sm:mt-20 space-y-6"
        >
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
            <div>
              <p className="text-xs font-medium uppercase tracking-widest text-flame-soft">
                Platform Architecture
              </p>
              <h2
                id="modules-heading"
                className="text-xl font-semibold tracking-tight text-text-primary sm:text-2xl"
              >
                Designed for deep work on desktop and mobile
              </h2>
            </div>
            <span className="text-xs text-text-muted">
              No paid AI dependencies · Hostname-only local privacy
            </span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="bg-surface/90">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-flame/25 bg-flame/10 text-flame-soft">
                    <Timer className="h-4 w-4" />
                  </span>
                  <Badge variant="emerald">Active</Badge>
                </div>
                <CardTitle className="pt-2">Focus Engine</CardTitle>
                <CardDescription>
                  Timestamp-anchored Pomodoro, custom blocks, and stopwatch sessions with
                  refresh recovery and idempotent completion.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="bg-surface/90">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-sky/25 bg-sky/10 text-sky">
                    <CalendarRange className="h-4 w-4" />
                  </span>
                  <Badge variant="emerald">Active</Badge>
                </div>
                <CardTitle className="pt-2">Plan vs. Record</CardTitle>
                <CardDescription>
                  Categorized tasks paired with an hourly plan-versus-recorded timeline so
                  estimates meet reality cleanly.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="bg-surface/90">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-emerald/25 bg-emerald/10 text-emerald">
                    <Grid2x2Check className="h-4 w-4" />
                  </span>
                  <Badge variant="emerald">Active</Badge>
                </div>
                <CardTitle className="pt-2">Habit Grids &amp; Flame</CardTitle>
                <CardDescription>
                  Contribution heatmaps, multi-day check-in matrices, server-side XP, and a
                  non-punitive 2D flame companion.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="bg-surface/90">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-border-strong bg-surface-elevated text-text-primary">
                    <ShieldCheck className="h-4 w-4" />
                  </span>
                  <Badge variant="neutral">Batch 04</Badge>
                </div>
                <CardTitle className="pt-2">Digital Wellbeing</CardTitle>
                <CardDescription>
                  Chrome MV3 extension aggregating active, non-idle hostnames locally—zero
                  incognito tracking, opt-in sync only.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </section>

        {/* Foundation Readiness Card */}
        <section className="mt-10">
          <Card className="border-border-subtle bg-surface/70">
            <CardContent className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 sm:p-6">
              <div className="flex items-start gap-3">
                <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-flame-soft" />
                <div>
                  <p className="text-sm font-medium text-text-primary">
                    Batch 01 Core Product Active
                  </p>
                  <p className="text-xs text-text-secondary">
                    Timestamped focus timer, habit heatmaps, Plan vs. Record tasks,
                    2D flame companion, server XP, and analytics are live.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-text-secondary">
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-border-subtle bg-surface-elevated px-2.5 py-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald" />
                  Dark-First Tokens
                </span>
                <a
                  href="/api/health"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border-subtle bg-surface-elevated px-2.5 py-1.5 hover:border-border-strong hover:text-text-primary transition-colors"
                >
                  System Health
                </a>
              </div>
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
}
