"use client";

import {
  COSMETIC_UNLOCK_RULES,
  formatDurationCompact,
  formatMinutesLabel,
  getDayOfWeekFromDateKey,
  type AnalyticsSummaryDto,
  type CompanionStyle,
  type FocusIntelligenceSummaryDto,
  type GamificationSummaryDto,
  type WellbeingSummaryDto,
} from "@ember/shared";
import {
  AlertTriangle,
  ArrowRight,
  Award,
  CheckCircle2,
  Flame,
  Globe,
  Info,
  Lock,
  Monitor,
  ShieldCheck,
  Sparkles,
  Target,
  Timer,
  Trophy,
} from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { cn } from "@/lib/utils";
import { FlameCompanion } from "./flame-companion";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { WellbeingTrendChart } from "./wellbeing-trend-chart";
import { WeeklyFocusChart } from "./weekly-focus-chart";

interface InsightsWorkspaceProps {
  analytics: AnalyticsSummaryDto;
  initialGamification: GamificationSummaryDto;
  initialCompanionStyle: CompanionStyle;
  wellbeing?: WellbeingSummaryDto;
  intelligence?: FocusIntelligenceSummaryDto;
}

type InsightsViewTab = "daily" | "weekly" | "monthly";

const HEATMAP_DAY_HEADERS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

function getIntensityColor(minutes: number): string {
  if (minutes <= 0) return "#1E1A16";
  if (minutes < 30) return "#7C2D12";
  if (minutes < 60) return "#C2410C";
  if (minutes < 120) return "#F97316";
  return "#FDBA74";
}

function formatIsoClock(iso: string, timezone: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso.slice(11, 16);
  }
}

