"use client";

import {
  COMPANION_STYLES,
  SOUNDSCAPE_PREFERENCES,
  THEME_OPTIONS,
  type UserPreferencesDto,
} from "@ember/shared";
import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import * as React from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Switch } from "./ui/switch";

interface SettingsPreferencesFormProps {
  initialPreferences: UserPreferencesDto | null;
  disabled?: boolean;
}

export function SettingsPreferencesForm({
  initialPreferences,
  disabled = false,
}: SettingsPreferencesFormProps) {
  const [timezone, setTimezone] = React.useState(
    initialPreferences?.timezone ?? "UTC"
  );
  const [theme, setTheme] = React.useState(
    initialPreferences?.theme ?? "ember-dark"
  );
  const [pomodoroMinutes, setPomodoroMinutes] = React.useState(
    String(initialPreferences?.pomodoroMinutes ?? 25)
  );
  const [shortBreakMinutes, setShortBreakMinutes] = React.useState(
    String(initialPreferences?.shortBreakMinutes ?? 5)
  );
  const [longBreakMinutes, setLongBreakMinutes] = React.useState(
    String(initialPreferences?.longBreakMinutes ?? 15)
  );
  const [dailyFocusGoalMinutes, setDailyFocusGoalMinutes] = React.useState(
    String(initialPreferences?.dailyFocusGoalMinutes ?? 120)
  );
  const [companionStyle, setCompanionStyle] = React.useState(
    initialPreferences?.companionStyle ?? "classic-flame"
  );
  const [soundscapePreference, setSoundscapePreference] = React.useState(
    initialPreferences?.soundscapePreference ?? "none"
  );
  const [extensionTrackingConsent, setExtensionTrackingConsent] = React.useState(
    initialPreferences?.extensionTrackingConsent ?? false
  );
  const [notificationsEnabled, setNotificationsEnabled] = React.useState(
    initialPreferences?.notificationsEnabled ?? true
  );

  const [isSaving, setIsSaving] = React.useState(false);
  const [feedback, setFeedback] = React.useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (disabled || isSaving) return;

    setIsSaving(true);
    setFeedback(null);

    try {
      const response = await fetch("/api/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          timezone: timezone.trim(),
          theme,
          pomodoroMinutes: Number(pomodoroMinutes),
          shortBreakMinutes: Number(shortBreakMinutes),
          longBreakMinutes: Number(longBreakMinutes),
          dailyFocusGoalMinutes: Number(dailyFocusGoalMinutes),
          companionStyle,
          soundscapePreference,
          extensionTrackingConsent,
          notificationsEnabled,
        }),
      });

      const data = (await response.json()) as {
        error?: string;
        issues?: Array<{ field: string; message: string }>;
      };

      if (!response.ok) {
        const firstIssue = data.issues?.[0]?.message;
        setFeedback({
          type: "error",
          message: firstIssue ?? data.error ?? "Unable to save preferences",
        });
        return;
      }

      setFeedback({
        type: "success",
        message: "Preferences saved to your Ember profile.",
      });
    } catch {
      setFeedback({
        type: "error",
        message: "Network error while saving preferences.",
      });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="timezone">IANA Timezone</Label>
          <Input
            id="timezone"
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            placeholder="UTC or Asia/Kolkata"
            disabled={disabled || isSaving}
          />
          <p className="text-xs text-text-muted">
            Used for local daily goals and habit calendar boundaries.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="dailyFocusGoalMinutes">Daily Focus Goal (minutes)</Label>
          <Input
            id="dailyFocusGoalMinutes"
            type="number"
            min={15}
            max={720}
            value={dailyFocusGoalMinutes}
            onChange={(e) => setDailyFocusGoalMinutes(e.target.value)}
            disabled={disabled || isSaving}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="pomodoroMinutes">Pomodoro Duration (minutes)</Label>
          <Input
            id="pomodoroMinutes"
            type="number"
            min={5}
            max={120}
            value={pomodoroMinutes}
            onChange={(e) => setPomodoroMinutes(e.target.value)}
            disabled={disabled || isSaving}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="shortBreakMinutes">Short Break (minutes)</Label>
          <Input
            id="shortBreakMinutes"
            type="number"
            min={1}
            max={30}
            value={shortBreakMinutes}
            onChange={(e) => setShortBreakMinutes(e.target.value)}
            disabled={disabled || isSaving}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="longBreakMinutes">Long Break (minutes)</Label>
          <Input
            id="longBreakMinutes"
            type="number"
            min={5}
            max={60}
            value={longBreakMinutes}
            onChange={(e) => setLongBreakMinutes(e.target.value)}
            disabled={disabled || isSaving}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="theme">Theme Variant</Label>
          <select
            id="theme"
            value={theme}
            onChange={(e) => setTheme(e.target.value as typeof theme)}
            disabled={disabled || isSaving}
            className="flex h-11 w-full rounded-xl border border-border-subtle bg-surface-elevated px-3.5 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-flame/60"
          >
            {THEME_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="companionStyle">Flame Companion Style</Label>
          <select
            id="companionStyle"
            value={companionStyle}
            onChange={(e) => setCompanionStyle(e.target.value as typeof companionStyle)}
            disabled={disabled || isSaving}
            className="flex h-11 w-full rounded-xl border border-border-subtle bg-surface-elevated px-3.5 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-flame/60"
          >
            {COMPANION_STYLES.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="soundscapePreference">Soundscape Preference</Label>
          <select
            id="soundscapePreference"
            value={soundscapePreference}
            onChange={(e) =>
              setSoundscapePreference(e.target.value as typeof soundscapePreference)
            }
            disabled={disabled || isSaving}
            className="flex h-11 w-full rounded-xl border border-border-subtle bg-surface-elevated px-3.5 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-flame/60"
          >
            {SOUNDSCAPE_PREFERENCES.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-3 rounded-2xl border border-border-subtle bg-surface-elevated/50 p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-text-primary">
              Extension Sync Consent (Opt-In)
            </p>
            <p className="text-xs text-text-secondary">
              Allows future Chrome extension pairing to sync aggregated hostname-only usage summaries.
            </p>
          </div>
          <Switch
            aria-label="Extension Sync Consent"
            checked={extensionTrackingConsent}
            onCheckedChange={setExtensionTrackingConsent}
            disabled={disabled || isSaving}
          />
        </div>

        <div className="border-t border-border-subtle pt-3 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-text-primary">
              Session Notifications
            </p>
            <p className="text-xs text-text-secondary">
              Notify cleanly when a focus or break block completes.
            </p>
          </div>
          <Switch
            aria-label="Session Notifications"
            checked={notificationsEnabled}
            onCheckedChange={setNotificationsEnabled}
            disabled={disabled || isSaving}
          />
        </div>
      </div>

      {feedback && (
        <div
          role="status"
          className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-sm ${
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

      <div className="flex items-center justify-end gap-3">
        <Button
          type="submit"
          variant="ember"
          disabled={disabled || isSaving}
          className="w-full sm:w-auto"
        >
          {isSaving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            "Save preferences"
          )}
        </Button>
      </div>
    </form>
  );
}
