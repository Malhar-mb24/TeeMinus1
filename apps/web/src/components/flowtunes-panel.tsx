"use client";

import {
  FLOWTUNES_OFFICIAL_URL,
  SOUNDSCAPE_PREFERENCES,
  type SoundscapePreference,
} from "@ember/shared";
import { AlertCircle, ExternalLink, Headphones, PanelTopOpen } from "lucide-react";
import * as React from "react";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Label } from "./ui/label";

interface FlowTunesPanelProps {
  soundscape: SoundscapePreference;
  onSoundscapeChange: (next: SoundscapePreference) => void;
  sessionActive?: boolean;
}

const PRESET_HINTS: Record<SoundscapePreference, string> = {
  none: "Silent focus session",
  rain: "Suggested FlowTunes ambience: Soft Rain",
  lofi: "Suggested FlowTunes ambience: Lo-Fi Beats",
  cafe: "Suggested FlowTunes ambience: Cozy Cafe",
  "white-noise": "Suggested FlowTunes ambience: White / Brown Noise",
};

export function FlowTunesPanel({
  soundscape,
  onSoundscapeChange,
  sessionActive = false,
}: FlowTunesPanelProps) {
  const [showEmbed, setShowEmbed] = React.useState(false);
  const [embedStatus, setEmbedStatus] = React.useState<"idle" | "loading" | "ready" | "error">(
    "idle"
  );
  const [savingPreset, setSavingPreset] = React.useState(false);

  React.useEffect(() => {
    if (!showEmbed) {
      setEmbedStatus("idle");
      return;
    }
    setEmbedStatus("loading");
    const timer = window.setTimeout(() => {
      setEmbedStatus((prev) => (prev === "loading" ? "error" : prev));
    }, 8000);
    return () => window.clearTimeout(timer);
  }, [showEmbed]);

  async function handlePresetChange(next: SoundscapePreference) {
    onSoundscapeChange(next);
    setSavingPreset(true);
    try {
      await fetch("/api/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ soundscapePreference: next }),
      });
    } catch {
      // Non-blocking preset sync; session still keeps chosen value locally
    } finally {
      setSavingPreset(false);
    }
  }

  return (
    <div className="space-y-3 rounded-xl border border-border-subtle bg-surface-elevated/45 p-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Headphones className="h-4 w-4 text-flame-soft" />
          <span className="text-sm font-medium text-text-primary">
            FlowTunes Soundspace
          </span>
        </div>
        <Badge variant="neutral" className="text-[10px]">
          {savingPreset ? "Saving..." : "Official Link"}
        </Badge>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="focus-soundscape">Session Ambience Preset</Label>
        <select
          id="focus-soundscape"
          value={soundscape}
          onChange={(e) => void handlePresetChange(e.target.value as SoundscapePreference)}
          className="flex h-10 w-full rounded-xl border border-border-subtle bg-surface-elevated px-3 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-flame/60"
        >
          {SOUNDSCAPE_PREFERENCES.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
        <p className="text-[11px] text-text-muted">{PRESET_HINTS[soundscape]}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button asChild variant="secondary" size="sm" className="flex-1">
          <a
            href={FLOWTUNES_OFFICIAL_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            <ExternalLink className="h-3.5 w-3.5 text-flame-soft" />
            Open FlowTunes Tab
          </a>
        </Button>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setShowEmbed((prev) => !prev)}
          aria-expanded={showEmbed}
        >
          <PanelTopOpen className="h-3.5 w-3.5" />
          {showEmbed ? "Hide Panel" : "Try In-Page"}
        </Button>
      </div>

      {showEmbed && (
        <div className="space-y-2 pt-1">
          {embedStatus === "error" ? (
            <div className="flex items-start gap-2 rounded-xl border border-amber/30 bg-amber/10 p-3 text-xs text-text-secondary">
              <AlertCircle className="h-4 w-4 shrink-0 text-amber mt-0.5" />
              <div>
                <p className="font-medium text-text-primary">
                  In-page FlowTunes preview unavailable
                </p>
                <p className="mt-0.5">
                  Browser privacy shields or third-party frame restrictions can prevent embedded
                  audio playback. Use{" "}
                  <a
                    href={FLOWTUNES_OFFICIAL_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline text-flame-soft"
                  >
                    Open FlowTunes Tab
                  </a>{" "}
                  for uninterrupted playback.
                </p>
              </div>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-border-subtle bg-charcoal">
              <iframe
                src={FLOWTUNES_OFFICIAL_URL}
                title="FlowTunes ambient focus audio"
                sandbox="allow-scripts allow-same-origin allow-popups"
                allow="autoplay"
                loading="lazy"
                onLoad={() => setEmbedStatus("ready")}
                onError={() => setEmbedStatus("error")}
                className="h-60 w-full border-0"
              />
            </div>
          )}
          <p className="text-[11px] text-text-muted leading-snug">
            FlowTunes does not provide a public playback-control SDK; playback and volume are
            controlled inside FlowTunes directly.{" "}
            {sessionActive ? "Your focus timer continues running accurately in this tab." : ""}
          </p>
        </div>
      )}
    </div>
  );
}
