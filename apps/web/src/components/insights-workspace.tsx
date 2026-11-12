"use client";

import {
  COSMETIC_UNLOCK_RULES,
  formatMinutesLabel,
  getDayOfWeekFromDateKey,
  type AnalyticsSummaryDto,
  type CompanionStyle,
  type GamificationSummaryDto,
} from "@ember/shared";
import {
  Award,
  CheckCircle2,
  Flame,
  Lock,
  Sparkles,
  Target,
  Timer,
  Trophy,
} from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";
import { FlameCompanion } from "./flame-companion";
import { Badge } from "./ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { WeeklyFocusChart } from "./weekly-focus-chart";

interface InsightsWorkspaceProps {
  analytics: AnalyticsSummaryDto;
  initialGamification: GamificationSummaryDto;
  initialCompanionStyle: CompanionStyle;
}

const HEATMAP_DAY_HEADERS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

function getIntensityColor(minutes: number): string {
  if (minutes <= 0) return "#1B1E24";
  if (minutes < 30) return "#7C2D12";
  if (minutes < 60) return "#C2410C";
  if (minutes < 120) return "#F97316";
  return "#FDBA74";
}

export function InsightsWorkspace({
  analytics,
  initialGamification,
  initialCompanionStyle,
}: InsightsWorkspaceProps) {
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

  // Pad leading days before first heatmap cell so columns align Sunday..Saturday (Ref 6!)
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Insights &amp; Progression
        </h1>
        <p className="text-sm text-text-secondary">
          Server-aggregated focus trends, heatmaps, achievements, and XP ledger.
        </p>
      </div>

      {/* Daily Summary Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4 sm:p-5">
            <p className="text-xs text-text-muted">Today&rsquo;s Focus</p>
            <p className="mt-1 text-2xl font-bold tabular-nums">
              {formatMinutesLabel(analytics.daily.focusMinutes)}
            </p>
            <p className="mt-1 text-xs text-text-secondary tabular-nums">
              Goal: {formatMinutesLabel(analytics.daily.dailyGoalMinutes)}
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
            <p className="text-xs text-text-muted">90-Day Total</p>
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

      {/* Weekly Focus Chart + Monthly Contribution Heatmap */}
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

            {analytics.weekly.categoryBreakdown.length > 0 && (
              <div className="border-t border-border-subtle pt-3 space-y-2">
                <p className="text-xs font-medium uppercase tracking-wider text-text-muted">
                  Focus by Category (7d)
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
            )}
          </CardContent>
        </Card>

        {/* Focus Contribution Heatmap (Ref 6 inspired) */}
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
  );
}
