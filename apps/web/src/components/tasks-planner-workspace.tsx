"use client";

import {
  addDaysToDateKey,
  formatMinutesLabel,
  TASK_COLORS,
  TASK_PRIORITIES,
  type FocusSessionDto,
  type GoalDto,
  type TaskDto,
  type TaskPriority,
} from "@ember/shared";
import {
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Play,
  Plus,
  Target,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { cn } from "@/lib/utils";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

interface TasksPlannerWorkspaceProps {
  initialTasks: TaskDto[];
  initialGoals: { daily: GoalDto; weekly: GoalDto };
  initialSessions: FocusSessionDto[];
  todayDate: string;
  timezone: string;
}

const TIMELINE_HOURS = Array.from({ length: 18 }, (_, i) => i + 6); // 06:00 to 23:00

function formatHourLabel(hour: number): string {
  const suffix = hour >= 12 ? "PM" : "AM";
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `${String(display).padStart(2, "0")} ${suffix}`;
}

export function TasksPlannerWorkspace({
  initialTasks,
  initialGoals,
  initialSessions,
  todayDate,
  timezone,
}: TasksPlannerWorkspaceProps) {
  const router = useRouter();
  const [tasks, setTasks] = React.useState<TaskDto[]>(initialTasks);
  const [goals, setGoals] = React.useState(initialGoals);
  const [selectedDate, setSelectedDate] = React.useState(todayDate);
  const [statusFilter, setStatusFilter] = React.useState<"all" | "active" | "completed">(
    "all"
  );

  // Create Task form
  const [showCreateForm, setShowCreateForm] = React.useState(false);
  const [title, setTitle] = React.useState("");
  const [category, setCategory] = React.useState("Study");
  const [color, setColor] = React.useState<string>(TASK_COLORS[0]);
  const [priority, setPriority] = React.useState<TaskPriority>("medium");
  const [plannedMinutes, setPlannedMinutes] = React.useState(45);
  const [plannedStartHour, setPlannedStartHour] = React.useState<string>("10");
  const [isSaving, setIsSaving] = React.useState(false);

  // Daily/Weekly Goal Target editing
  const [dailyTargetInput, setDailyTargetInput] = React.useState(
    String(initialGoals.daily.targetMinutes)
  );
  const [weeklyTargetInput, setWeeklyTargetInput] = React.useState(
    String(initialGoals.weekly.targetMinutes)
  );
  const [feedback, setFeedback] = React.useState<string | null>(null);

  const visibleTasks = tasks.filter((t) => {
    const matchesDate = !t.scheduledDate || t.scheduledDate === selectedDate;
    if (!matchesDate) return false;
    if (statusFilter === "completed") return t.status === "completed";
    if (statusFilter === "active") return t.status !== "completed" && t.status !== "archived";
    return t.status !== "archived";
  });

  const plannedTotalForDate = visibleTasks.reduce(
    (sum, task) => sum + task.plannedMinutes,
    0
  );

  const sessionsForSelectedDate = initialSessions.filter(
    (s) =>
      s.localDate === selectedDate &&
      (s.status === "completed" || s.status === "interrupted") &&
      (s.mode === "pomodoro" || s.mode === "custom" || s.mode === "stopwatch")
  );
  const recordedMinutesForDate = Math.round(
    sessionsForSelectedDate.reduce((sum, s) => sum + s.accumulatedSeconds, 0) / 60
  );

  async function handleCreateTask(event: React.FormEvent) {
    event.preventDefault();
    if (!title.trim() || isSaving) return;
    setIsSaving(true);
    setFeedback(null);

    try {
      const startMinute =
        plannedStartHour !== "" ? Number(plannedStartHour) * 60 : null;

      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          category: category.trim() || "Study",
          color,
          priority,
          plannedMinutes: Number(plannedMinutes),
          scheduledDate: selectedDate,
          plannedStartMinute: startMinute,
        }),
      });
      const data = (await res.json()) as { task?: TaskDto; error?: string };
      if (!res.ok || !data.task) {
        setFeedback(data.error ?? "Unable to create task");
        return;
      }

      setTasks((prev) => [data.task!, ...prev]);
      setTitle("");
      setShowCreateForm(false);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleToggleTask(task: TaskDto) {
    const nextStatus = task.status === "completed" ? "todo" : "completed";
    const res = await fetch(`/api/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    });
    if (res.ok) {
      const data = (await res.json()) as { task: TaskDto };
      setTasks((prev) =>
        prev.map((item) =>
          item.id === task.id
            ? { ...data.task, actualMinutes: item.actualMinutes }
            : item
        )
      );
    }
  }

  async function handleDeleteTask(taskId: string) {
    const res = await fetch(`/api/tasks/${taskId}`, { method: "DELETE" });
    if (res.ok) {
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
    }
  }

  async function handleSaveGoals(event: React.FormEvent) {
    event.preventDefault();
    setFeedback(null);

    const [dailyRes, weeklyRes] = await Promise.all([
      fetch("/api/goals", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          periodType: "daily",
          targetMinutes: Number(dailyTargetInput),
        }),
      }),
      fetch("/api/goals", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          periodType: "weekly",
          targetMinutes: Number(weeklyTargetInput),
        }),
      }),
    ]);

    if (dailyRes.ok && weeklyRes.ok) {
      const dailyJson = (await dailyRes.json()) as { goal: GoalDto };
      const weeklyJson = (await weeklyRes.json()) as { goal: GoalDto };
      setGoals({ daily: dailyJson.goal, weekly: weeklyJson.goal });
      setFeedback("Daily and weekly focus goals updated.");
      router.refresh();
    } else {
      setFeedback("Unable to update goals. Check values (15–5000 min).");
    }
  }

  // Group tasks by category (Ref 4 aesthetic)
  const groupedTasks = visibleTasks.reduce<Record<string, TaskDto[]>>((acc, task) => {
    const bucket = acc[task.category] ?? [];
    bucket.push(task);
    acc[task.category] = bucket;
    return acc;
  }, {});

  // Helper to locate recorded sessions in an hour slot in user's timezone
  function getSessionsForHour(hour: number): FocusSessionDto[] {
    return sessionsForSelectedDate.filter((session) => {
      try {
        const dt = new Date(session.startedAt);
        const hStr = new Intl.DateTimeFormat("en-GB", {
          timeZone: timezone,
          hour: "2-digit",
          hour12: false,
        }).format(dt);
        return Number(hStr) === hour;
      } catch {
        return new Date(session.startedAt).getUTCHours() === hour;
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Header + Date Navigator (Ref 4 inspired) */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-[-0.025em] text-text-primary">
            Plans &amp; Tasks
          </h1>
          <p className="text-sm text-text-secondary">
            Organize study blocks and compare planned estimates against recorded focus.
          </p>
        </div>

        <div className="flex items-center justify-between gap-2 sm:justify-end">
          <div className="inline-flex items-center gap-1 rounded-full border border-border-subtle bg-surface px-2 py-1">
            <button
              type="button"
              aria-label="Previous day"
              onClick={() => setSelectedDate(addDaysToDateKey(selectedDate, -1))}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-text-secondary hover:bg-surface-elevated hover:text-text-primary cursor-pointer"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="px-2 text-xs sm:text-sm font-medium tabular-nums">
              {selectedDate}
              {selectedDate === todayDate ? " · Today" : ""}
            </span>
            <button
              type="button"
              aria-label="Next day"
              onClick={() => setSelectedDate(addDaysToDateKey(selectedDate, 1))}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-text-secondary hover:bg-surface-elevated hover:text-text-primary cursor-pointer"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <Button
            type="button"
            variant="ember"
            size="sm"
            onClick={() => setShowCreateForm((v) => !v)}
          >
            <Plus className="h-4 w-4" />
            Add Task
          </Button>
        </div>
      </div>

      {/* Create Task Drawer */}
      {showCreateForm && (
        <Card className="border-flame/30">
          <CardHeader>
            <CardTitle className="text-base">New Study Task</CardTitle>
            <CardDescription>
              Schedule a task on {selectedDate} and optionally assign a timeline hour.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateTask} className="grid gap-4 sm:grid-cols-12">
              <div className="space-y-1.5 sm:col-span-6">
                <Label htmlFor="task-title">Title</Label>
                <Input
                  id="task-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Organic Chemistry Practice Set"
                  required
                />
              </div>
              <div className="space-y-1.5 sm:col-span-3">
                <Label htmlFor="task-category">Category</Label>
                <Input
                  id="task-category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="Study"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-3">
                <Label htmlFor="task-priority">Priority</Label>
                <select
                  id="task-priority"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as TaskPriority)}
                  className="flex h-11 w-full rounded-xl border border-border-subtle bg-surface-elevated px-3 text-sm text-text-primary"
                >
                  {TASK_PRIORITIES.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5 sm:col-span-3">
                <Label htmlFor="task-planned-mins">Planned (min)</Label>
                <Input
                  id="task-planned-mins"
                  type="number"
                  min={5}
                  max={600}
                  value={plannedMinutes}
                  onChange={(e) => setPlannedMinutes(Number(e.target.value))}
                />
              </div>

              <div className="space-y-1.5 sm:col-span-3">
                <Label htmlFor="task-hour">Plan Hour</Label>
                <select
                  id="task-hour"
                  value={plannedStartHour}
                  onChange={(e) => setPlannedStartHour(e.target.value)}
                  className="flex h-11 w-full rounded-xl border border-border-subtle bg-surface-elevated px-3 text-sm text-text-primary"
                >
                  <option value="">Unscheduled</option>
                  {TIMELINE_HOURS.map((hr) => (
                    <option key={hr} value={String(hr)}>
                      {formatHourLabel(hr)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5 sm:col-span-6">
                <Label>Accent Bar Color</Label>
                <div className="flex items-center gap-2 pt-1.5">
                  {TASK_COLORS.map((hex) => (
                    <button
                      key={hex}
                      type="button"
                      aria-label={`Select color ${hex}`}
                      onClick={() => setColor(hex)}
                      className={cn(
                        "h-8 w-8 rounded-full border-2 transition-transform cursor-pointer",
                        color === hex
                          ? "border-white scale-110"
                          : "border-transparent opacity-70 hover:opacity-100"
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
                  onClick={() => setShowCreateForm(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="ember" disabled={isSaving}>
                  Create Task
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Daily & Weekly Targets */}
      <Card>
        <CardContent className="p-4 sm:p-5">
          <form
            onSubmit={handleSaveGoals}
            className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"
          >
            <div className="grid gap-4 sm:grid-cols-2 flex-1">
              <div className="rounded-xl border border-border-subtle bg-surface-elevated/60 p-3.5 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 text-text-secondary">
                    <Target className="h-3.5 w-3.5 text-flame-soft" />
                    Daily Target
                  </span>
                  <span className="font-semibold tabular-nums text-text-primary">
                    {formatMinutesLabel(goals.daily.actualMinutes)} /{" "}
                    {formatMinutesLabel(goals.daily.targetMinutes)}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-canvas overflow-hidden">
                  <div
                    className="h-full rounded-full bg-flame"
                    style={{
                      width: `${Math.min(
                        100,
                        Math.round(
                          (goals.daily.actualMinutes /
                            Math.max(1, goals.daily.targetMinutes)) *
                            100
                        )
                      )}%`,
                    }}
                  />
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <Label htmlFor="daily-goal-input" className="text-[10px]">
                    Target (min)
                  </Label>
                  <Input
                    id="daily-goal-input"
                    type="number"
                    min={15}
                    max={720}
                    value={dailyTargetInput}
                    onChange={(e) => setDailyTargetInput(e.target.value)}
                    className="h-8 w-24 text-xs"
                  />
                </div>
              </div>

              <div className="rounded-xl border border-border-subtle bg-surface-elevated/60 p-3.5 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 text-text-secondary">
                    <Calendar className="h-3.5 w-3.5 text-sky" />
                    Weekly Target
                  </span>
                  <span className="font-semibold tabular-nums text-text-primary">
                    {formatMinutesLabel(goals.weekly.actualMinutes)} /{" "}
                    {formatMinutesLabel(goals.weekly.targetMinutes)}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-canvas overflow-hidden">
                  <div
                    className="h-full rounded-full bg-sky"
                    style={{
                      width: `${Math.min(
                        100,
                        Math.round(
                          (goals.weekly.actualMinutes /
                            Math.max(1, goals.weekly.targetMinutes)) *
                            100
                        )
                      )}%`,
                    }}
                  />
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <Label htmlFor="weekly-goal-input" className="text-[10px]">
                    Target (min)
                  </Label>
                  <Input
                    id="weekly-goal-input"
                    type="number"
                    min={30}
                    max={5000}
                    value={weeklyTargetInput}
                    onChange={(e) => setWeeklyTargetInput(e.target.value)}
                    className="h-8 w-24 text-xs"
                  />
                </div>
              </div>
            </div>

            <Button type="submit" variant="secondary" size="sm">
              Update Targets
            </Button>
          </form>
          {feedback && (
            <p className="mt-2 text-xs text-emerald" role="status">
              {feedback}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Split-pane: Task Checklist (Left) + Plan vs Record Timeline (Right) */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Categorized Task List */}
        <div className="space-y-4 lg:col-span-6">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-text-secondary">
              Tasks ({visibleTasks.length})
            </h2>
            <div className="inline-flex rounded-xl border border-border-subtle bg-surface p-0.5 text-xs">
              {(["all", "active", "completed"] as const).map((filter) => (
                <button
                  key={filter}
                  type="button"
                  onClick={() => setStatusFilter(filter)}
                  className={cn(
                    "rounded-lg px-2.5 py-1 capitalize cursor-pointer",
                    statusFilter === filter
                      ? "bg-surface-elevated text-text-primary font-medium"
                      : "text-text-muted hover:text-text-secondary"
                  )}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>

          {Object.keys(groupedTasks).length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-sm text-text-muted">
                No tasks scheduled for {selectedDate}. Click &ldquo;Add Task&rdquo; to
                plan your focus blocks.
              </CardContent>
            </Card>
          ) : (
            Object.entries(groupedTasks).map(([groupName, groupTasks]) => {
              const completedInGroup = groupTasks.filter(
                (t) => t.status === "completed"
              ).length;
              const pct = Math.round((completedInGroup / groupTasks.length) * 100);
              const totalActual = groupTasks.reduce((s, t) => s + t.actualMinutes, 0);

              return (
                <Card key={groupName}>
                  <CardHeader className="pb-3 flex flex-row items-center justify-between">
                    <CardTitle className="text-sm font-semibold">{groupName}</CardTitle>
                    <div className="flex items-center gap-2 text-xs tabular-nums">
                      <span className="text-sky">{formatMinutesLabel(totalActual)}</span>
                      <span className="text-text-muted">{pct}%</span>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {groupTasks.map((task) => (
                      <div
                        key={task.id}
                        className="flex items-center justify-between gap-3 rounded-xl border border-border-subtle bg-surface-elevated/60 px-3 py-2.5"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <span
                            className="h-7 w-1 shrink-0 rounded-full"
                            style={{ backgroundColor: task.color }}
                          />
                          <button
                            type="button"
                            aria-label={`Toggle ${task.title}`}
                            onClick={() => void handleToggleTask(task)}
                            className={cn(
                              "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors cursor-pointer",
                              task.status === "completed"
                                ? "border-emerald bg-emerald text-canvas"
                                : "border-border-strong bg-canvas hover:border-text-secondary"
                            )}
                          >
                            {task.status === "completed" && (
                              <Check className="h-3.5 w-3.5" />
                            )}
                          </button>
                          <div className="min-w-0">
                            <p
                              className={cn(
                                "truncate text-sm font-medium",
                                task.status === "completed" &&
                                  "line-through text-text-muted"
                              )}
                            >
                              {task.title}
                            </p>
                            <div className="flex items-center gap-2 text-[11px] text-text-muted tabular-nums">
                              <span>Plan {formatMinutesLabel(task.plannedMinutes)}</span>
                              <span>·</span>
                              <span>Actual {formatMinutesLabel(task.actualMinutes)}</span>
                              <Badge variant="neutral" className="text-[10px] py-0 px-1.5">
                                {task.priority}
                              </Badge>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          {task.status !== "completed" && (
                            <Button
                              asChild
                              variant="ghost"
                              size="icon"
                              title="Focus on this task"
                              className="h-8 w-8 text-flame-soft"
                            >
                              <Link href={`/focus?taskId=${task.id}`}>
                                <Play className="h-3.5 w-3.5" />
                              </Link>
                            </Button>
                          )}
                          <button
                            type="button"
                            aria-label={`Delete ${task.title}`}
                            onClick={() => void handleDeleteTask(task.id)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-text-muted hover:bg-surface-hover hover:text-rose cursor-pointer"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>

        {/* Dual-Column Plan vs Record Hourly Timeline (Ref 4 inspired) */}
        <Card className="lg:col-span-6">
          <CardHeader className="pb-3">
            <div className="grid grid-cols-[52px_1fr_1fr] items-end border-b border-border-subtle pb-3 text-center">
              <span className="text-left text-[11px] text-text-muted">
                <Clock className="h-3.5 w-3.5 inline" />
              </span>
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wider text-text-muted">
                  Plan
                </p>
                <p className="text-lg font-semibold text-text-secondary tabular-nums">
                  {formatMinutesLabel(plannedTotalForDate)}
                </p>
              </div>
              <div className="border-l border-border-subtle">
                <p className="text-[11px] font-medium uppercase tracking-wider text-text-muted">
                  Record
                </p>
                <p className="text-lg font-semibold text-text-primary tabular-nums">
                  {formatMinutesLabel(recordedMinutesForDate)}
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="max-h-[520px] overflow-y-auto pr-2">
            <div className="divide-y divide-border-subtle/70">
              {TIMELINE_HOURS.map((hour) => {
                const plannedInHour = visibleTasks.filter(
                  (t) =>
                    t.plannedStartMinute !== null &&
                    Math.floor(t.plannedStartMinute / 60) === hour
                );
                const recordedInHour = getSessionsForHour(hour);

                return (
                  <div
                    key={hour}
                    className="grid grid-cols-[52px_1fr_1fr] min-h-10 items-stretch text-xs"
                  >
                    <div className="py-2 pr-2 text-[11px] text-text-muted tabular-nums">
                      {formatHourLabel(hour)}
                    </div>
                    <div className="border-l border-border-subtle/70 p-1 space-y-1">
                      {plannedInHour.map((t) => (
                        <div
                          key={t.id}
                          className="truncate rounded-md border px-2 py-1 text-[11px] font-medium"
                          style={{
                            borderColor: `${t.color}66`,
                            backgroundColor: `${t.color}1F`,
                            color: "#F4F5F7",
                          }}
                        >
                          {t.title} ({t.plannedMinutes}m)
                        </div>
                      ))}
                    </div>
                    <div className="border-l border-border-subtle/70 p-1 space-y-1">
                      {recordedInHour.map((s) => (
                        <div
                          key={s.id}
                          className="truncate rounded-md border border-emerald/40 bg-emerald/15 px-2 py-1 text-[11px] font-medium text-emerald"
                        >
                          {s.label || s.taskTitle || s.mode} (
                          {Math.max(1, Math.round(s.accumulatedSeconds / 60))}m)
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