export function InsightsWorkspace({
  analytics,
  initialGamification,
  initialCompanionStyle,
  wellbeing,
  intelligence,
}: InsightsWorkspaceProps) {
  const [activeTab, setActiveTab] = React.useState<InsightsViewTab>("daily");
  const [selectedStyle, setSelectedStyle] =
    React.useState<CompanionStyle>(initialCompanionStyle);
  const [styleFeedback, setStyleFeedback] = React.useState<string | null>(null);

  async function handleSelectCosmetic(style: CompanionStyle) {
    setStyleFeedback(null);
    const res = await fetch("/api/preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companionStyle: style }),
    });
    if (res.ok) {
      setSelectedStyle(style);
      setStyleFeedback(`Equipped ${style} companion style.`);
    }
  }

  const firstDayDow =
    analytics.monthly.heatmap.length > 0
      ? getDayOfWeekFromDateKey(analytics.monthly.heatmap[0]!.localDate)
      : 0;
  const paddedCells: Array<{ localDate: string; focusMinutes: number } | null> = [
    ...Array.from({ length: firstDayDow }, () => null),
    ...analytics.monthly.heatmap,
  ];

  const companionMood =
    analytics.daily.focusMinutes >= analytics.daily.dailyGoalMinutes
      ? "celebration"
      : analytics.daily.focusMinutes > 0
        ? "happy"
        : "idle";

  const coverage = intelligence?.coverage;
  const accounting = intelligence?.accounting;
  const todaySessions =
    intelligence?.sessionsTimeline.filter((s) => s.localDate === analytics.todayDate) ?? [];

  const nonFocusDistractingSeconds = wellbeing?.categoryBreakdown.distractingSeconds ?? 0;

  return (
    <div className="space-y-6">
      {/* Header + View Switcher */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-[-0.025em] text-text-primary">
            Insights &amp; Progression
          </h1>
          <p className="text-sm text-text-secondary">
            Daily, weekly, and monthly focus analytics unified with tracking intelligence (
            {analytics.timezone}).
          </p>
        </div>

        <div
          role="tablist"
          aria-label="Insights period view"
          className="inline-flex rounded-xl border border-border-subtle bg-surface-elevated p-1 self-start"
        >
          {(
            [
              { id: "daily", label: "Daily" },
              { id: "weekly", label: "Weekly" },
              { id: "monthly", label: "Monthly" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              role="tab"
              type="button"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "rounded-lg px-3.5 py-1.5 text-xs font-medium transition-colors cursor-pointer",
                activeTab === tab.id
                  ? "bg-flame text-charcoal"
                  : "text-text-secondary hover:text-text-primary"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Top KPI Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4 sm:p-5">
            <p className="text-xs text-text-muted">Today&rsquo;s Focus</p>
            <p className="mt-1 text-2xl font-bold tabular-nums">
              {formatMinutesLabel(analytics.daily.focusMinutes)}
            </p>
            <p className="mt-1 text-xs text-text-secondary tabular-nums">
              {analytics.daily.sessionsCompleted} completed · Goal{" "}
              {formatMinutesLabel(analytics.daily.dailyGoalMinutes)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 sm:p-5">
            <p className="text-xs text-text-muted">Weekly Total</p>
            <p className="mt-1 text-2xl font-bold tabular-nums">
              {formatMinutesLabel(analytics.weekly.totalFocusMinutes)}
            </p>
            <p className="mt-1 text-xs text-text-secondary tabular-nums">
              {analytics.weekly.consistencyDays}/7 active days
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 sm:p-5">
            <p className="text-xs text-text-muted">84-Day Total</p>
            <p className="mt-1 text-2xl font-bold tabular-nums">
              {formatMinutesLabel(analytics.monthly.totalFocusMinutes)}
            </p>
            <p className="mt-1 text-xs text-text-secondary tabular-nums">
              {analytics.monthly.activeDays} days with focus
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 sm:p-5">
            <p className="text-xs text-text-muted">Focus Streak</p>
            <p className="mt-1 text-2xl font-bold text-flame-soft tabular-nums">
              {initialGamification.currentFocusStreakDays}d
            </p>
            <p className="mt-1 text-xs text-text-secondary tabular-nums">
              Best: {initialGamification.bestFocusStreakDays}d
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tracking Coverage & Time Accounting Banner */}
      {coverage && accounting && (
        <Card className="border-border-subtle bg-surface-elevated/50">
          <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between pb-3">
            <div className="flex items-start gap-2.5">
              <ShieldCheck
                className={cn(
                  "h-5 w-5 shrink-0 mt-0.5",
                  coverage.status === "connected"
                    ? "text-emerald"
                    : coverage.status === "partial"
                      ? "text-amber"
                      : "text-text-muted"
                )}
              />
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle className="text-sm">Tracking Coverage &amp; Time Accounting</CardTitle>
                  <Badge
                    variant={
                      coverage.status === "connected"
                        ? "emerald"
                        : coverage.status === "partial"
                          ? "flame"
                          : "neutral"
                    }
                  >
                    {coverage.status === "connected"
                      ? "Web + Desktop Synced"
                      : coverage.status === "partial"
                        ? "Partial Coverage"
                        : "Focus Only (No Trackers)"}
                  </Badge>
                </div>
                <CardDescription className="mt-0.5 text-xs">
                  {coverage.explanation}
                </CardDescription>
              </div>
            </div>
            <Button asChild variant="outline" size="sm" className="shrink-0">
              <Link href="/wellbeing">
                Configure Trackers
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-4 pt-0">
            <div className="rounded-xl border border-border-subtle bg-surface p-3">
              <p className="text-[11px] text-text-muted">Focus Timer ({accounting.rangeDays}d)</p>
              <p className="mt-1 text-base font-semibold tabular-nums">
                {formatDurationCompact(accounting.focusSeconds)}
              </p>
              <p className="text-[11px] text-text-muted">
                {accounting.completedFocusSessions} completed ·{" "}
                {accounting.interruptedFocusSessions} interrupted
              </p>
            </div>
            <div className="rounded-xl border border-border-subtle bg-surface p-3">
              <p className="text-[11px] text-text-muted">Tracked Websites</p>
              <p className="mt-1 text-base font-semibold tabular-nums">
                {accounting.trackedWebsiteSeconds !== null
                  ? formatDurationCompact(accounting.trackedWebsiteSeconds)
                  : "Unknown (Not paired)"}
              </p>
              <p className="text-[11px] text-text-muted">
                {coverage.hasActiveExtension ? "Chrome MV3 synced" : "Extension optional"}
              </p>
            </div>
            <div className="rounded-xl border border-border-subtle bg-surface p-3">
              <p className="text-[11px] text-text-muted">Tracked Windows Apps</p>
              <p className="mt-1 text-base font-semibold tabular-nums">
                {accounting.trackedDesktopSeconds !== null
                  ? formatDurationCompact(accounting.trackedDesktopSeconds)
                  : "Unknown (Not paired)"}
              </p>
              <p className="text-[11px] text-text-muted">
                {coverage.hasActiveDesktopTracker
                  ? "Desktop CLI synced"
                  : "Desktop tracker optional"}
              </p>
            </div>
            <div className="rounded-xl border border-border-subtle bg-surface p-3">
              <p className="text-[11px] text-text-muted">Observed Session Pauses</p>
              <p className="mt-1 text-base font-semibold tabular-nums">
                {formatDurationCompact(accounting.sessionPauseSeconds)}
              </p>
              <p className="text-[11px] text-text-muted">
                Idle/untracked off-timer gaps stay unknown
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* DAILY VIEW */}
      {activeTab === "daily" && (
        <div className="grid gap-6 lg:grid-cols-12">
          <Card className="lg:col-span-7">
            <CardHeader>
              <CardTitle className="text-base">
                Focus Session Timeline &amp; Same-Day Context ({analytics.todayDate})
              </CardTitle>
              <CardDescription className="text-xs">
                Server-anchored focus blocks alongside same-day tracked website/desktop
                summaries when available.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {todaySessions.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border-subtle bg-surface-elevated/40 p-6 text-center space-y-2.5">
                  <Timer className="mx-auto h-6 w-6 text-flame-soft" />
                  <p className="text-sm font-medium text-text-primary">
                    No focus blocks recorded today yet
                  </p>
                  <p className="text-xs text-text-secondary max-w-md mx-auto">
                    Start a Pomodoro, Custom, or Stopwatch session to build today&rsquo;s
                    timeline and compare focus against tracked activity.
                  </p>
                  <Button asChild variant="primary" size="sm">
                    <Link href="/focus">Go to Focus Timer</Link>
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {todaySessions.map((session) => (
                    <div
                      key={session.id}
                      className="rounded-xl border border-border-subtle bg-surface-elevated/50 p-3.5 space-y-2"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-medium text-sm text-text-primary truncate">
                            {session.title}
                          </span>
                          <Badge
                            variant={
                              session.outcomeFlag === "deep_completion" ||
                              session.outcomeFlag === "completed"
                                ? "emerald"
                                : session.outcomeFlag === "interrupted"
                                  ? "flame"
                                  : "neutral"
                            }
                          >
                            {session.outcomeFlag.replace("_", " ")}
                          </Badge>
                        </div>
                        <span className="text-sm font-semibold tabular-nums text-text-primary">
                          {formatDurationCompact(session.accumulatedSeconds)}
                        </span>
                      </div>

                      <p className="text-xs text-text-muted tabular-nums">
                        {formatIsoClock(session.startedAt, analytics.timezone)}
                        {session.endedAt
                          ? ` – ${formatIsoClock(session.endedAt, analytics.timezone)}`
                          : " · Active"}
                        {session.pauseGapSeconds > 0
                          ? ` · Paused ${formatDurationCompact(session.pauseGapSeconds)}`
                          : ""}
                        {session.xpEarned > 0 ? ` · +${session.xpEarned} XP` : ""}
                      </p>

                      {session.sameDayTrackedWebSeconds !== null ||
                      session.sameDayTrackedDesktopSeconds !== null ? (
                        <div className="flex flex-wrap items-center gap-2 border-t border-border-subtle pt-2 text-[11px] text-text-secondary">
                          {session.sameDayTrackedWebSeconds !== null && (
                            <span className="inline-flex items-center gap-1 rounded-md bg-surface px-2 py-0.5">
                              <Globe className="h-3 w-3 text-sky" />
                              Same-day web: {formatDurationCompact(session.sameDayTrackedWebSeconds)}
                            </span>
                          )}
                          {session.sameDayTrackedDesktopSeconds !== null && (
                            <span className="inline-flex items-center gap-1 rounded-md bg-surface px-2 py-0.5">
                              <Monitor className="h-3 w-3 text-flame-soft" />
                              Same-day apps:{" "}
                              {formatDurationCompact(session.sameDayTrackedDesktopSeconds)}
                            </span>
                          )}
                          {session.sameDayDistractingTargets.length > 0 && (
                            <span className="text-rose">
                              Distracting day targets:{" "}
                              {session.sameDayDistractingTargets.join(", ")}
                            </span>
                          )}
                        </div>
                      ) : (
                        <p className="border-t border-border-subtle pt-2 text-[11px] text-text-muted">
                          No browser or desktop telemetry synced for {session.localDate}.
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="lg:col-span-5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <AlertTriangle className="h-4 w-4 text-amber" />
                Explainable Distraction Signals
              </CardTitle>
              <CardDescription className="text-xs">
                Transparent rule checks across recent focus blocks and same-day synced usage
                (shared day context, not proven causation).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {!intelligence || intelligence.distractionSignals.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border-subtle bg-surface-elevated/40 p-5 text-xs text-text-secondary space-y-1.5">
                  <p className="font-medium text-text-primary">
                    No distraction alerts triggered
                  </p>
                  <p>
                    {coverage?.status === "none"
                      ? "Connect Chrome or Windows tracking in Digital Wellbeing to detect off-task domain or app usage alongside your focus blocks."
                      : "No interrupted sessions or ≥1m distracting host/app activity occurred alongside recent focus days."}
                  </p>
                </div>
              ) : (
                intelligence.distractionSignals.map((sig) => (
                  <div
                    key={sig.id}
                    className="rounded-xl border border-border-subtle bg-surface-elevated/60 p-3 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-text-primary truncate">
                        {sig.displayName}
                      </span>
                      <Badge variant={sig.category === "distracting" ? "rose" : "flame"}>
                        {sig.localDate}
                      </Badge>
                    </div>
                    <p className="text-text-secondary leading-snug">{sig.reason}</p>
                  </div>
                ))
              )}

              {wellbeing && (
                <div className="border-t border-border-subtle pt-3 grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-xl bg-surface-elevated p-2.5">
                    <span className="text-text-muted">Today Websites</span>
                    <p className="mt-0.5 font-semibold tabular-nums">
                      {wellbeing.devices.some(
                        (d) => d.deviceType === "chrome_extension" && d.status === "active"
                      ) || wellbeing.todayWebsiteSeconds > 0
                        ? formatDurationCompact(wellbeing.todayWebsiteSeconds)
                        : "Unknown"}
                    </p>
                  </div>
                  <div className="rounded-xl bg-surface-elevated p-2.5">
                    <span className="text-text-muted">Today Windows Apps</span>
                    <p className="mt-0.5 font-semibold tabular-nums">
                      {wellbeing.devices.some(
                        (d) => d.deviceType === "windows_desktop" && d.status === "active"
                      ) || wellbeing.todayDesktopSeconds > 0
                        ? formatDurationCompact(wellbeing.todayDesktopSeconds)
                        : "Unknown"}
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* WEEKLY VIEW */}
      {activeTab === "weekly" && (
        <div className="grid gap-6 lg:grid-cols-12">
          <Card className="lg:col-span-6">
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-base">
                <span>Weekly Focus Activity</span>
                <Badge variant="sky" className="tabular-nums">
                  {analytics.weekly.sessionsCompleted} sessions
                </Badge>
              </CardTitle>
              <CardDescription>
                Daily completed focus minutes over the last 7 days ({analytics.timezone}).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <WeeklyFocusChart
                buckets={analytics.weekly.buckets}
                todayDate={analytics.todayDate}
              />

              {analytics.weekly.categoryBreakdown.length > 0 ? (
                <div className="border-t border-border-subtle pt-3 space-y-2">
                  <p className="text-xs font-medium uppercase tracking-wider text-text-muted">
                    Focus by Task Category (7d)
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {analytics.weekly.categoryBreakdown.map((item) => (
                      <span
                        key={item.category}
                        className="rounded-lg border border-border-subtle bg-surface-elevated px-2.5 py-1 text-xs tabular-nums"
                      >
                        {item.category}:{" "}
                        <strong className="text-text-primary">
                          {formatMinutesLabel(item.minutes)}
                        </strong>
                      </span>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-text-muted">
                  Complete focus blocks linked to tasks to break down hours by category.
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="lg:col-span-6">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">Focus vs Non-Focus Balance</CardTitle>
                <CardDescription className="text-xs">
                  {wellbeing && wellbeing.rangeTotalSeconds > 0
                    ? `Tracked usage categories across the past ${wellbeing.rangeDays} days`
                    : "Sync a Chrome extension or Windows tracker to populate usage trends."}
                </CardDescription>
              </div>
              <Button asChild variant="ghost" size="sm">
                <Link href="/wellbeing">Wellbeing</Link>
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {wellbeing && wellbeing.rangeTotalSeconds > 0 ? (
                <>
                  <WellbeingTrendChart
                    trend={wellbeing.dailyTrend.slice(-7)}
                    todayDate={wellbeing.todayDate}
                    height={190}
                  />
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="rounded-xl border border-border-subtle bg-surface-elevated p-2.5">
                      <span className="text-emerald font-medium">Productive</span>
                      <p className="mt-1 font-semibold tabular-nums">
                        {formatDurationCompact(wellbeing.categoryBreakdown.productiveSeconds)}
                      </p>
                    </div>
                    <div className="rounded-xl border border-border-subtle bg-surface-elevated p-2.5">
                      <span className="text-sky font-medium">Neutral</span>
                      <p className="mt-1 font-semibold tabular-nums">
                        {formatDurationCompact(wellbeing.categoryBreakdown.neutralSeconds)}
                      </p>
                    </div>
                    <div className="rounded-xl border border-border-subtle bg-surface-elevated p-2.5">
                      <span className="text-rose font-medium">Distracting</span>
                      <p className="mt-1 font-semibold tabular-nums">
                        {formatDurationCompact(nonFocusDistractingSeconds)}
                      </p>
                    </div>
                  </div>
                </>
              ) : (
                <div className="rounded-xl border border-dashed border-border-subtle bg-surface-elevated/40 p-6 text-center space-y-2.5">
                  <Globe className="mx-auto h-6 w-6 text-sky" />
                  <p className="text-sm font-medium text-text-primary">
                    No synced website or app usage yet
                  </p>
                  <p className="text-xs text-text-secondary max-w-sm mx-auto">
                    Ember keeps tracking strictly opt-in. Pair a device in Digital Wellbeing to
                    see focus vs distracting breakdowns here.
                  </p>
                  <Button asChild variant="secondary" size="sm">
                    <Link href="/wellbeing">Pair Device</Link>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* MONTHLY VIEW */}
      {activeTab === "monthly" && (
        <div className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-12">
            {/* Focus Contribution Heatmap */}
            <Card className="lg:col-span-6">
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <CardTitle className="text-base">Focus Contribution Grid</CardTitle>
                    <CardDescription>
                      84-day focus intensity ({formatMinutesLabel(analytics.monthly.totalFocusMinutes)} total)
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] text-text-muted">
                    <span>0</span>
                    {[0, 15, 45, 90, 140].map((sample) => (
                      <span
                        key={sample}
                        className="h-3 w-3 rounded-[3px]"
                        style={{ backgroundColor: getIntensityColor(sample) }}
                      />
                    ))}
                    <span>2h+</span>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-7 gap-1.5 text-center text-[11px] font-medium mb-2">
                  {HEATMAP_DAY_HEADERS.map((d, idx) => (
                    <span
                      key={d}
                      className={cn(
                        idx === 0
                          ? "text-rose"
                          : idx === 6
                            ? "text-sky"
                            : "text-text-muted"
                      )}
                    >
                      {d}
                    </span>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1.5">
                  {paddedCells.map((cell, idx) =>
                    cell === null ? (
                      <div key={`pad-${idx}`} className="aspect-square" />
                    ) : (
                      <div
                        key={cell.localDate}
                        title={`${cell.localDate}: ${cell.focusMinutes}m`}
                        className={cn(
                          "aspect-square rounded-[4px] transition-colors",
                          cell.localDate === analytics.todayDate &&
                            "ring-1 ring-white/80"
                        )}
                        style={{
                          backgroundColor: getIntensityColor(cell.focusMinutes),
                        }}
                      />
                    )
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Top Tracked Websites & Windows Apps */}
            <Card className="lg:col-span-6">
              <CardHeader>
                <CardTitle className="text-base">
                  Top Websites &amp; Windows Apps ({wellbeing?.rangeDays ?? 14}d)
                </CardTitle>
                <CardDescription className="text-xs">
                  Synced domain &amp; application totals where opt-in telemetry exists
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <p className="text-xs font-medium text-sky flex items-center gap-1.5">
                    <Globe className="h-3.5 w-3.5" />
                    Websites
                  </p>
                  {wellbeing && wellbeing.topWebsites.length > 0 ? (
                    wellbeing.topWebsites.slice(0, 5).map((site) => (
                      <div
                        key={site.pattern}
                        className="flex items-center justify-between rounded-lg bg-surface-elevated px-2.5 py-1.5 text-xs"
                      >
                        <span className="truncate pr-2">{site.displayName}</span>
                        <span className="shrink-0 font-mono text-text-secondary">
                          {formatDurationCompact(site.activeSeconds)}
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-text-muted">No synced website entries.</p>
                  )}
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-medium text-flame-soft flex items-center gap-1.5">
                    <Monitor className="h-3.5 w-3.5" />
                    Windows Apps
                  </p>
                  {wellbeing && wellbeing.topDesktopApps.length > 0 ? (
                    wellbeing.topDesktopApps.slice(0, 5).map((app) => (
                      <div
                        key={app.pattern}
                        className="flex items-center justify-between rounded-lg bg-surface-elevated px-2.5 py-1.5 text-xs"
                      >
                        <span className="truncate pr-2">{app.displayName}</span>
                        <span className="shrink-0 font-mono text-text-secondary">
                          {formatDurationCompact(app.activeSeconds)}
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-text-muted">No synced desktop app entries.</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Gamification: Level + Companion Cosmetics + Achievements */}
          <div className="grid gap-6 lg:grid-cols-12">
            <Card className="lg:col-span-5">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Flame className="h-4 w-4 text-flame" />
                    Level &amp; Companion Cosmetics
                  </CardTitle>
                  <Badge variant="flame" className="tabular-nums">
                    Level {initialGamification.level} · {initialGamification.totalXp} XP
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                <FlameCompanion
                  mood={companionMood}
                  styleVariant={selectedStyle}
                  size="lg"
                  level={initialGamification.level}
                  message={`${initialGamification.xpToNextLevel} XP until Level ${initialGamification.level + 1}`}
                />

                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs text-text-secondary tabular-nums">
                    <span>Level Progress</span>
                    <span>{initialGamification.progressPercent}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-surface-elevated overflow-hidden">
                    <div
                      className="h-full rounded-full bg-flame transition-all"
                      style={{ width: `${initialGamification.progressPercent}%` }}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-medium uppercase tracking-wider text-text-muted">
                    Companion Styles
                  </p>
                  <div className="grid gap-2">
                    {COSMETIC_UNLOCK_RULES.map((cosmetic) => {
                      const unlocked = initialGamification.unlockedCosmetics.includes(
                        cosmetic.style
                      );
                      const active = selectedStyle === cosmetic.style;
                      return (
                        <button
                          key={cosmetic.style}
                          type="button"
                          disabled={!unlocked}
                          onClick={() => void handleSelectCosmetic(cosmetic.style)}
                          className={cn(
                            "flex items-center justify-between rounded-xl border px-3.5 py-2.5 text-xs transition-colors",
                            active
                              ? "border-flame bg-flame/15 text-flame-soft"
                              : unlocked
                                ? "border-border-subtle bg-surface-elevated text-text-primary hover:border-border-strong cursor-pointer"
                                : "border-border-subtle bg-surface-elevated/40 text-text-muted cursor-not-allowed"
                          )}
                        >
                          <span className="font-medium">{cosmetic.label}</span>
                          {unlocked ? (
                            <span>{active ? "Equipped" : "Equip"}</span>
                          ) : (
                            <span className="inline-flex items-center gap-1">
                              <Lock className="h-3 w-3" />
                              Level {cosmetic.requiredLevel}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  {styleFeedback && (
                    <p className="text-xs text-emerald" role="status">
                      {styleFeedback}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="lg:col-span-7">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Trophy className="h-4 w-4 text-flame-soft" />
                  Achievements &amp; Reward Ledger
                </CardTitle>
                <CardDescription>
                  All XP and badges are awarded server-side through idempotent events.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid gap-2.5 sm:grid-cols-2">
                  {initialGamification.achievements.map((ach) => (
                    <div
                      key={ach.code}
                      className={cn(
                        "flex items-start gap-3 rounded-xl border p-3 text-xs",
                        ach.unlocked
                          ? "border-emerald/30 bg-emerald/10"
                          : "border-border-subtle bg-surface-elevated/40 opacity-75"
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                          ach.unlocked
                            ? "bg-emerald/20 text-emerald"
                            : "bg-surface-elevated text-text-muted"
                        )}
                      >
                        {ach.unlocked ? (
                          <CheckCircle2 className="h-4 w-4" />
                        ) : ach.category === "focus" ? (
                          <Timer className="h-4 w-4" />
                        ) : ach.category === "goals" ? (
                          <Target className="h-4 w-4" />
                        ) : (
                          <Award className="h-4 w-4" />
                        )}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-text-primary">
                            {ach.title}
                          </span>
                          <span className="text-[10px] text-flame-soft tabular-nums">
                            +{ach.xpReward} XP
                          </span>
                        </div>
                        <p className="mt-0.5 text-text-secondary leading-snug">
                          {ach.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="space-y-2 border-t border-border-subtle pt-4">
                  <p className="text-xs font-medium uppercase tracking-wider text-text-muted">
                    Recent XP Events
                  </p>
                  {initialGamification.recentXpEvents.length === 0 ? (
                    <p className="text-xs text-text-muted">
                      No XP awarded yet. Complete a focus session or habit check-in to earn
                      your first reward.
                    </p>
                  ) : (
                    <div className="divide-y divide-border-subtle text-xs">
                      {initialGamification.recentXpEvents.slice(0, 6).map((evt) => (
                        <div
                          key={evt.id}
                          className="flex items-center justify-between py-2"
                        >
                          <span className="text-text-secondary capitalize">
                            {evt.eventType.replaceAll("_", " ")}
                          </span>
                          <span className="inline-flex items-center gap-1 font-semibold text-flame-soft tabular-nums">
                            <Sparkles className="h-3 w-3" />+{evt.xpDelta} XP
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* How Metrics Are Calculated (Methodology & Transparency) */}
      <details className="rounded-2xl border border-border-subtle bg-surface-elevated/40 p-4 text-xs text-text-secondary">
        <summary className="flex items-center gap-2 font-medium text-text-primary cursor-pointer list-none">
          <Info className="h-4 w-4 text-sky shrink-0" />
          How Ember calculates focus, screen time, idle gaps, and distraction signals
        </summary>
        <ul className="mt-3 space-y-1.5 pl-6 list-disc">
          {(intelligence?.methodologyNotes ?? [
            "Focus time uses server-anchored timestamps inside your configured IANA timezone.",
            "Website and Windows desktop trackers record normalized hostnames/executables locally and sync daily summaries only when enabled.",
            "Idle intervals (>60s OS idle or paused timer) and disconnected time windows are excluded rather than estimated.",
          ]).map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      </details>
    </div>
  );
}
