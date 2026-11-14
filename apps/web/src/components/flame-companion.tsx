"use client";

import type { CompanionMood, CompanionStyle } from "@ember/shared";
import * as React from "react";
import { cn } from "@/lib/utils";

interface FlameCompanionProps {
  mood?: CompanionMood;
  styleVariant?: CompanionStyle;
  size?: "sm" | "md" | "lg";
  message?: string;
  level?: number;
  className?: string;
}

const STYLE_PALETTES: Record<
  CompanionStyle,
  { outerTop: string; outerMid: string; outerBottom: string; core: string; glow: string }
> = {
  "classic-flame": {
    outerTop: "#FFB45C",
    outerMid: "#F36B2B",
    outerBottom: "#B94716",
    core: "#FFF3E7",
    glow: "rgba(243, 107, 43, 0.38)",
  },
  "ember-spark": {
    outerTop: "#FFD166",
    outerMid: "#FF884D",
    outerBottom: "#D9381E",
    core: "#FFFBF0",
    glow: "rgba(255, 136, 77, 0.4)",
  },
  "calm-hearth": {
    outerTop: "#7DD3FC",
    outerMid: "#38BDF8",
    outerBottom: "#F36B2B",
    core: "#F0F9FF",
    glow: "rgba(56, 189, 248, 0.3)",
  },
};

const MOOD_DEFAULTS: Record<CompanionMood, string> = {
  idle: "Ready whenever you want to begin a quiet block.",
  happy: "Steady progress today. Keep the pace comfortable.",
  excited: "Locked in together. One step at a time.",
  sleepy: "Winding down softly. Rest counts too.",
  celebration: "Milestone reached. Nice consistency today!",
};

export function FlameCompanion({
  mood = "idle",
  styleVariant = "classic-flame",
  size = "md",
  message,
  level,
  className,
}: FlameCompanionProps) {
  const gradId = React.useId();
  const palette = STYLE_PALETTES[styleVariant] ?? STYLE_PALETTES["classic-flame"];
  const dimensions =
    size === "sm" ? "h-12 w-12" : size === "lg" ? "h-24 w-24" : "h-16 w-16";

  const animClass =
    mood === "celebration"
      ? "animate-ember-celebrate"
      : mood === "excited"
        ? "animate-ember-excited"
        : mood === "happy"
          ? "animate-ember-happy"
          : mood === "sleepy"
            ? "animate-ember-sleepy"
            : "animate-ember-idle";

  const displayMessage = message ?? MOOD_DEFAULTS[mood];

  return (
    <div className={cn("flex items-center gap-4", className)}>
      <div
        className={cn(
          "relative flex shrink-0 items-center justify-center rounded-2xl border border-flame/20 bg-[radial-gradient(circle_at_50%_68%,rgba(249,115,22,0.16),rgba(24,20,17,0.92))] p-1.5 shadow-[inset_0_1px_0_0_rgba(255,244,230,0.06)]",
          dimensions
        )}
        style={{ boxShadow: `0 8px 24px -12px ${palette.glow}` }}
        aria-label={`Ember companion feeling ${mood}`}
      >
        <svg
          viewBox="0 0 64 64"
          className={cn("h-full w-full overflow-visible", animClass)}
          role="img"
          aria-hidden="true"
        >
          <defs>
            <linearGradient
              id={gradId}
              x1="32"
              y1="6"
              x2="32"
              y2="56"
              gradientUnits="userSpaceOnUse"
            >
              <stop offset="0%" stopColor={palette.outerTop} />
              <stop offset="55%" stopColor={palette.outerMid} />
              <stop offset="100%" stopColor={palette.outerBottom} />
            </linearGradient>
          </defs>

          {/* Subtle rising sparks during excited/celebration */}
          {(mood === "excited" || mood === "celebration") && (
            <>
              <circle
                cx="18"
                cy="18"
                r="2"
                fill={palette.outerTop}
                className="animate-ember-spark"
              />
              <circle
                cx="47"
                cy="16"
                r="1.7"
                fill={palette.core}
                className="animate-ember-spark"
                style={{ animationDelay: "0.7s" }}
              />
            </>
          )}

          {/* Soft ground shadow */}
          <ellipse cx="32" cy="56" rx="14" ry="3" fill="rgba(0,0,0,0.35)" />

          {/* Main 2D flame silhouette */}
          <path
            d="M32 6C32 6 46 17.5 46 31C46 34.4 44.8 37.3 42.9 39.6C44.3 36.8 44.7 33.9 43.6 31.2C41.8 35.8 37.8 38.4 33.9 39.8C33.9 39.8 36.4 34.5 34.1 29.4C32.5 26 29.8 23.8 29.8 23.8C29.8 23.8 30.6 29.1 27.9 33C25.3 36.6 22 38.4 22 43.6C22 50.8 27.7 56.2 34.8 55.9C43.1 55.6 50 48.9 50 39.9C50 27.1 37.5 13.7 32 6Z"
            fill={`url(#${gradId})`}
          />

          {/* Warm inner core */}
          <path
            d="M32.4 36.5C28.4 39 26.5 42.8 27.2 46.8C27.9 50.6 31 53.3 34.7 53.3C39 53.3 42.3 49.9 42.3 45.5C42.3 40.7 37 37.7 32.4 36.5Z"
            fill={palette.core}
            fillOpacity="0.92"
          />

          {/* Friendly minimalist eyes & expression */}
          {mood === "sleepy" ? (
            <>
              <path
                d="M27.5 44.5Q29.5 46 31.5 44.5"
                stroke="#1A1D23"
                strokeWidth="1.9"
                strokeLinecap="round"
                fill="none"
              />
              <path
                d="M36 44.5Q38 46 40 44.5"
                stroke="#1A1D23"
                strokeWidth="1.9"
                strokeLinecap="round"
                fill="none"
              />
            </>
          ) : mood === "happy" || mood === "celebration" ? (
            <>
              <path
                d="M27.5 44.5Q29.5 42.2 31.5 44.5"
                stroke="#1A1D23"
                strokeWidth="2"
                strokeLinecap="round"
                fill="none"
              />
              <path
                d="M36 44.5Q38 42.2 40 44.5"
                stroke="#1A1D23"
                strokeWidth="2"
                strokeLinecap="round"
                fill="none"
              />
              <path
                d="M31.5 48.2Q33.8 50.5 36.2 48.2"
                stroke="#1A1D23"
                strokeWidth="1.8"
                strokeLinecap="round"
                fill="none"
              />
            </>
          ) : (
            <>
              <circle cx="29.5" cy="44" r="1.8" fill="#1A1D23" />
              <circle cx="38" cy="44" r="1.8" fill="#1A1D23" />
              <path
                d="M32 48.2Q33.8 49.5 35.6 48.2"
                stroke="#1A1D23"
                strokeWidth="1.7"
                strokeLinecap="round"
                fill="none"
              />
            </>
          )}
        </svg>

        {level !== undefined && (
          <span className="absolute -bottom-1.5 -right-1.5 rounded-full border border-flame/40 bg-canvas px-1.5 py-0.5 text-[10px] font-semibold text-flame-soft tabular-nums">
            L{level}
          </span>
        )}
      </div>

      {displayMessage && (
        <div className="min-w-0 space-y-0.5">
          <p className="text-xs font-medium uppercase tracking-wider text-flame-soft">
            Ember Companion
          </p>
          <p className="text-sm text-text-secondary leading-snug">{displayMessage}</p>
        </div>
      )}
    </div>
  );
}
