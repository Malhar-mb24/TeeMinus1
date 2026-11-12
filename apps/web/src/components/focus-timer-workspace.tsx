"use client";

import {
  type CompanionStyle,
  type FocusMode,
  type FocusSessionDto,
  type SoundscapePreference,
  type TaskDto,
  type UserPreferencesDto,
} from "@ember/shared";
import {
  CheckCircle2,
  Headphones,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  Square,
  XCircle,
} from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { cn } from "@/lib/utils";
import { FlameCompanion } from "./flame-companion";
import { FlowTunesPanel } from "./flowtunes-panel";
import { dispatchBrowserOrInAppReminder } from "./reminder-engine";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

interface FocusTimerWorkspaceProps {
  initialActiveSession: FocusSessionDto | null;
  initialHistory: FocusSessionDto[];
  tasks: TaskDto[];
  preferences: UserPreferencesDto;
  initialTaskId?: string | null;
  level: number;
}

const MODE_LABELS: Array<{ id: FocusMode; label: string }> = [
  { id: "pomodoro", label: "Pomodoro" },
  { id: "custom", label: "Custom" },
  { id: "short_break", label: "Short Break" },
  { id: "long_break", label: "Long Break" },
  { id: "stopwatch", label: "Stopwatch" },
];

function formatTimerClock(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hrs = Math.floor(safe / 3600);
  const mins = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  if (hrs > 0) {
    return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

export function computeClientElapsedSeconds(session: FocusSessionDto | null, nowMs: number): number {
  if (!session) return 0;
  if (session.status !== "running" || !session.lastResumedAt) {
    return session.accumulatedSeconds;
  }
  const resumedMs = Date.parse(session.lastResumedAt);
  const delta = Number.isFinite(resumedMs)
    ? Math.max(0, Math.floor((nowMs - resumedMs) / 1000))
    : 0;
  return session.accumulatedSeconds + delta;
}

export function FocusTimerWorkspace({
  initialActiveSession,
  initialHistory,
  tasks,
  preferences,
  initialTaskId = null,
  level,
}: FocusTimerWorkspaceProps) {
  const router = useRouter();
  const [activeSession, setActiveSession] = React.useState<FocusSessionDto | null>(
    initialActiveSession
  );
  const [history, setHistory] = React.useState<FocusSessionDto[]>(initialHistory);

  const [selectedMode, setSelectedMode] = React.useState<FocusMode>(
    initialActiveSession?.mode ?? "pomodoro"
  );
  const [customMinutes, setCustomMinutes] = React.useState(45);
  const [selectedTaskId, setSelectedTaskId] = React.useState<string>(
    initialActiveSession?.taskId ?? initialTaskId ?? ""
  );
  const [sessionLabel, setSessionLabel] = React.useState(
    initialActiveSession?.label ?? ""
  );
  const [sessionNotes, setSessionNotes] = React.useState(
    initialActiveSession?.notes ?? ""
  );
  const [soundscape, setSoundscape] = React.useState<SoundscapePreference>(
    (initialActiveSession?.soundscape as SoundscapePreference) ??
      preferences.soundscapePreference
  );

  const [nowMs, setNowMs] = React.useState(() => Date.now());
  const [ambientMode, setAmbientMode] = React.useState(false);
  const [isMutating, setIsMutating] = React.useState(false);
  const [banner, setBanner] = React.useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Sync timestamp ticker with visibility & focus changes so refresh/tab sleep stays exact
  React.useEffect(() => {
    const syncNow = () => setNowMs(Date.now());
    syncNow();
    const interval = window.setInterval(syncNow, 250);
    document.addEventListener("visibilitychange", syncNow);
    window.addEventListener("focus", syncNow);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", syncNow);
      window.removeEventListener("focus", syncNow);
    };
  }, []);

  function getConfiguredPlannedSeconds(mode: FocusMode): number | null {
    if (mode === "stopwatch") return null;
    if (mode === "pomodoro") return preferences.pomodoroMinutes * 60;
    if (mode === "short_break") return preferences.shortBreakMinutes * 60;
    if (mode === "long_break") return preferences.longBreakMinutes * 60;
    return Math.max(5, Math.min(240, customMinutes)) * 60;
  }

  const elapsedSeconds = computeClientElapsedSeconds(activeSession, nowMs);
  const plannedSeconds = activeSession
    ? activeSession.plannedDurationSeconds
    : getConfiguredPlannedSeconds(selectedMode);

  const remainingSeconds =
    plannedSeconds !== null ? Math.max(0, plannedSeconds - elapsedSeconds) : elapsedSeconds;

  const displaySeconds =
    (activeSession?.mode ?? selectedMode) === "stopwatch"
      ? elapsedSeconds
      : remainingSeconds;

  const progressRatio =
    plannedSeconds && plannedSeconds > 0
      ? Math.min(1, elapsedSeconds / plannedSeconds)
      : activeSession
        ? ((elapsedSeconds % 60) / 60)
        : 0;

  const activeMode = activeSession?.mode ?? selectedMode;
  const isBreak = activeMode === "short_break" || activeMode === "long_break";
  const companionMood = banner?.type === "success"
    ? "celebration"
    : activeSession?.status === "running"
      ? isBreak
        ? "sleepy"
        : "excited"
      : activeSession?.status === "paused"
        ? "idle"
        : "happy";

  async function refreshSessions() {
    const res = await fetch("/api/focus-sessions?limit=25");
    if (res.ok) {
      const json = (await res.json()) as {
        activeSession: FocusSessionDto | null;
        sessions: FocusSessionDto[];
      };
      setActiveSession(json.activeSession);
      setHistory(json.sessions);
    }
  }

  async function handleStart() {
    if (isMutating) return;
    setIsMutating(true);
    setBanner(null);

    try {
      const planned = getConfiguredPlannedSeconds(selectedMode);
      const res = await fetch("/api/focus-sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: selectedMode,
          plannedDurationSeconds: planned,
          taskId: selectedTaskId || null,
          label: sessionLabel.trim() || undefined,
          soundscape,
        }),
      });

      const data = (await res.json()) as {
        session?: FocusSessionDto;
        activeSession?: FocusSessionDto;
        error?: string;
      };

      if (res.status === 409 && data.activeSession) {
        setActiveSession(data.activeSession);
        setBanner({
          type: "error",
          text: "Recovered your existing active session.",
        });
        return;
      }

      if (!res.ok || !data.session) {
        setBanner({
          type: "error",
          text: data.error ?? "Unable to start session",
        });
        return;
      }

      setActiveSession(data.session);
      setNowMs(Date.now());
    } catch {
      setBanner({ type: "error", text: "Network error starting timer" });
    } finally {
      setIsMutating(false);
    }
  }

  async function handleTransition(
    action: "pause" | "resume" | "complete" | "interrupt" | "cancel"
  ) {
    if (!activeSession || isMutating) return;
    setIsMutating(true);
    setBanner(null);

    try {
      const idempotencyKey =
        action === "complete" || action === "interrupt" || action === "cancel"
          ? `${activeSession.id}:${action}`
          : undefined;

      const res = await fetch(`/api/focus-sessions/${activeSession.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          notes: sessionNotes.trim() || null,
          label: sessionLabel.trim() || null,
          soundscape,
          idempotencyKey,
        }),
      });

      const data = (await res.json()) as {
        session?: FocusSessionDto;
        xpAwarded?: number;
        newlyUnlockedAchievements?: string[];
        error?: string;
      };

      if (!res.ok || !data.session) {
        setBanner({
          type: "error",
          text: data.error ?? "Unable to update session",
        });
        return;
      }

      if (action === "pause" || action === "resume") {
        setActiveSession(data.session);
      } else {
        setActiveSession(null);
        setSessionNotes("");
        await refreshSessions();
        router.refresh();
        const xpMsg =
          data.xpAwarded && data.xpAwarded > 0
            ? ` +${data.xpAwarded} XP earned!`
            : "";
        const achMsg =
          data.newlyUnlockedAchievements && data.newlyUnlockedAchievements.length > 0
            ? ` Unlocked achievement: ${data.newlyUnlockedAchievements.join(", ")}.`
            : "";
        setBanner({
          type: "success",
          text: `Session marked as ${data.session.status}.${xpMsg}${achMsg}`,
        });
      }
    } catch {
      setBanner({ type: "error", text: "Network error updating timer" });
    } finally {
      setIsMutating(false);
    }
  }

  // SVG circular dial constants
  const radius = 122;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - progressRatio);

  const todayLabel = new Date().toLocaleDateString("en-CA", {
    timeZone: preferences.timezone || "UTC",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  });

  const completedAlertSentRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (
      !preferences.notificationsEnabled ||
      !activeSession ||
      activeSession.status !== "running" ||
      plannedSeconds === null ||
      remainingSeconds > 0
    ) {
      return;
    }
    if (completedAlertSentRef.current === activeSession.id) {
      return;
    }
    completedAlertSentRef.current = activeSession.id;
    dispatchBrowserOrInAppReminder(
      {
        id: "focus",
        title: "Focus block elapsed",
        body: "Your planned timer reached 00:00. Mark your session complete to record XP.",
        href: "/focus",
      },
      (item) => {
        window.dispatchEvent(new CustomEvent("ember-test-reminder", { detail: item }));
      }
    );
  }, [activeSession, plannedSeconds, preferences.notificationsEnabled, remainingSeconds]);

  return (
    <div
      className={cn(
        "space-y-6",
        ambientMode &&
          "fixed inset-0 z-50 flex flex-col items-center justify-center bg-[radial-gradient(circle_at_65%_40%,rgba(249,115,22,0.22),transparent_48%),#08090B] p-6"
      )}
    >
      {!ambientMode && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Focus Timer</h1>
            <p className="text-sm text-text-secondary">
              Timestamp-anchored sessions that recover cleanly across refreshes.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setAmbientMode(true)}
            >
              <Maximize2 className="h-4 w-4" />
              Ambient Focus
            </Button>
          </div>
        </div>
      )}

      {ambientMode && (
        <div className="absolute top-5 right-5 flex items-center gap-2">
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
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setAmbientMode(false)}
          >
            <Minimize2 className="h-4 w-4" />
            Exit Ambient
          </Button>
        </div>
      )}

      {/* Mode Switcher Pills (Flocus Ref 8 inspired) */}
      <div className="flex flex-wrap items-center justify-center gap-2">
        {MODE_LABELS.map((mode) => {
          const isSelected = activeMode === mode.id;
          return (
            <button
              key={mode.id}
              type="button"
              disabled={Boolean(activeSession)}
              onClick={() => setSelectedMode(mode.id)}
              className={cn(
                "rounded-full border px-4 py-1.5 text-xs sm:text-sm font-medium transition-colors cursor-pointer disabled:cursor-not-allowed",
                isSelected
                  ? "border-text-primary bg-text-primary text-canvas font-semibold"
                  : "border-border-subtle bg-surface text-text-secondary hover:border-border-strong hover:text-text-primary"
              )}
            >
              {mode.label}
            </button>
          );
        })}
      </div>

      {/* Main Circular Dial + Controls Card */}
      <div className={cn("grid gap-6", !ambientMode && "lg:grid-cols-12")}>
        <Card
          className={cn(
            "relative overflow-hidden",
            ambientMode
              ? "w-full max-w-lg border-border-subtle/50 bg-surface/60 backdrop-blur-md"
              : "lg:col-span-7"
          )}
        >
          <CardContent className="flex flex-col items-center justify-center py-8 px-4 sm:px-6 space-y-6">
            {/* Circular Dial (YPT Ref 5 inspired with radial ticks & subtle ring glow) */}
            <div className="relative flex h-72 w-72 sm:h-80 sm:w-80 items-center justify-center">
              <svg
                viewBox="0 0 280 280"
                className="h-full w-full -rotate-90"
                aria-hidden="true"
              >
                {/* Radial ticks */}
                {Array.from({ length: 60 }).map((_, idx) => {
                  const angle = (idx / 60) * Math.PI * 2;
                  const inner = idx % 5 === 0 ? 128 : 131;
                  const outer = 136;
                  const x1 = 140 + Math.cos(angle) * inner;
                  const y1 = 140 + Math.sin(angle) * inner;
                  const x2 = 140 + Math.cos(angle) * outer;
                  const y2 = 140 + Math.sin(angle) * outer;
                  return (
                    <line
                      key={idx}
                      x1={x1}
                      y1={y1}
                      x2={x2}
                      y2={y2}
                      stroke={idx % 5 === 0 ? "#475569" : "#252932"}
                      strokeWidth={idx % 5 === 0 ? "1.6" : "1"}
                    />
                  );
                })}

                {/* Background ring */}
                <circle
                  cx="140"
                  cy="140"
                  r={radius}
                  fill="none"
                  stroke="#1F242D"
                  strokeWidth="8"
                />

                {/* Progress arc */}
                <circle
                  cx="140"
                  cy="140"
                  r={radius}
                  fill="none"
                  stroke={isBreak ? "#38BDF8" : "#F97316"}
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  className="transition-[stroke-dashoffset] duration-300"
                />
              </svg>

              {/* Center Readout */}
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6">
                <span className="text-xs font-medium tracking-wider text-text-muted">
                  {todayLabel}
                </span>
                <div
                  data-testid="timer-display"
                  className="mt-1 text-5xl sm:text-6xl font-bold tracking-tight text-text-primary tabular-nums"
                >
                  {formatTimerClock(displaySeconds)}
                </div>
                <div className="mt-2 flex items-center gap-1.5 text-xs text-text-secondary">
                  <span
                    className={cn(
                      "h-2 w-2 rounded-full",
                      activeSession?.status === "running"
                        ? "bg-emerald animate-pulse"
                        : isBreak
                          ? "bg-sky"
                          : "bg-flame"
                    )}
                  />
                  <span className="max-w-[170px] truncate">
                    {activeSession?.label ||
                      activeSession?.taskTitle ||
                      tasks.find((t) => t.id === selectedTaskId)?.title ||
                      (isBreak ? "Recharge break" : "General study focus")}
                  </span>
                </div>
                {activeSession && (
                  <span className="mt-1 text-[11px] text-text-muted tabular-nums">
                    Elapsed: {formatTimerClock(elapsedSeconds)}
                  </span>
                )}
              </div>
            </div>

            {/* Custom duration input when idle in custom mode */}
            {!activeSession && selectedMode === "custom" && (
              <div className="flex items-center gap-3">
                <Label htmlFor="custom-minutes">Minutes</Label>
                <Input
                  id="custom-minutes"
                  type="number"
                  min={5}
                  max={240}
                  value={customMinutes}
                  onChange={(e) => setCustomMinutes(Number(e.target.value))}
                  className="w-24 text-center tabular-nums"
                />
              </div>
            )}

            {/* Primary Controls */}
            <div className="flex flex-wrap items-center justify-center gap-3">
              {!activeSession ? (
                <Button
                  type="button"
                  variant="ember"
                  size="lg"
                  disabled={isMutating}
                  onClick={handleStart}
                  className="min-w-40 rounded-full"
                >
                  <Play className="h-4 w-4" />
                  Start Focus
                </Button>
              ) : (
                <>
                  {activeSession.status === "running" ? (
                    <Button
                      type="button"
                      variant="secondary"
                      size="lg"
                      disabled={isMutating}
                      onClick={() => handleTransition("pause")}
                      className="rounded-full"
                    >
                      <Pause className="h-4 w-4" />
                      Pause
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="ember"
                      size="lg"
                      disabled={isMutating}
                      onClick={() => handleTransition("resume")}
                      className="rounded-full"
                    >
                      <Play className="h-4 w-4" />
                      Resume
                    </Button>
                  )}

                  <Button
                    type="button"
                    variant="primary"
                    size="lg"
                    disabled={isMutating}
                    onClick={() => handleTransition("complete")}
                    className="rounded-full"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Finish &amp; Save
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isMutating}
                    onClick={() => handleTransition("interrupt")}
                    title="End early and log elapsed focus time"
                  >
                    <Square className="h-3.5 w-3.5" />
                    Interrupt
                  </Button>

                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={isMutating}
                    onClick={() => handleTransition("cancel")}
                    className="text-rose hover:text-rose"
                    title="Discard without awarding XP"
                  >
                    <XCircle className="h-3.5 w-3.5" />
                    Cancel
                  </Button>
                </>
              )}
            </div>

            {banner && (
              <div
                role="status"
                className={cn(
                  "w-full rounded-xl border px-4 py-2.5 text-center text-xs sm:text-sm",
                  banner.type === "success"
                    ? "border-emerald/30 bg-emerald/10 text-emerald"
                    : "border-rose/30 bg-rose/10 text-rose"
                )}
              >
                {banner.text}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right Context Panel (hidden in Ambient Fullscreen) */}
        {!ambientMode && (
          <div className="space-y-6 lg:col-span-5">
            <Card>
              <CardContent className="p-5">
                <FlameCompanion
                  mood={companionMood}
                  styleVariant={preferences.companionStyle as CompanionStyle}
                  size="md"
                  level={level}
                  message={
                    activeSession?.status === "running"
                      ? "Timer is anchored to your clock—you can refresh safely anytime."
                      : "Pick a task, set your soundscape, and start when ready."
                  }
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Session Context &amp; Soundscape</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="focus-task-select">Linked Task</Label>
                  <select
                    id="focus-task-select"
                    disabled={Boolean(activeSession)}
                    value={selectedTaskId}
                    onChange={(e) => setSelectedTaskId(e.target.value)}
                    className="flex h-11 w-full rounded-xl border border-border-subtle bg-surface-elevated px-3 text-sm text-text-primary"
                  >
                    <option value="">General Focus (No linked task)</option>
                    {tasks
                      .filter((t) => t.status !== "completed" && t.status !== "archived")
                      .map((task) => (
                        <option key={task.id} value={task.id}>
                          [{task.category}] {task.title} ({task.plannedMinutes}m)
                        </option>
                      ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="focus-label">Session Label</Label>
                  <Input
                    id="focus-label"
                    value={sessionLabel}
                    onChange={(e) => setSessionLabel(e.target.value)}
                    placeholder="e.g. Algorithms Chapter 4"
                  />
                </div>

                <FlowTunesPanel
                  soundscape={soundscape}
                  onSoundscapeChange={setSoundscape}
                  sessionActive={activeSession?.status === "running"}
                />

                <div className="space-y-1.5">
                  <Label htmlFor="focus-notes">Session Notes</Label>
                  <textarea
                    id="focus-notes"
                    rows={3}
                    value={sessionNotes}
                    onChange={(e) => setSessionNotes(e.target.value)}
                    placeholder="Quick notes on what you accomplished..."
                    className="w-full rounded-xl border border-border-subtle bg-surface-elevated p-3 text-sm text-text-primary placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-flame/60"
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Session History */}
      {!ambientMode && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Recent Focus Sessions</CardTitle>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => void refreshSessions()}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Refresh
            </Button>
          </CardHeader>
          <CardContent>
            {history.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border-subtle p-6 text-center text-sm text-text-muted">
                No sessions recorded yet. Start your first focus block above.
              </div>
            ) : (
              <div className="divide-y divide-border-subtle">
                {history.map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 py-3 text-sm"
                  >
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-text-primary truncate">
                          {item.label || item.taskTitle || `${item.mode} session`}
                        </span>
                        <Badge
                          variant={
                            item.status === "completed"
                              ? "emerald"
                              : item.status === "interrupted"
                                ? "flame"
                                : item.status === "cancelled"
                                  ? "rose"
                                  : "sky"
                          }
                        >
                          {item.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-text-muted">
                        {item.localDate} · {item.mode.replace("_", " ")} ·{" "}
                        {item.soundscape !== "none" ? `${item.soundscape} · ` : ""}
                        {item.notes ? item.notes : "No notes"}
                      </p>
                    </div>

                    <div className="flex items-center gap-3 shrink-0 tabular-nums">
                      <span className="font-mono text-sm font-semibold text-text-primary">
                        {formatTimerClock(item.accumulatedSeconds)}
                      </span>
                      {item.xpEarned > 0 && (
                        <Badge variant="flame">
                          <Sparkles className="h-3 w-3" />+{item.xpEarned} XP
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
