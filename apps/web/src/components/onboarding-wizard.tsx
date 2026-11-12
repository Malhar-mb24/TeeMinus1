"use client";

import {
  COMPANION_STYLES,
  SOUNDSCAPE_PREFERENCES,
  THEME_OPTIONS,
  type CompanionStyle,
  type SoundscapePreference,
  type ThemeOption,
} from "@ember/shared";
import { ArrowRight, CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
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
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Switch } from "./ui/switch";

interface OnboardingWizardProps {
  initialTimezone: string;
  initialDailyGoal: number;
  initialPomodoro: number;
  initialShortBreak: number;
  initialLongBreak: number;
}

export function OnboardingWizard({
  initialTimezone,
  initialDailyGoal,
  initialPomodoro,
  initialShortBreak,
  initialLongBreak,
}: OnboardingWizardProps) {
  const router = useRouter();
  const [timezone, setTimezone] = React.useState(initialTimezone);
  const [pomodoroMinutes, setPomodoroMinutes] = React.useState(initialPomodoro);
  const [shortBreakMinutes, setShortBreakMinutes] = React.useState(initialShortBreak);
  const [longBreakMinutes, setLongBreakMinutes] = React.useState(initialLongBreak);
  const [dailyFocusGoalMinutes, setDailyFocusGoalMinutes] =
    React.useState(initialDailyGoal);
  const [theme, setTheme] = React.useState<ThemeOption>("ember-dark");
  const [companionStyle, setCompanionStyle] =
    React.useState<CompanionStyle>("classic-flame");
  const [soundscapePreference, setSoundscapePreference] =
    React.useState<SoundscapePreference>("none");
  const [extensionTrackingConsent, setExtensionTrackingConsent] = React.useState(false);

  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    try {
      const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (detected && initialTimezone === "UTC") {
        setTimezone(detected);
      }
    } catch {
      // keep initial timezone
    }
  }, [initialTimezone]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          timezone: timezone.trim(),
          pomodoroMinutes: Number(pomodoroMinutes),
          shortBreakMinutes: Number(shortBreakMinutes),
          longBreakMinutes: Number(longBreakMinutes),
          dailyFocusGoalMinutes: Number(dailyFocusGoalMinutes),
          theme,
          companionStyle,
          soundscapePreference,
          extensionTrackingConsent,
        }),
      });

      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Unable to save onboarding preferences");
        setIsSubmitting(false);
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Network error while finishing onboarding");
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <Badge variant="flame">First-Time Setup</Badge>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Tailor Ember to your study rhythm
        </h1>
        <p className="text-sm text-text-secondary">
          Your timer defaults, local calendar timezone, and privacy preferences save
          directly to your profile and can be changed anytime in Settings.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Focus Preferences */}
        <Card className="lg:col-span-7">
          <CardHeader>
            <CardTitle>1. Timer &amp; Daily Focus Target</CardTitle>
            <CardDescription>
              Choose comfortable defaults for focus blocks and daily goals.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="onboard-tz">Local Timezone (IANA)</Label>
              <Input
                id="onboard-tz"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                placeholder="Asia/Kolkata"
              />
            </div>

            <div className="space-y-2">
              <Label>Daily Focus Goal</Label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[60, 120, 180, 240].map((mins) => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => setDailyFocusGoalMinutes(mins)}
                    className={`rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors cursor-pointer ${
                      dailyFocusGoalMinutes === mins
                        ? "border-flame bg-flame/15 text-flame-soft"
                        : "border-border-subtle bg-surface-elevated text-text-secondary hover:text-text-primary"
                    }`}
                  >
                    {mins / 60}h ({mins}m)
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="onboard-pomo">Focus (min)</Label>
                <Input
                  id="onboard-pomo"
                  type="number"
                  min={5}
                  max={120}
                  value={pomodoroMinutes}
                  onChange={(e) => setPomodoroMinutes(Number(e.target.value))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="onboard-short">Short Break</Label>
                <Input
                  id="onboard-short"
                  type="number"
                  min={1}
                  max={30}
                  value={shortBreakMinutes}
                  onChange={(e) => setShortBreakMinutes(Number(e.target.value))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="onboard-long">Long Break</Label>
                <Input
                  id="onboard-long"
                  type="number"
                  min={5}
                  max={60}
                  value={longBreakMinutes}
                  onChange={(e) => setLongBreakMinutes(Number(e.target.value))}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Companion & Theme */}
        <Card className="lg:col-span-5">
          <CardHeader>
            <CardTitle>2. Companion &amp; Soundscape</CardTitle>
            <CardDescription>
              A calm 2D companion that celebrates consistency without shaming missed days.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="rounded-2xl border border-border-subtle bg-surface-elevated/60 p-4">
              <FlameCompanion
                mood="happy"
                styleVariant={companionStyle}
                size="md"
                level={1}
                message="Excited to build steady focus habits together."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="onboard-companion">Companion Style</Label>
              <select
                id="onboard-companion"
                value={companionStyle}
                onChange={(e) => setCompanionStyle(e.target.value as CompanionStyle)}
                className="flex h-11 w-full rounded-xl border border-border-subtle bg-surface-elevated px-3.5 text-sm text-text-primary"
              >
                {COMPANION_STYLES.map((style) => (
                  <option key={style} value={style}>
                    {style}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="onboard-theme">Theme</Label>
                <select
                  id="onboard-theme"
                  value={theme}
                  onChange={(e) => setTheme(e.target.value as ThemeOption)}
                  className="flex h-11 w-full rounded-xl border border-border-subtle bg-surface-elevated px-3 text-sm text-text-primary"
                >
                  {THEME_OPTIONS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="onboard-sound">Soundscape</Label>
                <select
                  id="onboard-sound"
                  value={soundscapePreference}
                  onChange={(e) =>
                    setSoundscapePreference(e.target.value as SoundscapePreference)
                  }
                  className="flex h-11 w-full rounded-xl border border-border-subtle bg-surface-elevated px-3 text-sm text-text-primary"
                >
                  {SOUNDSCAPE_PREFERENCES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Explicit Privacy & Extension Tracking Consent */}
      <Card>
        <CardContent className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-text-primary">
                3. Digital Wellbeing Privacy Consent (Optional)
              </p>
              <p className="text-xs text-text-secondary leading-relaxed">
                When the Chrome extension launches, Ember aggregates active, non-idle
                website hostnames locally by default—never page content, passwords, or
                incognito tabs. Opt in now only if you plan to sync summarized daily
                hostname stats to your account.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <span className="text-xs text-text-secondary">
              {extensionTrackingConsent ? "Opted in" : "Keep local only"}
            </span>
            <Switch
              aria-label="Extension tracking consent"
              checked={extensionTrackingConsent}
              onCheckedChange={setExtensionTrackingConsent}
            />
          </div>
        </CardContent>
      </Card>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-rose/30 bg-rose/10 px-4 py-3 text-sm text-rose"
        >
          {error}
        </div>
      )}

      <div className="flex justify-end">
        <Button type="submit" variant="ember" size="lg" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving workspace...
            </>
          ) : (
            <>
              <CheckCircle2 className="h-4 w-4" />
              Complete setup &amp; open Dashboard
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
