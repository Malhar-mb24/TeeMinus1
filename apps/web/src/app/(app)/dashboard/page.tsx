import { formatMinutesLabel } from "@ember/shared";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Database,
  Flame,
  Grid2x2Check,
  Settings,
  ShieldCheck,
  Timer,
} from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireAuthenticatedPage } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await requireAuthenticatedPage();
  const prefs = session.userContext?.preferences;
  const profile = session.userContext?.profile;
  const extensionCount = session.userContext?.extensionDeviceCount ?? 0;

  return (
    <div className="space-y-6">
      {/* Header Row */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-text-primary">
              {session.displayName ? `Welcome, ${session.displayName}` : "Dashboard"}
            </h1>
            <Badge variant="flame">Foundation</Badge>
          </div>
          <p className="text-sm text-text-secondary">
            Your workspace identity and persisted defaults are ready for upcoming modules.
          </p>
        </div>

        <Button asChild variant="secondary" size="sm" className="w-full sm:w-auto">
          <Link href="/settings">
            <Settings className="h-4 w-4" />
            Configure Preferences
          </Link>
        </Button>
      </div>

      {/* Database Error / Setup Notice if Clerk works while DB is degraded */}
      {!session.databaseReady && (
        <Card className="border-rose/30 bg-rose/10">
          <CardContent className="flex items-start gap-3 p-4 sm:p-5">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-text-primary">
                Database persistence unavailable
              </p>
              <p className="text-xs text-text-secondary">
                {session.databaseError ?? "Check DATABASE_URL and run Drizzle migrations."}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Primary Foundation Bento Grid */}
      <div className="grid gap-4 lg:grid-cols-12">
        {/* Account & Persistence Status */}
        <Card className="lg:col-span-7">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Database className="h-4 w-4 text-emerald" />
                Account &amp; Database Mapping
              </CardTitle>
              <Badge variant={session.databaseReady ? "emerald" : "rose"}>
                {session.databaseReady ? "Synced" : "Offline"}
              </Badge>
            </div>
            <CardDescription>
              Server-verified Clerk identity mapped to your PostgreSQL profile record.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-border-subtle bg-surface-elevated p-3.5">
              <p className="text-[11px] font-medium uppercase tracking-wider text-text-muted">
                Clerk Auth Status
              </p>
              <p className="mt-1 flex items-center gap-1.5 text-sm font-medium text-text-primary">
                <CheckCircle2 className="h-4 w-4 text-emerald" />
                Verified Session
              </p>
            </div>

            <div className="rounded-xl border border-border-subtle bg-surface-elevated p-3.5">
              <p className="text-[11px] font-medium uppercase tracking-wider text-text-muted">
                Timezone
              </p>
              <p className="mt-1 text-sm font-medium text-text-primary tabular-nums">
                {prefs?.timezone ?? "UTC"}
              </p>
            </div>

            <div className="rounded-xl border border-border-subtle bg-surface-elevated p-3.5">
              <p className="text-[11px] font-medium uppercase tracking-wider text-text-muted">
                Profile Record
              </p>
              <p className="mt-1 truncate font-mono text-xs text-text-secondary">
                {profile?.id ?? "Pending DB connection"}
              </p>
            </div>

            <div className="rounded-xl border border-border-subtle bg-surface-elevated p-3.5">
              <p className="text-[11px] font-medium uppercase tracking-wider text-text-muted">
                Extension Sync Consent
              </p>
              <p className="mt-1 text-sm font-medium text-text-primary">
                {prefs?.extensionTrackingConsent ? "Opted in" : "Disabled (default)"}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Persisted Focus Targets (Real Saved Preferences, Zero Fake Activity) */}
        <Card className="lg:col-span-5">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-flame-soft" />
                Configured Focus Defaults
              </CardTitle>
              <Badge variant="neutral">Saved</Badge>
            </div>
            <CardDescription>
              Persisted preferences ready for the Batch 02 focus timer.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between rounded-xl border border-border-subtle bg-surface-elevated px-3.5 py-2.5">
              <span className="text-xs text-text-secondary">Pomodoro block</span>
              <span className="text-sm font-semibold text-text-primary tabular-nums">
                {prefs?.pomodoroMinutes ?? 25} min
              </span>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-border-subtle bg-surface-elevated px-3.5 py-2.5">
              <span className="text-xs text-text-secondary">Short / Long break</span>
              <span className="text-sm font-semibold text-text-primary tabular-nums">
                {prefs?.shortBreakMinutes ?? 5}m / {prefs?.longBreakMinutes ?? 15}m
              </span>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-border-subtle bg-surface-elevated px-3.5 py-2.5">
              <span className="text-xs text-text-secondary">Daily focus target</span>
              <span className="text-sm font-semibold text-flame-soft tabular-nums">
                {formatMinutesLabel(prefs?.dailyFocusGoalMinutes ?? 120)}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Honest Empty-State Placeholders for Upcoming Feature Batches */}
      <section aria-labelledby="upcoming-modules" className="space-y-3">
        <h2
          id="upcoming-modules"
          className="text-xs font-medium uppercase tracking-widest text-text-muted"
        >
          Module Foundation Status
        </h2>
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="bg-surface/60">
            <CardHeader>
              <div className="flex items-center justify-between">
                <Timer className="h-4 w-4 text-flame-soft" />
                <Badge variant="neutral">Batch 02</Badge>
              </div>
              <CardTitle className="pt-1 text-sm">Focus Sessions</CardTitle>
              <CardDescription className="text-xs">
                No focus sessions recorded yet. The circular timer and task planner
                arrive in Batch 02.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="bg-surface/60">
            <CardHeader>
              <div className="flex items-center justify-between">
                <Grid2x2Check className="h-4 w-4 text-emerald" />
                <Badge variant="neutral">Batch 03</Badge>
              </div>
              <CardTitle className="pt-1 text-sm">Habits &amp; Companion</CardTitle>
              <CardDescription className="text-xs">
                Habit heatmaps, server-validated XP, and your 2D flame companion arrive in
                Batch 03.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="bg-surface/60">
            <CardHeader>
              <div className="flex items-center justify-between">
                <ShieldCheck className="h-4 w-4 text-sky" />
                <Badge variant="neutral">Batch 04</Badge>
              </div>
              <CardTitle className="pt-1 text-sm">Digital Wellbeing</CardTitle>
              <CardDescription className="text-xs">
                {extensionCount} active extension devices paired. Browser tracking and
                wellbeing reports arrive in Batch 04.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </section>

      <div className="flex items-center gap-2 text-xs text-text-muted">
        <Flame className="h-3.5 w-3.5 text-flame" />
        <span>
          Ember Foundation · No fabricated session counts, streaks, or screen-time metrics are shown.
        </span>
      </div>
    </div>
  );
}
