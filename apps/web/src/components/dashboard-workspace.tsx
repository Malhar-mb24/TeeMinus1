"use client";

import {
  formatMinutesLabel,
  type AnalyticsSummaryDto,
  type CompanionStyle,
  type FocusSessionDto,
  type GamificationSummaryDto,
  type HabitWithStatsDto,
  type TaskDto,
  type UserPreferencesDto,
} from "@ember/shared";
import {
  ArrowRight,
  Check,
  Flame,
  Grid2x2Check,
  Headphones,
  Play,
  Sparkles,
  Target,
  Timer,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { cn } from "@/lib/utils";
import { FlameCompanion } from "./flame-companion";
import { computeClientElapsedSeconds } from "./focus-timer-workspace";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { WeeklyFocusChart } from "./weekly-focus-chart";

interface DashboardWorkspaceProps {
  displayName: string | null;
  preferences: UserPreferencesDto;
  analytics: AnalyticsSummaryDto;
  gamification: GamificationSummaryDto;
  activeSession: FocusSessionDto | null;
  recentSessions: FocusSessionDto[];
  initialTasks: TaskDto[];
  initialHabits: HabitWithStatsDto[];
}

export function DashboardWorkspace({
  displayName,
  preferences,
  analytics,
  gamification,
  activeSession,
  recentSessions,
  initialTasks,
  initialHabits,
}: DashboardWorkspaceProps) {
  const router = useRouter();
  const [habits, setHabits] = React.useState(initialHabits);
  const [tasks, setTasks] = React.useState(initialTasks);
  const [xpToast, setXpToast] = React.useState<string | null>(null);
  const [nowMs, setNowMs] = React.useState(() => Date.now());

  React.useEffect(() => {
    if (!activeSession || activeSession.status !== "running") return;
    const id = window.setInterval(() => setNowMs(Date.now()), 500);
    return () => window.clearInterval(id);
  }, [activeSession]);

  const activeElapsed = computeClientElapsedSeconds(activeSession, nowMs);
  const goalPct = Math.min(
    100,
    Math.round(
      (analytics.daily.focusMinutes / Math.max(1, analytics.daily.dailyGoalMinutes)) *
        100
    )
  );

  const companionMood =
    activeSession?.status === "running"
      ? "excited"
      : analytics.daily.focusMinutes >= analytics.daily.dailyGoalMinutes
        ? "celebration"
        : analytics.daily.focusMinutes > 0 || analytics.daily.habitsCompleted > 0
          ? "happy"
          : "idle";

  async function toggleHabit(habit: HabitWithStatsDto) {
    const todayEntry = habit.entries.find(
      (e) => e.localDate === analytics.todayDate
    );
    const isCompleted = todayEntry?.status === "completed";
    const res = await fetch(`/api/habits/${habit.id}/checkin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        localDate: analytics.todayDate,
        action: isCompleted ? "undo" : "increment",
      }),
    });
    if (res.ok) {
      const data = (await res.json()) as {
        habit: HabitWithStatsDto;
        xpAwarded: number;
      };
      setHabits((prev) =>
        prev.map((item) => (item.id === habit.id ? data.habit : item))
      );
      router.refresh();
      if (data.xpAwarded > 0) {
        setXpToast(`+${data.xpAwarded} XP earned!`);
      }
    }
  }

  async function toggleTask(task: TaskDto) {
    const nextStatus = task.status === "completed" ? "todo" : "completed";
    const res = await fetch(`/api/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    });
    if (res.ok) {
      const data = (await res.json()) as { task: TaskDto };
      setTasks((prev) =>
        prev.map((item) => (item.id === task.id ? data.task : item))
      );
      router.refresh();
    }
  }

  const todayTasks = tasks.filter((t) => t.status !== "archived").slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Header + Companion Greeting Row */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              {displayName ? `Welcome back, ${displayName}` : "Today's Focus"}
            </h1>
            <Badge variant="flame" className="tabular-nums">
              Level {gamification.level} · {gamification.totalXp} XP
            </Badge>
          </div>
          <p className="text-sm text-text-secondary">
            {analytics.todayDate} ({preferences.timezone}) ·{" "}
            {gamification.currentFocusStreakDays > 0
              ? `${gamification.currentFocusStreakDays}-day focus streak`
              : "Start a session to spark today's focus streak"}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <a
              href="https://www.flowtunes.app/index.html"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Headphones className="h-4 w-4 text-flame-soft" />
              FlowTunes
            </a>
          </Button>
          <Button asChild variant="ember" size="sm">
            <Link href="/focus">
              <Play className="h-4 w-4" />
              {activeSession ? "Resume Active Timer" : "Start Focus Timer"}
            </Link>
          </Button>
        </div>
      </div>

      {xpToast && (
        <div
          role="status"
          className="flex items-center gap-2 rounded-xl border border-emerald/30 bg-emerald/10 px-4 py-2 text-xs font-medium text-emerald"
        >
          <Sparkles className="h-4 w-4" />
          {xpToast}
        </div>
      )}

      {/* Top Bento Row: Companion + Daily Focus Progress + Quick Timer Card */}
      <div className="grid gap-4 lg:grid-cols-12">
        <Card className="lg:col-span-5">
          <CardContent className="p-5 space-y-4">
            <FlameCompanion
              mood={companionMood}
              styleVariant={preferences.companionStyle as CompanionStyle}
              size="lg"
              level={gamification.level}
              message={
                activeSession
                  ? `Session active (${Math.floor(activeElapsed / 60)}m elapsed). Staying right here with you.`
                  : analytics.daily.focusMinutes >= analytics.daily.dailyGoalMinutes
                    ? "You reached today's focus target!"
                    : "Ready for a calm, focused study block whenever you are."
              }
            />
            <div className="space-y-1.5 pt-1">
              <div className="flex justify-between text-xs text-text-secondary tabular-nums">
                <span>XP to Level {gamification.level + 1}</span>
                <span>{gamification.xpToNextLevel} XP left</span>
              </div>
              <div className="h-1.5 rounded-full bg-surface-elevated overflow-hidden">
                <div
                  className="h-full rounded-full bg-flame transition-all"
                  style={{ width: `${gamification.progressPercent}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-4">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Target className="h-4 w-4 text-flame-soft" />
                Today&rsquo;s Focus Progress
              </CardTitle>
              <span className="text-xs font-semibold text-flame-soft tabular-nums">
                {goalPct}%
              </span>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-3xl font-bold tracking-tight tabular-nums">
                {formatMinutesLabel(analytics.daily.focusMinutes)}
              </p>
              <p className="text-xs text-text-secondary tabular-nums">
                of {formatMinutesLabel(analytics.daily.dailyGoalMinutes)} daily goal ·{" "}
                {analytics.daily.sessionsCompleted} sessions today
              </p>
            </div>
            <div className="h-2 rounded-full bg-surface-elevated overflow-hidden">
              <div
                className="h-full rounded-full bg-flame transition-all"
                style={{ width: `${goalPct}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-xs text-text-secondary pt-1">
              <span>Habits: {analytics.daily.habitsCompleted} done</span>
              <span>Tasks: {analytics.daily.tasksCompleted} done (7d)</span>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3 border-flame/25 bg-[linear-gradient(180deg,rgba(249,115,22,0.08)_0%,#131519_65%)]">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Timer className="h-4 w-4 text-flame" />
              {activeSession ? "Running Session" : "Quick Start"}
            </CardTitle>
            <CardDescription className="text-xs">
              {activeSession
                ? `${activeSession.mode.replace("_", " ")} · ${activeSession.status}`
                : `${preferences.pomodoroMinutes}m Pomodoro default`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-3xl font-bold font-mono tabular-nums text-text-primary">
              {activeSession
                ? `${String(Math.floor(activeElapsed / 60)).padStart(2, "0")}:${String(
                    activeElapsed % 60
                  ).padStart(2, "0")}`
                : `${preferences.pomodoroMinutes}:00`}
            </p>
            <Button asChild variant="ember" className="w-full">
              <Link href="/focus">
                {activeSession ? "Open Active Timer" : "Launch Focus Timer"}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Middle Row: Habit Checklist + Today's Tasks */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Today's Habit Checklist */}
        <Card className="lg:col-span-6">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Grid2x2Check className="h-4 w-4 text-emerald" />
                Habit Checklist
              </CardTitle>
              <CardDescription className="text-xs">
                Tap to check in for {analytics.todayDate}
              </CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href="/habits">All Habits</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {habits.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border-subtle p-6 text-center text-xs text-text-muted space-y-2">
                <p>No habits created yet.</p>
                <Button asChild variant="secondary" size="sm">
                  <Link href="/habits">Create your first habit</Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {habits.slice(0, 5).map((habit) => {
                  const entry = habit.entries.find(
                    (e) => e.localDate === analytics.todayDate
                  );
                  const done = entry?.status === "completed";
                  return (
                    <div
                      key={habit.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-border-subtle bg-surface-elevated/60 px-3.5 py-2.5"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{habit.title}</p>
                        <p className="text-[11px] text-text-muted tabular-nums">
                          Streak: {habit.stats.currentStreak}d · {habit.category}
                        </p>
                      </div>
                      <button
                        type="button"
                        aria-label={`Check in ${habit.title}`}
                        onClick={() => void toggleHabit(habit)}
                        className={cn(
                          "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition-colors cursor-pointer",
                          done && "text-canvas"
                        )}
                        style={{
                          backgroundColor: done ? habit.color : `${habit.color}1C`,
                          borderColor: done ? habit.color : `${habit.color}55`,
                          color: done ? "#0B0C0E" : habit.color,
                        }}
                      >
                        <Check className="h-4 w-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tasks Checklist */}
        <Card className="lg:col-span-6">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Tasks &amp; Study Queue</CardTitle>
              <CardDescription className="text-xs">
                Check off completed tasks or jump straight into a focus block.
              </CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href="/tasks">Planner</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {todayTasks.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border-subtle p-6 text-center text-xs text-text-muted space-y-2">
                <p>No tasks queued yet.</p>
                <Button asChild variant="secondary" size="sm">
                  <Link href="/tasks">Add a study task</Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {todayTasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-border-subtle bg-surface-elevated/60 px-3.5 py-2.5"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        className="h-6 w-1 shrink-0 rounded-full"
                        style={{ backgroundColor: task.color }}
                      />
                      <button
                        type="button"
                        aria-label={`Complete ${task.title}`}
                        onClick={() => void toggleTask(task)}
                        className={cn(
                          "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border cursor-pointer",
                          task.status === "completed"
                            ? "border-emerald bg-emerald text-canvas"
                            : "border-border-strong bg-canvas"
                        )}
                      >
                        {task.status === "completed" && <Check className="h-3.5 w-3.5" />}
                      </button>
                      <div className="min-w-0">
                        <p
                          className={cn(
                            "truncate text-sm font-medium",
                            task.status === "completed" && "line-through text-text-muted"
                          )}
                        >
                          {task.title}
                        </p>
                        <p className="text-[11px] text-text-muted tabular-nums">
                          {task.category} · Plan {formatMinutesLabel(task.plannedMinutes)}
                        </p>
                      </div>
                    </div>

                    {task.status !== "completed" && (
                      <Button asChild variant="ghost" size="icon" className="h-8 w-8">
                        <Link href={`/focus?taskId=${task.id}`} aria-label={`Focus on ${task.title}`}>
                          <Play className="h-3.5 w-3.5 text-flame-soft" />
                        </Link>
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bottom Row: Weekly Activity Chart + Recent Focus Sessions */}
      <div className="grid gap-6 lg:grid-cols-12">
        <Card className="lg:col-span-6">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Weekly Focus Activity</CardTitle>
              <CardDescription className="text-xs tabular-nums">
                {formatMinutesLabel(analytics.weekly.totalFocusMinutes)} across the last
                7 days
              </CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href="/insights">Full Insights</Link>
            </Button>
          </CardHeader>
          <CardContent>
            <WeeklyFocusChart
              buckets={analytics.weekly.buckets}
              todayDate={analytics.todayDate}
              height={180}
            />
          </CardContent>
        </Card>

        <Card className="lg:col-span-6">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Flame className="h-4 w-4 text-flame" />
                Recent Sessions
              </CardTitle>
              <CardDescription className="text-xs">
                Latest completed and paused study blocks
              </CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href="/focus">History</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {recentSessions.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border-subtle p-6 text-center text-xs text-text-muted">
                No sessions completed yet. Start your first block on the Focus Timer
                page.
              </div>
            ) : (
              <div className="divide-y divide-border-subtle text-xs">
                {recentSessions.slice(0, 5).map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between py-2.5 gap-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-text-primary">
                        {s.label || s.taskTitle || s.mode.replace("_", " ")}
                      </p>
                      <p className="text-text-muted">
                        {s.localDate} · {s.status}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 tabular-nums">
                      <span className="font-mono font-semibold text-text-primary">
                        {formatMinutesLabel(Math.round(s.accumulatedSeconds / 60))}
                      </span>
                      {s.xpEarned > 0 && (
                        <Badge variant="flame" className="text-[10px]">
                          +{s.xpEarned} XP
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
