"use client";

import {
  getDateKeysRange,
  getMonthCalendarDays,
  HABIT_CATEGORIES,
  type HabitEntryDto,
  type HabitWithStatsDto,
} from "@ember/shared";
import {
  BookOpen,
  Brain,
  CalendarDays,
  Check,
  Dumbbell,
  Flame,
  Heart,
  LayoutGrid,
  ListChecks,
  Plus,
  SkipForward,
  Sparkles,
  Terminal,
  Trash2,
  Undo2,
} from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

interface HabitsWorkspaceProps {
  initialHabits: HabitWithStatsDto[];
  todayDate: string;
}

type HabitViewMode = "cards" | "matrix" | "monthly";

const HABIT_COLORS = [
  "#10B981", // Emerald
  "#F97316", // Flame Orange
  "#38BDF8", // Sky Blue
  "#F43F5E", // Coral Rose
  "#A855F7", // Violet
] as const;

const WEEKDAY_NAMES = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"] as const;

function HabitIcon({ name, className }: { name: string; className?: string }) {
  switch (name) {
    case "book-open":
      return <BookOpen className={className} />;
    case "terminal":
      return <Terminal className={className} />;
    case "dumbbell":
      return <Dumbbell className={className} />;
    case "brain":
      return <Brain className={className} />;
    case "sparkles":
      return <Sparkles className={className} />;
    case "heart":
      return <Heart className={className} />;
    case "flame":
      return <Flame className={className} />;
    default:
      return <Check className={className} />;
  }
}

function getEntryMap(entries: HabitEntryDto[]) {
  const map = new Map<string, HabitEntryDto>();
  for (const e of entries) {
    map.set(e.localDate, e);
  }
  return map;
}

