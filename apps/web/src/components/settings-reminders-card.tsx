"use client";

import type { ReminderSettingsDto } from "@ember/shared";
import { AlertCircle, Bell, BellOff, CheckCircle2, Loader2 } from "lucide-react";
import * as React from "react";
import { dispatchBrowserOrInAppReminder } from "./reminder-engine";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Switch } from "./ui/switch";

interface SettingsRemindersCardProps {
  initialSettings: ReminderSettingsDto;
  disabled?: boolean;
}

type BrowserPermissionState = NotificationPermission | "unsupported";

export function SettingsRemindersCard({
  initialSettings,
  disabled = false,
}: SettingsRemindersCardProps) {
  const [settings, setSettings] = React.useState<ReminderSettingsDto>(initialSettings);
  const [permission, setPermission] = React.useState<BrowserPermissionState>("default");
  const [isSaving, setIsSaving] = React.useState(false);
  const [feedback, setFeedback] = React.useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  React.useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setPermission("unsupported");
      return;
    }
    setPermission(window.Notification.permission);
  }, []);

  async function handleRequestPermission() {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setPermission("unsupported");
      return;
    }
    try {
      const result = await window.Notification.requestPermission();
      setPermission(result);
      setFeedback({
        type: result === "granted" ? "success" : "error",
        message:
          result === "granted"
            ? "Browser notifications granted."
            : "Browser notifications remain disabled; Ember will use clean in-app reminders instead.",
      });
    } catch {
      setPermission("denied");
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (disabled || isSaving) return;
    setIsSaving(true);
    setFeedback(null);

    try {
      const res = await fetch("/api/reminders", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notificationsEnabled: settings.notificationsEnabled,
          focusReminderEnabled: settings.focusReminderEnabled,
          focusReminderTime: settings.focusReminderTime,
          breakReminderEnabled: settings.breakReminderEnabled,
          breakIntervalMinutes: settings.breakIntervalMinutes,
          dailyGoalReminderEnabled: settings.dailyGoalReminderEnabled,
          dailyGoalReminderTime: settings.dailyGoalReminderTime,
          habitReminderEnabled: settings.habitReminderEnabled,
          habitReminderTime: settings.habitReminderTime,
          quietHoursEnabled: settings.quietHoursEnabled,
          quietHoursStart: settings.quietHoursStart,
          quietHoursEnd: settings.quietHoursEnd,
        }),
      });

      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        settings?: ReminderSettingsDto;
        issues?: Array<{ message: string }>;
      };

      if (!res.ok || !data.settings) {
        setFeedback({
          type: "error",
          message: data.issues?.[0]?.message ?? data.error ?? "Unable to save reminders.",
        });
        return;
      }

      setSettings(data.settings);
      window.dispatchEvent(new Event("ember-reminders-updated"));
      setFeedback({
        type: "success",
        message: "Reminder schedule & quiet hours saved.",
      });
    } finally {
      setIsSaving(false);
    }
  }

  function handleSendTest() {
    if (!settings.notificationsEnabled) {
      setFeedback({
        type: "error",
        message: "Enable Reminders & Notifications consent toggle first before testing.",
      });
      return;
    }
    const candidate = {
      id: "focus" as const,
      title: "Ember test reminder",
      body:
        permission === "granted"
          ? "Browser notification permission is active, with in-app toast fallback."
          : "Using clean in-app toast fallback (browser alerts not granted).",
      href: "/focus",
    };

    const mode = dispatchBrowserOrInAppReminder(candidate, (item) => {
      window.dispatchEvent(new CustomEvent("ember-test-reminder", { detail: item }));
    });
    setFeedback({
      type: "success",
      message:
        mode === "browser"
          ? "Sent browser + in-app test reminder."
          : "Sent in-app fallback test reminder.",
    });
  }

  return (
    <form onSubmit={handleSave} className="space-y-5">
      {/* Consent & Browser Permission Header */}
      <div className="rounded-2xl border border-border-subtle bg-surface-elevated/50 p-4 space-y-3">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              {settings.notificationsEnabled ? (
                <Bell className="h-4 w-4 text-flame-soft" />
              ) : (
                <BellOff className="h-4 w-4 text-text-muted" />
              )}
              <span className="text-sm font-medium text-text-primary">
                Enable Reminders &amp; Notifications
              </span>
            </div>
            <p className="text-xs text-text-secondary">
              Required consent before any focus, break, goal, or habit notification is shown.
            </p>
          </div>
          <Switch
            aria-label="Enable Reminders Consent"
            checked={settings.notificationsEnabled}
            onCheckedChange={(checked) =>
              setSettings((prev) => ({ ...prev, notificationsEnabled: checked }))
            }
            disabled={disabled || isSaving}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border-subtle pt-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-text-secondary">Browser alerts:</span>
            <Badge
              variant={
                permission === "granted"
                  ? "emerald"
                  : permission === "denied"
                    ? "rose"
                    : "neutral"
              }
            >
              {permission === "unsupported" ? "In-App Only" : permission}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            {permission !== "granted" && permission !== "unsupported" && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void handleRequestPermission()}
              >
                Allow Browser Alerts
              </Button>
            )}
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleSendTest}
              disabled={disabled}
            >
              Send Test
            </Button>
          </div>
        </div>
      </div>

      {/* Individual Schedules */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-border-subtle bg-surface-elevated/40 p-3.5 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="rem-focus-time">Focus Session Start</Label>
            <Switch
              aria-label="Focus session reminder"
              checked={settings.focusReminderEnabled}
              onCheckedChange={(checked) =>
                setSettings((prev) => ({ ...prev, focusReminderEnabled: checked }))
              }
              disabled={disabled || isSaving}
            />
          </div>
          <Input
            id="rem-focus-time"
            type="time"
            value={settings.focusReminderTime}
            onChange={(e) =>
              setSettings((prev) => ({ ...prev, focusReminderTime: e.target.value }))
            }
            disabled={disabled || isSaving || !settings.focusReminderEnabled}
          />
        </div>

        <div className="rounded-xl border border-border-subtle bg-surface-elevated/40 p-3.5 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="rem-break-min">Break Reminder (min)</Label>
            <Switch
              aria-label="Break interval reminder"
              checked={settings.breakReminderEnabled}
              onCheckedChange={(checked) =>
                setSettings((prev) => ({ ...prev, breakReminderEnabled: checked }))
              }
              disabled={disabled || isSaving}
            />
          </div>
          <Input
            id="rem-break-min"
            type="number"
            min={10}
            max={180}
            value={settings.breakIntervalMinutes}
            onChange={(e) =>
              setSettings((prev) => ({
                ...prev,
                breakIntervalMinutes: Number(e.target.value) || 50,
              }))
            }
            disabled={disabled || isSaving || !settings.breakReminderEnabled}
          />
        </div>

        <div className="rounded-xl border border-border-subtle bg-surface-elevated/40 p-3.5 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="rem-goal-time">Daily Goal Check-In</Label>
            <Switch
              aria-label="Daily goal reminder"
              checked={settings.dailyGoalReminderEnabled}
              onCheckedChange={(checked) =>
                setSettings((prev) => ({ ...prev, dailyGoalReminderEnabled: checked }))
              }
              disabled={disabled || isSaving}
            />
          </div>
          <Input
            id="rem-goal-time"
            type="time"
            value={settings.dailyGoalReminderTime}
            onChange={(e) =>
              setSettings((prev) => ({ ...prev, dailyGoalReminderTime: e.target.value }))
            }
            disabled={disabled || isSaving || !settings.dailyGoalReminderEnabled}
          />
        </div>

        <div className="rounded-xl border border-border-subtle bg-surface-elevated/40 p-3.5 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="rem-habit-time">Habit Check-In</Label>
            <Switch
              aria-label="Habit reminder"
              checked={settings.habitReminderEnabled}
              onCheckedChange={(checked) =>
                setSettings((prev) => ({ ...prev, habitReminderEnabled: checked }))
              }
              disabled={disabled || isSaving}
            />
          </div>
          <Input
            id="rem-habit-time"
            type="time"
            value={settings.habitReminderTime}
            onChange={(e) =>
              setSettings((prev) => ({ ...prev, habitReminderTime: e.target.value }))
            }
            disabled={disabled || isSaving || !settings.habitReminderEnabled}
          />
        </div>
      </div>

      {/* Quiet Hours */}
      <div className="rounded-xl border border-border-subtle bg-surface-elevated/40 p-4 space-y-3">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-text-primary">Quiet Hours</p>
            <p className="text-xs text-text-secondary">
              Suppresses scheduled reminders cleanly overnight or during deep rest windows.
            </p>
          </div>
          <Switch
            aria-label="Quiet hours"
            checked={settings.quietHoursEnabled}
            onCheckedChange={(checked) =>
              setSettings((prev) => ({ ...prev, quietHoursEnabled: checked }))
            }
            disabled={disabled || isSaving}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="quiet-start" className="text-xs">
              Start
            </Label>
            <Input
              id="quiet-start"
              type="time"
              value={settings.quietHoursStart}
              onChange={(e) =>
                setSettings((prev) => ({ ...prev, quietHoursStart: e.target.value }))
              }
              disabled={disabled || isSaving || !settings.quietHoursEnabled}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="quiet-end" className="text-xs">
              End
            </Label>
            <Input
              id="quiet-end"
              type="time"
              value={settings.quietHoursEnd}
              onChange={(e) =>
                setSettings((prev) => ({ ...prev, quietHoursEnd: e.target.value }))
              }
              disabled={disabled || isSaving || !settings.quietHoursEnabled}
            />
          </div>
        </div>
      </div>

      {feedback && (
        <div
          role="status"
          className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-xs ${
            feedback.type === "success"
              ? "border-emerald/30 bg-emerald/10 text-emerald"
              : "border-rose/30 bg-rose/10 text-rose"
          }`}
        >
          {feedback.type === "success" ? (
            <CheckCircle2 className="h-4 w-4 shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      <div className="flex justify-end">
        <Button type="submit" variant="primary" disabled={disabled || isSaving}>
          {isSaving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            "Save Reminder Schedule"
          )}
        </Button>
      </div>
    </form>
  );
}
