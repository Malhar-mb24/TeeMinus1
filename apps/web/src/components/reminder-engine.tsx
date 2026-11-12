"use client";

import {
  evaluateDueReminders,
  type DueReminderCandidate,
  type ReminderSettingsDto,
} from "@ember/shared";
import { Bell, X } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { Button } from "./ui/button";

interface ReminderApiResponse {
  settings: ReminderSettingsDto;
  context: {
    timezone: string;
    todayDate: string;
    todayFocusMinutes: number;
    dailyFocusGoalMinutes: number;
    incompleteHabitsTodayCount: number;
    isFocusRunning?: boolean;
    activeFocusMinutesElapsed?: number;
  };
}

function getLocalHmInTimezone(date: Date, timezone: string): string {
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(date);
    const hour = parts.find((p) => p.type === "hour")?.value ?? "12";
    const minute = parts.find((p) => p.type === "minute")?.value ?? "00";
    const normalizedHour = hour === "24" ? "00" : hour;
    return `${normalizedHour}:${minute}`;
  } catch {
    return "12:00";
  }
}

function readSentIds(todayDate: string): Set<string> {
  try {
    const raw = window.localStorage.getItem(`ember:reminders-sent:${todayDate}`);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as unknown;
    if (Array.isArray(arr)) {
      return new Set(arr.filter((v): v is string => typeof v === "string"));
    }
  } catch {
    // Storage unavailable
  }
  return new Set();
}

function recordSentId(todayDate: string, id: string): void {
  try {
    const existing = readSentIds(todayDate);
    existing.add(id);
    window.localStorage.setItem(
      `ember:reminders-sent:${todayDate}`,
      JSON.stringify(Array.from(existing))
    );
  } catch {
    // Ignore storage errors
  }
}

export function dispatchBrowserOrInAppReminder(
  reminder: DueReminderCandidate,
  onInAppFallback: (reminder: DueReminderCandidate) => void
): "browser" | "in_app" {
  if (
    typeof window !== "undefined" &&
    "Notification" in window &&
    window.Notification.permission === "granted"
  ) {
    try {
      new window.Notification(reminder.title, {
        body: reminder.body,
        tag: `ember-reminder-${reminder.id}`,
      });
      onInAppFallback(reminder);
      return "browser";
    } catch {
      // Fallback safely to in-app toast
    }
  }

  onInAppFallback(reminder);
  return "in_app";
}

export function ReminderEngine() {
  const [activeToasts, setActiveToasts] = React.useState<DueReminderCandidate[]>([]);

  const checkDueReminders = React.useCallback(async () => {
    try {
      const res = await fetch("/api/reminders", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as ReminderApiResponse;
      if (!data?.settings?.notificationsEnabled) return;

      const sent = readSentIds(data.context.todayDate);
      const currentHm = getLocalHmInTimezone(new Date(), data.context.timezone);

      const due = evaluateDueReminders({
        settings: data.settings,
        currentHm,
        activeFocusMinutesElapsed: data.context.activeFocusMinutesElapsed ?? 0,
        isFocusRunning: Boolean(data.context.isFocusRunning),
        todayFocusMinutes: data.context.todayFocusMinutes,
        dailyFocusGoalMinutes: data.context.dailyFocusGoalMinutes,
        incompleteHabitsTodayCount: data.context.incompleteHabitsTodayCount,
        alreadySentIds: sent,
      });

      for (const candidate of due) {
        recordSentId(data.context.todayDate, candidate.id);
        dispatchBrowserOrInAppReminder(candidate, (item) => {
          setActiveToasts((prev) =>
            prev.some((existing) => existing.id === item.id) ? prev : [...prev, item]
          );
        });
      }
    } catch {
      // Non-blocking reminder poll
    }
  }, []);

  React.useEffect(() => {
    void checkDueReminders();
    const intervalId = window.setInterval(() => {
      void checkDueReminders();
    }, 60_000);

    const onSettingsUpdated = () => {
      void checkDueReminders();
    };
    const onTestReminder = (event: Event) => {
      const custom = event as CustomEvent<DueReminderCandidate>;
      if (custom.detail) {
        setActiveToasts((prev) => [
          ...prev.filter((t) => t.id !== custom.detail.id),
          custom.detail,
        ]);
      }
    };

    window.addEventListener("ember-reminders-updated", onSettingsUpdated);
    window.addEventListener("ember-test-reminder", onTestReminder);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("ember-reminders-updated", onSettingsUpdated);
      window.removeEventListener("ember-test-reminder", onTestReminder);
    };
  }, [checkDueReminders]);

  if (activeToasts.length === 0) {
    return null;
  }

  return (
    <div
      aria-live="polite"
      className="fixed bottom-20 right-4 z-50 flex max-w-sm flex-col gap-2 md:bottom-6"
    >
      {activeToasts.map((toast) => (
        <div
          key={toast.id}
          role="status"
          className="flex items-start gap-3 rounded-2xl border border-flame/35 bg-surface/95 p-3.5 shadow-xl backdrop-blur-md"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-flame/15 text-flame-soft">
            <Bell className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-xs font-semibold text-text-primary">{toast.title}</p>
            <p className="text-xs text-text-secondary leading-snug">{toast.body}</p>
            <div className="pt-1">
              <Button asChild size="sm" variant="secondary" className="h-7 px-2.5 text-[11px]">
                <Link href={toast.href}>Open</Link>
              </Button>
            </div>
          </div>
          <button
            type="button"
            aria-label="Dismiss reminder"
            onClick={() =>
              setActiveToasts((prev) => prev.filter((item) => item.id !== toast.id))
            }
            className="rounded-lg p-1 text-text-muted hover:bg-surface-elevated hover:text-text-primary cursor-pointer"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