export function HabitsWorkspace({
  initialHabits,
  todayDate,
}: HabitsWorkspaceProps) {
  const [habits, setHabits] = React.useState<HabitWithStatsDto[]>(initialHabits);
  const [viewMode, setViewMode] = React.useState<HabitViewMode>("cards");
  const [categoryFilter, setCategoryFilter] = React.useState<string>("All");
  const [showCreate, setShowCreate] = React.useState(false);

  // Create habit state
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [category, setCategory] = React.useState<string>("Betterment");
  const [icon, setIcon] = React.useState("check");
  const [color, setColor] = React.useState<string>(HABIT_COLORS[0]);
  const [scheduleType, setScheduleType] = React.useState<"daily" | "weekdays">(
    "daily"
  );
  const [scheduledDays, setScheduledDays] = React.useState<number[]>([
    1, 2, 3, 4, 5,
  ]);
  const [targetPerDay, setTargetPerDay] = React.useState(1);
  const [isMutating, setIsMutating] = React.useState(false);
  const [feedback, setFeedback] = React.useState<string | null>(null);

  const filteredHabits = habits.filter(
    (h) => categoryFilter === "All" || h.category === categoryFilter
  );

  const last5Days = getDateKeysRange(todayDate, 5);
  const last84Days = getDateKeysRange(todayDate, 84);
  const currentMonthKey = todayDate.slice(0, 7);
  const monthDays = getMonthCalendarDays(currentMonthKey);

  async function handleCreateHabit(event: React.FormEvent) {
    event.preventDefault();
    if (!title.trim() || isMutating) return;
    setIsMutating(true);
    setFeedback(null);

    try {
      const res = await fetch("/api/habits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          category,
          icon,
          color,
          scheduleType,
          scheduledDays:
            scheduleType === "daily" ? [0, 1, 2, 3, 4, 5, 6] : scheduledDays,
          targetPerDay: Number(targetPerDay),
        }),
      });
      const data = (await res.json()) as {
        habit?: HabitWithStatsDto;
        error?: string;
      };
      if (!res.ok || !data.habit) {
        setFeedback(data.error ?? "Unable to create habit");
        return;
      }
      setHabits((prev) => [data.habit!, ...prev]);
      setTitle("");
      setDescription("");
      setShowCreate(false);
    } finally {
      setIsMutating(false);
    }
  }

  async function handleCheckIn(
    habitId: string,
    localDate: string,
    action: "increment" | "complete" | "skip" | "undo"
  ) {
    if (isMutating) return;
    setIsMutating(true);
    setFeedback(null);

    try {
      const res = await fetch(`/api/habits/${habitId}/checkin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ localDate, action }),
      });
      const data = (await res.json()) as {
        habit?: HabitWithStatsDto;
        xpAwarded?: number;
        error?: string;
      };
      if (!res.ok || !data.habit) {
        setFeedback(data.error ?? "Unable to update habit entry");
        return;
      }
      setHabits((prev) =>
        prev.map((h) => (h.id === habitId ? data.habit! : h))
      );
      if (data.xpAwarded && data.xpAwarded > 0) {
        setFeedback(`Checked in! +${data.xpAwarded} XP earned.`);
      }
    } finally {
      setIsMutating(false);
    }
  }

  async function handleDeleteHabit(habitId: string) {
    const res = await fetch(`/api/habits/${habitId}`, { method: "DELETE" });
    if (res.ok) {
      setHabits((prev) => prev.filter((h) => h.id !== habitId));
    }
  }

  function toggleWeekday(day: number) {
    setScheduledDays((prev) => {
      if (prev.includes(day)) {
        return prev.length > 1 ? prev.filter((d) => d !== day) : prev;
      }
      return [...prev, day].sort((a, b) => a - b);
    });
  }

  return (
    <div className="space-y-6 pb-16 sm:pb-6">
      {/* Header + View Switcher (HabitKit Refs 2, 3, 7 inspired) */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Habits</h1>
          <p className="text-sm text-text-secondary">
            Track daily consistency, streaks, and multi-step routines in your timezone.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Desktop segmented switcher */}
          <div
            role="tablist"
            aria-label="Habit views"
            className="hidden sm:inline-flex items-center rounded-full border border-border-subtle bg-surface p-1 gap-1"
          >
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === "cards"}
              onClick={() => setViewMode("cards")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium cursor-pointer transition-colors",
                viewMode === "cards"
                  ? "bg-surface-elevated text-text-primary"
                  : "text-text-muted hover:text-text-primary"
              )}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              Grid
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === "matrix"}
              onClick={() => setViewMode("matrix")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium cursor-pointer transition-colors",
                viewMode === "matrix"
                  ? "bg-surface-elevated text-text-primary"
                  : "text-text-muted hover:text-text-primary"
              )}
            >
              <ListChecks className="h-3.5 w-3.5" />
              5-Day
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === "monthly"}
              onClick={() => setViewMode("monthly")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium cursor-pointer transition-colors",
                viewMode === "monthly"
                  ? "bg-surface-elevated text-text-primary"
                  : "text-text-muted hover:text-text-primary"
              )}
            >
              <CalendarDays className="h-3.5 w-3.5" />
              Month
            </button>
          </div>

          <Button
            type="button"
            variant="ember"
            size="sm"
            onClick={() => setShowCreate((v) => !v)}
          >
            <Plus className="h-4 w-4" />
            New Habit
          </Button>
        </div>
      </div>

      {/* Category Filter Pills (Refs 2, 3, 7) */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {(["All", ...HABIT_CATEGORIES] as const).map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setCategoryFilter(cat)}
            className={cn(
              "shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors cursor-pointer",
              categoryFilter === cat
                ? "border-text-primary bg-text-primary text-canvas font-semibold"
                : "border-border-subtle bg-surface text-text-secondary hover:border-border-strong hover:text-text-primary"
            )}
          >
            {cat}
          </button>
        ))}
      </div>

      {feedback && (
        <div
          role="status"
          className="rounded-xl border border-emerald/30 bg-emerald/10 px-4 py-2.5 text-xs sm:text-sm text-emerald"
        >
          {feedback}
        </div>
      )}

      {/* Create Habit Form */}
      {showCreate && (
        <Card className="border-flame/30">
          <CardHeader>
            <CardTitle className="text-base">Create Custom Habit</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateHabit} className="grid gap-4 sm:grid-cols-12">
              <div className="space-y-1.5 sm:col-span-6">
                <Label htmlFor="habit-title">Habit Name</Label>
                <Input
                  id="habit-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Code & Learn"
                  required
                />
              </div>
              <div className="space-y-1.5 sm:col-span-6">
                <Label htmlFor="habit-desc">Motivation / Note (Optional)</Label>
                <Input
                  id="habit-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. 1 focused module every morning"
                />
              </div>

              <div className="space-y-1.5 sm:col-span-4">
                <Label htmlFor="habit-cat">Category</Label>
                <select
                  id="habit-cat"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="flex h-11 w-full rounded-xl border border-border-subtle bg-surface-elevated px-3 text-sm text-text-primary"
                >
                  {HABIT_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5 sm:col-span-4">
                <Label htmlFor="habit-icon">Icon</Label>
                <select
                  id="habit-icon"
                  value={icon}
                  onChange={(e) => setIcon(e.target.value)}
                  className="flex h-11 w-full rounded-xl border border-border-subtle bg-surface-elevated px-3 text-sm text-text-primary"
                >
                  {[
                    "check",
                    "book-open",
                    "terminal",
                    "dumbbell",
                    "brain",
                    "sparkles",
                    "heart",
                    "flame",
                  ].map((ic) => (
                    <option key={ic} value={ic}>
                      {ic}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5 sm:col-span-4">
                <Label htmlFor="habit-target">Daily Target Steps</Label>
                <Input
                  id="habit-target"
                  type="number"
                  min={1}
                  max={20}
                  value={targetPerDay}
                  onChange={(e) => setTargetPerDay(Number(e.target.value))}
                />
              </div>

              <div className="space-y-1.5 sm:col-span-6">
                <Label>Schedule</Label>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setScheduleType("daily")}
                    className={cn(
                      "rounded-lg border px-3 py-1.5 text-xs cursor-pointer",
                      scheduleType === "daily"
                        ? "border-flame bg-flame/15 text-flame-soft"
                        : "border-border-subtle bg-surface-elevated text-text-secondary"
                    )}
                  >
                    Every Day
                  </button>
                  <button
                    type="button"
                    onClick={() => setScheduleType("weekdays")}
                    className={cn(
                      "rounded-lg border px-3 py-1.5 text-xs cursor-pointer",
                      scheduleType === "weekdays"
                        ? "border-flame bg-flame/15 text-flame-soft"
                        : "border-border-subtle bg-surface-elevated text-text-secondary"
                    )}
                  >
                    Selected Weekdays
                  </button>
                </div>

                {scheduleType === "weekdays" && (
                  <div className="flex flex-wrap gap-1.5 pt-2">
                    {WEEKDAY_NAMES.map((dayName, idx) => (
                      <button
                        key={dayName}
                        type="button"
                        onClick={() => toggleWeekday(idx)}
                        className={cn(
                          "h-8 w-9 rounded-lg border text-xs font-medium cursor-pointer",
                          scheduledDays.includes(idx)
                            ? "border-flame bg-flame/20 text-flame-soft"
                            : "border-border-subtle bg-surface-elevated text-text-muted"
                        )}
                      >
                        {dayName}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-1.5 sm:col-span-6">
                <Label>Accent Color</Label>
                <div className="flex items-center gap-2 pt-1.5">
                  {HABIT_COLORS.map((hex) => (
                    <button
                      key={hex}
                      type="button"
                      aria-label={`Habit color ${hex}`}
                      onClick={() => setColor(hex)}
                      className={cn(
                        "h-8 w-8 rounded-full border-2 cursor-pointer",
                        color === hex ? "border-white scale-110" : "border-transparent opacity-70"
                      )}
                      style={{ backgroundColor: hex }}
                    />
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 sm:col-span-12">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setShowCreate(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="ember" disabled={isMutating}>
                  Create Habit
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {filteredHabits.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-text-muted">
            No habits in this view yet. Create a daily or weekday habit to start building
            streaks.
          </CardContent>
        </Card>
      ) : viewMode === "cards" ? (
        /* VIEW 1: HabitKit Contribution Cards (Ref 7 inspired) */
        <div className="grid gap-4 lg:grid-cols-2">
          {filteredHabits.map((habit) => {
            const entryMap = getEntryMap(habit.entries);
            const todayEntry = entryMap.get(todayDate);
            const isCompleted = todayEntry?.status === "completed";
            const isSkipped = todayEntry?.status === "skipped";
            const progressCount = todayEntry?.progressCount ?? 0;

            return (
              <Card
                key={habit.id}
                className="overflow-hidden border-border-subtle"
                style={{
                  background: `linear-gradient(180deg, ${habit.color}0D 0%, #131519 52%)`,
                }}
              >
                <CardContent className="p-5 space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border"
                        style={{
                          backgroundColor: `${habit.color}1F`,
                          borderColor: `${habit.color}40`,
                          color: habit.color,
                        }}
                      >
                        <HabitIcon name={habit.icon} className="h-5 w-5" />
                      </span>
                      <div className="min-w-0">
                        <h3 className="truncate text-base font-semibold text-text-primary">
                          {habit.title}
                        </h3>
                        <p className="truncate text-xs text-text-secondary">
                          {habit.description || habit.category}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        aria-label={`Check in ${habit.title}`}
                        onClick={() =>
                          void handleCheckIn(
                            habit.id,
                            todayDate,
                            isCompleted ? "undo" : "increment"
                          )
                        }
                        className={cn(
                          "flex h-11 w-11 items-center justify-center rounded-xl border text-xs font-bold transition-all cursor-pointer tabular-nums",
                          isCompleted && "text-canvas"
                        )}
                        style={{
                          backgroundColor: isCompleted
                            ? habit.color
                            : `${habit.color}18`,
                          borderColor: isCompleted ? habit.color : `${habit.color}55`,
                          color: isCompleted ? "#0B0C0E" : habit.color,
                        }}
                      >
                        {habit.targetPerDay > 1 && !isCompleted ? (
                          <span>
                            {progressCount}/{habit.targetPerDay}
                          </span>
                        ) : (
                          <Check className="h-5 w-5" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Contribution 12-week Square Grid (84 days) */}
                  <div className="grid grid-flow-col grid-rows-7 gap-1.5 overflow-x-auto pb-1">
                    {last84Days.map((dateKey) => {
                      const entry = entryMap.get(dateKey);
                      const isToday = dateKey === todayDate;
                      const bg =
                        entry?.status === "completed"
                          ? habit.color
                          : entry?.status === "partial"
                            ? `${habit.color}70`
                            : entry?.status === "skipped"
                              ? "#353B48"
                              : `${habit.color}16`;

                      return (
                        <div
                          key={dateKey}
                          title={`${dateKey}: ${entry?.status ?? "pending"}`}
                          className={cn(
                            "h-3 w-3 rounded-[3px]",
                            isToday && "ring-1 ring-white"
                          )}
                          style={{ backgroundColor: bg }}
                        />
                      );
                    })}
                  </div>

                  {/* Footer metrics & actions */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
                    <div className="flex items-center gap-3 text-text-secondary tabular-nums">
                      <span>
                        Streak:{" "}
                        <strong className="text-text-primary">
                          {habit.stats.currentStreak}d
                        </strong>
                      </span>
                      <span>
                        Best:{" "}
                        <strong className="text-text-primary">
                          {habit.stats.bestStreak}d
                        </strong>
                      </span>
                      <span>
                        Rate:{" "}
                        <strong className="text-text-primary">
                          {habit.stats.completionRate}%
                        </strong>
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        title={isSkipped ? "Undo skip" : "Skip today cleanly"}
                        onClick={() =>
                          void handleCheckIn(
                            habit.id,
                            todayDate,
                            isSkipped ? "undo" : "skip"
                          )
                        }
                        className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] text-text-muted hover:bg-surface-elevated hover:text-text-primary cursor-pointer"
                      >
                        <SkipForward className="h-3 w-3" />
                        {isSkipped ? "Unskip" : "Skip"}
                      </button>
                      {(todayEntry || progressCount > 0) && (
                        <button
                          type="button"
                          title="Undo today's check-in"
                          onClick={() => void handleCheckIn(habit.id, todayDate, "undo")}
                          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] text-text-muted hover:bg-surface-elevated hover:text-text-primary cursor-pointer"
                        >
                          <Undo2 className="h-3 w-3" />
                          Undo
                        </button>
                      )}
                      <button
                        type="button"
                        aria-label={`Delete ${habit.title}`}
                        onClick={() => void handleDeleteHabit(habit.id)}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-text-muted hover:bg-surface-elevated hover:text-rose cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : viewMode === "matrix" ? (
        /* VIEW 2: 5-Day Check-In Matrix (Ref 2 inspired) */
        <Card>
          <CardContent className="p-4 sm:p-5 overflow-x-auto">
            <div className="min-w-[460px] space-y-2">
              <div className="grid grid-cols-[1fr_repeat(5,44px)] items-center gap-2 pb-2 border-b border-border-subtle text-xs">
                <span className="font-semibold uppercase tracking-wider text-text-muted">
                  {filteredHabits.length} HABITS
                </span>
                {last5Days.map((dateKey) => {
                  const dt = new Date(`${dateKey}T00:00:00Z`);
                  const dayLabel = WEEKDAY_NAMES[dt.getUTCDay()];
                  const dayNum = dateKey.slice(8, 10);
                  const isToday = dateKey === todayDate;
                  return (
                    <div
                      key={dateKey}
                      className={cn(
                        "text-center leading-tight tabular-nums",
                        isToday ? "text-text-primary font-semibold" : "text-text-muted"
                      )}
                    >
                      <div className="text-[11px]">{dayLabel}</div>
                      <div className="text-xs">{Number(dayNum)}</div>
                    </div>
                  );
                })}
              </div>

              {filteredHabits.map((habit) => {
                const entryMap = getEntryMap(habit.entries);
                return (
                  <div
                    key={habit.id}
                    className="grid grid-cols-[1fr_repeat(5,44px)] items-center gap-2 py-1.5"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                        style={{
                          backgroundColor: `${habit.color}20`,
                          color: habit.color,
                        }}
                      >
                        <HabitIcon name={habit.icon} className="h-4 w-4" />
                      </span>
                      <span className="truncate text-sm font-medium">{habit.title}</span>
                    </div>

                    {last5Days.map((dateKey, colIdx) => {
                      const entry = entryMap.get(dateKey);
                      const isToday = dateKey === todayDate;
                      const editable = colIdx >= last5Days.length - 2; // today or yesterday
                      const done = entry?.status === "completed";
                      const partial = entry?.status === "partial";
                      const skipped = entry?.status === "skipped";

                      return (
                        <button
                          key={dateKey}
                          type="button"
                          disabled={!editable}
                          title={`${dateKey}: ${entry?.status ?? "pending"}`}
                          onClick={() =>
                            void handleCheckIn(
                              habit.id,
                              dateKey,
                              done ? "undo" : "increment"
                            )
                          }
                          className={cn(
                            "mx-auto flex h-9 w-9 items-center justify-center rounded-xl border transition-all text-[11px] font-semibold tabular-nums",
                            editable ? "cursor-pointer" : "cursor-default opacity-80",
                            isToday && "ring-2 ring-white/80"
                          )}
                          style={{
                            backgroundColor: done
                              ? habit.color
                              : partial
                                ? `${habit.color}45`
                                : skipped
                                  ? "#252932"
                                  : `${habit.color}18`,
                            borderColor: done ? habit.color : `${habit.color}40`,
                            color: done ? "#0B0C0E" : habit.color,
                          }}
                        >
                          {skipped ? "—" : partial ? `${entry?.progressCount}` : done ? <Check className="h-4 w-4" /> : ""}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ) : (
        /* VIEW 3: Monthly Calendar Mini-Grids (Ref 3 inspired) */
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Badge variant="neutral" className="text-xs">
              {currentMonthKey}
            </Badge>
            <span className="text-xs text-text-muted">
              Click today&rsquo;s card button to check in
            </span>
          </div>

          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
            {filteredHabits.map((habit) => {
              const entryMap = getEntryMap(habit.entries);
              const todayEntry = entryMap.get(todayDate);
              const isCompleted = todayEntry?.status === "completed";

              return (
                <Card key={habit.id} className="bg-surface/90">
                  <CardContent className="p-3.5 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            void handleCheckIn(
                              habit.id,
                              todayDate,
                              isCompleted ? "undo" : "increment"
                            )
                          }
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border cursor-pointer"
                          style={{
                            backgroundColor: isCompleted
                              ? habit.color
                              : `${habit.color}20`,
                            borderColor: habit.color,
                            color: isCompleted ? "#0B0C0E" : habit.color,
                          }}
                        >
                          <HabitIcon name={habit.icon} className="h-3.5 w-3.5" />
                        </button>
                        <span className="truncate text-xs font-semibold">
                          {habit.title}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-7 gap-1">
                      {monthDays.map((day) => {
                        const entry = entryMap.get(day.dateKey);
                        const isToday = day.dateKey === todayDate;
                        const bg =
                          entry?.status === "completed"
                            ? habit.color
                            : entry?.status === "partial"
                              ? `${habit.color}70`
                              : entry?.status === "skipped"
                                ? "#353B48"
                                : `${habit.color}1C`;

                        return (
                          <div
                            key={day.dateKey}
                            title={`${day.dateKey}: ${entry?.status ?? "pending"}`}
                            className={cn(
                              "aspect-square rounded-full",
                              isToday && "ring-1 ring-white"
                            )}
                            style={{ backgroundColor: bg }}
                          />
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Mobile Floating 3-View Switcher (Ref 2, 3, 7 signature!) */}
      <div className="fixed inset-x-0 bottom-[74px] z-30 flex justify-center pointer-events-none sm:hidden">
        <div className="pointer-events-auto inline-flex items-center rounded-full border border-border-strong bg-surface-elevated/95 p-1 shadow-xl backdrop-blur-md">
          <button
            type="button"
            aria-label="Card grid view"
            onClick={() => setViewMode("cards")}
            className={cn(
              "inline-flex h-9 w-11 items-center justify-center rounded-full cursor-pointer",
              viewMode === "cards"
                ? "bg-surface-hover text-text-primary"
                : "text-text-muted"
            )}
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="5-day matrix view"
            onClick={() => setViewMode("matrix")}
            className={cn(
              "inline-flex h-9 w-11 items-center justify-center rounded-full cursor-pointer",
              viewMode === "matrix"
                ? "bg-surface-hover text-text-primary"
                : "text-text-muted"
            )}
          >
            <ListChecks className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="Monthly grid view"
            onClick={() => setViewMode("monthly")}
            className={cn(
              "inline-flex h-9 w-11 items-center justify-center rounded-full cursor-pointer",
              viewMode === "monthly"
                ? "bg-surface-hover text-text-primary"
                : "text-text-muted"
            )}
          >
            <CalendarDays className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
