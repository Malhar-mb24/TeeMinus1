"use client";

import * as React from "react";
import Link from "next/link";
import {
  formatMinutesLabel,
  type AnalyticsSummaryDto,
  type FocusSessionDto,
  type GamificationSummaryDto,
  type HabitWithStatsDto,
  type TaskDto,
  type UserPreferencesDto,
} from "@ember/shared";
import {
  Armchair,
  Compass,
  Flame,
  Info,
  Moon,
  Sparkles,
  Sun,
  Timer,
  Volume2,
  VolumeX,
  Workflow,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";

export type SanctuaryRoomId = "study" | "workspace" | "lounge" | "bedroom";

interface EmberSanctuaryWorldProps {
  analytics: AnalyticsSummaryDto;
  gamification: GamificationSummaryDto;
  activeSession: FocusSessionDto | null;
  tasks: TaskDto[];
  habits: HabitWithStatsDto[];
  preferences: UserPreferencesDto;
}

export function EmberSanctuaryWorld({
  analytics,
  gamification,
  activeSession,
  tasks,
  habits,
  preferences,
}: EmberSanctuaryWorldProps) {
  const [activeRoom, setActiveRoom] = React.useState<SanctuaryRoomId>("study");
  const [isNight, setIsNight] = React.useState(true);
  const [isAudioPlaying, setIsAudioPlaying] = React.useState(false);
  const [showTour, setShowTour] = React.useState(false);
  const [interactiveNotice, setInteractiveNotice] = React.useState<string | null>(null);

  // Client-side Web Audio fireplace/rain synth (zero external asset dependency)
  const audioContextRef = React.useRef<AudioContext | null>(null);
  const audioNodesRef = React.useRef<{
    gainNode: GainNode;
    sourceNode: AudioBufferSourceNode | null;
    timerId: number | null;
  } | null>(null);

  const startAmbientSynth = React.useCallback(() => {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = audioContextRef.current || new AudioCtx();
      audioContextRef.current = ctx;

      if (ctx.state === "suspended") {
        ctx.resume();
      }

      // 4 seconds of loopable filtered pink noise + gentle pop bursts to emulate a warm crackling hearth
      const bufferSize = ctx.sampleRate * 3;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;

      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        const pink = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
        b6 = white * 0.115926;
        data[i] = pink * 0.04;
      }

      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      noise.loop = true;

      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 380;

      const gain = ctx.createGain();
      gain.gain.value = 0.45;

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      noise.start();

      // Intermittent hearth pop generator
      const popTimer = window.setInterval(() => {
        if (!audioContextRef.current || audioContextRef.current.state !== "running") return;
        const now = audioContextRef.current.currentTime;
        const osc = audioContextRef.current.createOscillator();
        const popGain = audioContextRef.current.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(140 + Math.random() * 260, now);
        osc.frequency.exponentialRampToValueAtTime(30, now + 0.04);
        popGain.gain.setValueAtTime(0.08 + Math.random() * 0.12, now);
        popGain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
        osc.connect(popGain);
        popGain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.05);
      }, 700 + Math.random() * 1400);

      audioNodesRef.current = {
        gainNode: gain,
        sourceNode: noise,
        timerId: popTimer,
      };
      setIsAudioPlaying(true);
    } catch {
      setIsAudioPlaying(false);
    }
  }, []);

  const stopAmbientSynth = React.useCallback(() => {
    if (audioNodesRef.current) {
      if (audioNodesRef.current.timerId) {
        window.clearInterval(audioNodesRef.current.timerId);
      }
      try {
        audioNodesRef.current.sourceNode?.stop();
        audioNodesRef.current.sourceNode?.disconnect();
      } catch {
        // ignore
      }
      audioNodesRef.current = null;
    }
    if (audioContextRef.current) {
      try {
        audioContextRef.current.suspend();
      } catch {
        // ignore
      }
    }
    setIsAudioPlaying(false);
  }, []);

  React.useEffect(() => {
    return () => {
      stopAmbientSynth();
    };
  }, [stopAmbientSynth]);

  const toggleAudio = () => {
    if (isAudioPlaying) {
      stopAmbientSynth();
      setInteractiveNotice("Ambient sound paused.");
    } else {
      startAmbientSynth();
      setInteractiveNotice("Synthesizing cozy hearth ambience (Web Audio).");
    }
  };

  const pendingTasksCount = tasks.filter((t) => t.status !== "completed").length;
  const completedHabitsToday = habits.filter((h) =>
    h.entries.some((e) => e.localDate === analytics.todayDate && e.status === "completed")
  ).length;

  const roomConfig = {
    study: {
      name: "Focus Study",
      subtitle: "Timestamped deep work & FlowTunes soundspace",
      role: "Study & Productivity",
      accent: "#F36B2B",
      actionLabel: "Launch Focus Timer",
      actionHref: "/focus",
      metricLabel: "Today's Focus",
      metricValue: formatMinutesLabel(analytics.daily.focusMinutes),
      detail:
        activeSession?.status === "running"
          ? `Active session in progress (${activeSession.label || "Study Session"})`
          : `${analytics.daily.sessionsCompleted} completed study sessions today`,
    },
    workspace: {
      name: "Planning Atelier",
      subtitle: "Plan-vs-Record tasks & curriculum schedule",
      role: "Tasks & Architecture",
      accent: "#FFB45C",
      actionLabel: "Open Tasks Planner",
      actionHref: "/tasks",
      metricLabel: "Pending Tasks",
      metricValue: `${pendingTasksCount} tasks`,
      detail:
        tasks.length > 0
          ? `Next up: "${tasks[0]?.title ?? "Study block"}"`
          : "All planned study tasks complete",
    },
    lounge: {
      name: "Living Hearth",
      subtitle: "Companion sanctum & website distraction intelligence",
      role: "Wellbeing & Companion",
      accent: "#10B981",
      actionLabel: "Digital Wellbeing",
      actionHref: "/wellbeing",
      metricLabel: "Flame Level",
      metricValue: `Level ${gamification.level} (${gamification.totalXp} XP)`,
      detail: `${gamification.currentFocusStreakDays} day streak · Companion resting comfortably by the fireplace (${preferences.timezone})`,
    },
    bedroom: {
      name: "Rest Haven",
      subtitle: "Consistency streaks, daily wind-down & habits",
      role: "Rest & Habit Grids",
      accent: "#38BDF8",
      actionLabel: "View Habit Matrix",
      actionHref: "/habits",
      metricLabel: "Daily Habits Done",
      metricValue: `${completedHabitsToday} of ${habits.length}`,
      detail:
        completedHabitsToday === habits.length && habits.length > 0
          ? "All daily habit check-ins completed for today!"
          : `${habits.length - completedHabitsToday} daily habits waiting for check-in`,
    },
  }[activeRoom];

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border-subtle bg-surface shadow-2xl transition-colors duration-500">
      {/* Top Sanctuary Control Bar */}
      <div className="flex flex-col gap-3 border-b border-border-subtle/80 bg-surface-elevated/80 px-4 py-3.5 backdrop-blur-md sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-flame/30 bg-flame/15 text-flame shadow-[0_0_15px_-3px_rgba(243,107,43,0.5)]">
            <Compass className="h-4 w-4" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold tracking-tight text-text-primary">
                The Ember Sanctuary
              </h2>
              <Badge variant="flame" className="text-[10px] py-0 px-2 font-medium">
                Amber House World
              </Badge>
            </div>
            <p className="text-xs text-text-muted">
              Interactive isometric retreat · {roomConfig.role}
            </p>
          </div>
        </div>

        {/* Ambient Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Day / Night Toggle */}
          <button
            type="button"
            onClick={() => {
              setIsNight((prev) => !prev);
              setInteractiveNotice(isNight ? "Daylight mode activated." : "Nighttime atmosphere restored.");
            }}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition-all duration-200 cursor-pointer",
              isNight
                ? "border-amber/40 bg-surface text-amber hover:bg-surface-hover"
                : "border-sky/40 bg-surface text-sky hover:bg-surface-hover"
            )}
            title="Toggle Day/Night ambient lighting"
            aria-label="Toggle Day or Night lighting"
          >
            {isNight ? (
              <>
                <Moon className="h-3.5 w-3.5" />
                Nighttime
              </>
            ) : (
              <>
                <Sun className="h-3.5 w-3.5 text-amber" />
                Daylight
              </>
            )}
          </button>

          {/* Ambient Sound Synth Toggle */}
          <button
            type="button"
            onClick={toggleAudio}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition-all duration-200 cursor-pointer",
              isAudioPlaying
                ? "border-flame/60 bg-flame/15 text-flame-soft shadow-[0_0_12px_rgba(243,107,43,0.35)]"
                : "border-border-subtle bg-surface text-text-secondary hover:text-text-primary hover:bg-surface-hover"
            )}
            title="Toggle synthesized hearth soundscape"
            aria-label="Toggle synthesized hearth soundscape"
          >
            {isAudioPlaying ? (
              <>
                <Volume2 className="h-3.5 w-3.5 animate-pulse" />
                Hearth Sound On
              </>
            ) : (
              <>
                <VolumeX className="h-3.5 w-3.5" />
                Hearth Muted
              </>
            )}
          </button>

          {/* Guided Tour Trigger */}
          <button
            type="button"
            onClick={() => setShowTour((prev) => !prev)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border-subtle bg-surface px-2.5 py-1 text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors cursor-pointer"
            aria-label="Toggle room architecture guide"
          >
            <Info className="h-3.5 w-3.5" />
            Tour
          </button>
        </div>
      </div>

      {/* Main Interactive Stage */}
      <div className="relative grid grid-cols-1 lg:grid-cols-12 min-h-[460px] sm:min-h-[500px]">
        {/* Isometric Canvas Section (cols 12 -> 8) */}
        <div
          className={cn(
            "relative lg:col-span-8 flex items-center justify-center p-4 sm:p-8 transition-colors duration-700 overflow-hidden",
            isNight
              ? "bg-[radial-gradient(ellipse_at_50%_45%,rgba(42,27,21,0.95),#100A08)]"
              : "bg-[radial-gradient(ellipse_at_50%_45%,rgba(65,42,32,0.85),#171311)]"
          )}
        >
          {/* Ambient Lighting Cones & Hearth Glow */}
          <div
            aria-hidden="true"
            className={cn(
              "pointer-events-none absolute inset-0 transition-opacity duration-700",
              isNight ? "opacity-90" : "opacity-40"
            )}
          >
            {/* Window Night Sky / Starry Particles */}
            <div className="absolute top-6 left-8 h-24 w-32 rounded-lg bg-[#0C121E] border border-[#232F42] overflow-hidden shadow-[inset_0_0_20px_rgba(0,0,0,0.8)]">
              <div className="absolute top-3 left-4 h-1 w-1 rounded-full bg-white/70 animate-pulse" />
              <div className="absolute top-10 left-16 h-1 w-1 rounded-full bg-amber/80" />
              <div className="absolute top-5 right-6 h-1.5 w-1.5 rounded-full bg-sky/80 animate-ping duration-1000" />
              {/* Moon or Warm Sun in Window */}
              {isNight ? (
                <div className="absolute top-3 right-3 h-5 w-5 rounded-full bg-[#FFEBB7] shadow-[0_0_12px_#FFEBB7]" />
              ) : (
                <div className="absolute top-2 right-2 h-7 w-7 rounded-full bg-[#FFA43B] shadow-[0_0_20px_#FFA43B]" />
              )}
            </div>

            {/* Hearth Radial Warmth on the floor */}
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 h-56 w-80 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(243,107,43,0.22),transparent_70%)] blur-2xl" />
          </div>

          {/* SVG Isometric Pixel-Art / Vector Model */}
          <div className="relative z-10 w-full max-w-[580px] select-none">
            <svg
              viewBox="0 0 640 460"
              className="w-full h-auto drop-shadow-[0_20px_40px_rgba(0,0,0,0.6)]"
              aria-label="Cozy isometric sanctuary room architecture"
            >
              <defs>
                {/* Isometric Gradients */}
                <linearGradient id="iso-floor-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor={isNight ? "#241812" : "#32221A"} />
                  <stop offset="100%" stopColor={isNight ? "#17100D" : "#221712"} />
                </linearGradient>

                <linearGradient id="iso-wall-left" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor={isNight ? "#1F1612" : "#2A1D16"} />
                  <stop offset="100%" stopColor={isNight ? "#120C09" : "#1A120E"} />
                </linearGradient>

                <linearGradient id="iso-wall-right" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor={isNight ? "#2A1C16" : "#38251C"} />
                  <stop offset="100%" stopColor={isNight ? "#170F0B" : "#20140F"} />
                </linearGradient>

                <linearGradient id="iso-desk-top" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#4A2E1F" />
                  <stop offset="100%" stopColor="#321D12" />
                </linearGradient>

                <linearGradient id="iso-lamp-light" x1="50%" y1="0%" x2="50%" y2="100%">
                  <stop offset="0%" stopColor="#FFB45C" stopOpacity={isNight ? "0.45" : "0.2"} />
                  <stop offset="100%" stopColor="#FFB45C" stopOpacity="0" />
                </linearGradient>

                <linearGradient id="iso-screen-glow" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#F36B2B" />
                  <stop offset="100%" stopColor="#B94716" />
                </linearGradient>

                <filter id="soft-glow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="6" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>

              {/* Back Left Wall */}
              <polygon
                points="320,40 40,200 40,360 320,200"
                fill="url(#iso-wall-left)"
                stroke="#3D291F"
                strokeWidth="1.5"
              />

              {/* Back Right Wall */}
              <polygon
                points="320,40 600,200 600,360 320,200"
                fill="url(#iso-wall-right)"
                stroke="#3D291F"
                strokeWidth="1.5"
              />

              {/* Isometric Floor */}
              <polygon
                points="320,200 600,360 320,450 40,360"
                fill="url(#iso-floor-grad)"
                stroke="#452C1F"
                strokeWidth="2"
              />

              {/* Floor Planks Subtle Lines */}
              <line x1="180" y1="280" x2="460" y2="405" stroke="#2B1A12" strokeWidth="1" strokeOpacity="0.6" />
              <line x1="250" y1="240" x2="530" y2="385" stroke="#2B1A12" strokeWidth="1" strokeOpacity="0.6" />
              <line x1="110" y1="320" x2="390" y2="430" stroke="#2B1A12" strokeWidth="1" strokeOpacity="0.6" />

              {/* Cozy Woven Rug under the Study / Hearth area */}
              <polygon
                points="320,270 480,350 320,410 160,330"
                fill={activeRoom === "lounge" ? "#7A2E12" : "#382318"}
                stroke="#A84318"
                strokeWidth="1.5"
                strokeDasharray="4,3"
                opacity="0.85"
                className="transition-all duration-300"
              />

              {/* Left Wall Window Frame */}
              <g transform="translate(100, 110)">
                <polygon points="0,50 80,0 80,80 0,130" fill={isNight ? "#0C121E" : "#7BB1D9"} stroke="#4A3428" strokeWidth="2" />
                <line x1="40" y1="25" x2="40" y2="105" stroke="#4A3428" strokeWidth="1.5" />
                <line x1="0" y1="90" x2="80" y2="40" stroke="#4A3428" strokeWidth="1.5" />
                {/* Sunlight / Moonbeam Projection */}
                <polygon
                  points="0,130 80,80 180,240 60,280"
                  fill={isNight ? "rgba(100,160,255,0.04)" : "rgba(255,200,100,0.12)"}
                />
              </g>

              {/* Corner Bookshelf on Left Wall */}
              <g transform="translate(220, 80)">
                {/* Shelf frame */}
                <polygon points="0,30 30,12 30,130 0,148" fill="#3D261A" stroke="#4D3324" />
                <polygon points="30,12 70,35 70,153 30,130" fill="#2E1C13" stroke="#4D3324" />
                <polygon points="0,30 40,53 70,35 30,12" fill="#543725" stroke="#4D3324" />
                {/* Colorful Book Spines */}
                <rect x="36" y="50" width="6" height="35" fill="#F36B2B" transform="skewY(26)" />
                <rect x="44" y="46" width="7" height="38" fill="#FFB45C" transform="skewY(26)" />
                <rect x="53" y="42" width="6" height="34" fill="#10B981" transform="skewY(26)" />
                <rect x="61" y="38" width="5" height="37" fill="#38BDF8" transform="skewY(26)" />
              </g>

              {/* ================= ZONE 1: STUDY DESK (Right side) ================= */}
              <g
                className="cursor-pointer group"
                onClick={() => {
                  setActiveRoom("study");
                  setInteractiveNotice("Study Desk: Focus workspace with live timer connection.");
                }}
              >
                {/* Desk top */}
                <polygon points="370,250 490,190 550,220 430,280" fill="url(#iso-desk-top)" stroke="#613B26" strokeWidth="1.5" />
                {/* Desk front legs */}
                <polygon points="430,280 440,275 440,335 430,340" fill="#2E1B12" />
                <polygon points="550,220 545,223 545,280 550,277" fill="#2E1B12" />
                <polygon points="370,250 378,246 378,306 370,310" fill="#2E1B12" />

                {/* Dual Screen / Monitor on Desk */}
                <polygon points="440,210 490,185 490,225 440,250" fill="#16191F" stroke="#2C3240" strokeWidth="1.5" />
                <polygon points="443,212 487,190 487,223 443,245" fill="url(#iso-screen-glow)" />

                {/* Desk Lamp on Study Desk */}
                <g transform="translate(500, 180)">
                  <line x1="10" y1="20" x2="16" y2="0" stroke="#FFB45C" strokeWidth="2.5" />
                  <ellipse cx="18" cy="0" rx="8" ry="4" fill="#FFB45C" />
                  {/* Light Cone on desk */}
                  <polygon points="18,0 35,50 -10,60" fill="url(#iso-lamp-light)" />
                </g>

                {/* Coffee Mug */}
                <ellipse cx="410" cy="265" rx="5" ry="3" fill="#FFF3E7" stroke="#3D291F" />
                {/* Steam rise */}
                <path d="M410,262 Q412,252 408,244" stroke="#FFF3E7" strokeWidth="1" fill="none" opacity="0.6" strokeDasharray="3,2" />

                {/* Chair */}
                <polygon points="370,300 410,280 430,290 390,310" fill="#8C3F1B" stroke="#A84C21" />
                <polygon points="370,280 410,260 410,280 370,300" fill="#B94716" />
                <line x1="390" y1="310" x2="390" y2="340" stroke="#1C1815" strokeWidth="3" />
              </g>

              {/* ================= ZONE 2: WORKSPACE ATELIER / DRAFTING (Back Right) ================= */}
              <g
                className="cursor-pointer group"
                onClick={() => {
                  setActiveRoom("workspace");
                  setInteractiveNotice("Planning Atelier: Architecture whiteboard with active tasks.");
                }}
              >
                {/* Whiteboard / Pinboard hanging on back right wall */}
                <polygon points="420,100 520,150 520,210 420,160" fill="#241B15" stroke="#54392C" strokeWidth="2" />
                {/* Sticky Notes on board */}
                <polygon points="440,125 455,133 455,145 440,137" fill="#FFB45C" />
                <polygon points="465,138 480,146 480,158 465,150" fill="#10B981" />
                <polygon points="490,151 505,159 505,171 490,163" fill="#38BDF8" />

                {/* Potted Fiddle Leaf Fig Plant beside whiteboard */}
                <g transform="translate(540, 240)">
                  <polygon points="0,20 15,10 30,20 15,30" fill="#994D29" stroke="#663319" />
                  <polygon points="0,20 30,20 25,50 5,50" fill="#7A3C1E" />
                  {/* Plant Leaves */}
                  <ellipse cx="15" cy="5" rx="10" ry="16" fill="#1E7A52" transform="rotate(-15, 15, 5)" />
                  <ellipse cx="25" cy="-8" rx="8" ry="14" fill="#28A76E" transform="rotate(25, 25, -8)" />
                  <ellipse cx="6" cy="-14" rx="9" ry="15" fill="#34C783" transform="rotate(-30, 6, -14)" />
                </g>
              </g>

              {/* ================= ZONE 3: LOUNGE & FIREPLACE (Center-Left) ================= */}
              <g
                className="cursor-pointer group"
                onClick={() => {
                  setActiveRoom("lounge");
                  setInteractiveNotice("Living Hearth: Warm fireplace with the resting Flame Companion.");
                }}
              >
                {/* Brick Fireplace on Left Wall */}
                <g transform="translate(180, 160)">
                  {/* Fireplace mantel */}
                  <polygon points="0,50 50,25 90,45 40,70" fill="#4A3429" stroke="#5C4234" strokeWidth="1.5" />
                  <polygon points="0,50 40,70 40,130 0,110" fill="#332219" />
                  <polygon points="40,70 90,45 90,105 40,130" fill="#241710" />
                  {/* Hearth Opening (Hole) */}
                  <polygon points="30,85 70,65 70,115 30,135" fill="#0C0705" />

                  {/* LIVING EMBER FLAME IN FIREPLACE */}
                  <g transform="translate(45, 95)" filter="url(#soft-glow)">
                    <ellipse cx="5" cy="18" rx="14" ry="4" fill="#F36B2B" opacity="0.6" />
                    {/* Flame Body */}
                    <path
                      d="M5,0 C9,6 14,12 12,20 C10,26 0,26 -2,20 C-4,12 1,6 5,0 Z"
                      fill="#F36B2B"
                      className="animate-ember-happy origin-bottom"
                    />
                    <path
                      d="M5,6 C7,10 10,14 8,18 C7,22 1,22 0,18 C-1,14 2,10 5,6 Z"
                      fill="#FFB45C"
                    />
                    {/* Cute companion eyes */}
                    <ellipse cx="3" cy="14" rx="1.2" ry="1.5" fill="#160B07" />
                    <ellipse cx="8" cy="14" rx="1.2" ry="1.5" fill="#160B07" />
                  </g>
                </g>

                {/* Cozy Lounge Armchair */}
                <g transform="translate(200, 270)">
                  {/* Seat Cushion */}
                  <polygon points="0,30 40,10 80,30 40,50" fill="#B94716" stroke="#D9571E" strokeWidth="1.5" />
                  <polygon points="0,30 40,50 40,70 0,50" fill="#8C3510" />
                  <polygon points="40,50 80,30 80,50 40,70" fill="#732B0C" />
                  {/* Backrest */}
                  <polygon points="0,0 40,-20 40,10 0,30" fill="#C9531D" stroke="#E6652B" />
                  {/* Chair Legs */}
                  <line x1="5" y1="50" x2="5" y2="70" stroke="#2B1D16" strokeWidth="2.5" />
                  <line x1="75" y1="30" x2="75" y2="50" stroke="#2B1D16" strokeWidth="2.5" />
                  <line x1="40" y1="70" x2="40" y2="88" stroke="#2B1D16" strokeWidth="2.5" />
                </g>

                {/* Vinyl Record Player on small side stool */}
                <g transform="translate(130, 260)">
                  <polygon points="0,20 25,7 45,17 20,30" fill="#3D291F" stroke="#543B2C" />
                  <polygon points="0,20 20,30 20,45 0,35" fill="#291A13" />
                  <polygon points="20,30 45,17 45,32 20,45" fill="#1E130D" />
                  <ellipse cx="22" cy="18" rx="10" ry="5" fill="#171311" stroke="#332A24" />
                  <ellipse cx="22" cy="18" rx="3" ry="1.5" fill="#F36B2B" />
                </g>
              </g>

              {/* ================= ZONE 4: BEDROOM / REST HAVEN (Front Left) ================= */}
              <g
                className="cursor-pointer group"
                onClick={() => {
                  setActiveRoom("bedroom");
                  setInteractiveNotice("Rest Haven: Platform bed & daily wind-down consistency.");
                }}
              >
                {/* Platform Bed */}
                <g transform="translate(80, 310)">
                  {/* Bed Frame Base */}
                  <polygon points="0,40 70,5 150,45 80,80" fill="#382419" stroke="#4F3323" strokeWidth="1.5" />
                  <polygon points="0,40 80,80 80,95 0,55" fill="#241710" />
                  <polygon points="80,80 150,45 150,60 80,95" fill="#1C110C" />
                  {/* Cozy Amber Duvet / Blanket */}
                  <polygon points="20,45 75,18 140,50 85,78" fill="#F36B2B" stroke="#FF884D" opacity="0.9" />
                  {/* Cream Pillow */}
                  <polygon points="15,35 45,20 60,28 30,43" fill="#FFF3E7" stroke="#CBB9AA" />
                </g>

                {/* Nightstand & Mushroom Lamp */}
                <g transform="translate(60, 300)">
                  <polygon points="0,15 20,5 35,12 15,22" fill="#4A3223" stroke="#5C3F2D" />
                  <polygon points="0,15 15,22 15,40 0,33" fill="#2E1E15" />
                  <polygon points="15,22 35,12 35,30 15,40" fill="#241710" />
                  {/* Mushroom Lamp */}
                  <line x1="17" y1="12" x2="17" y2="2" stroke="#FFB45C" strokeWidth="2" />
                  <ellipse cx="17" cy="0" rx="7" ry="4" fill="#FFB45C" className="animate-lamp-glow" />
                </g>
              </g>

              {/* Active Room Indicator Ring Floating */}
              {activeRoom === "study" && (
                <ellipse cx="460" cy="270" rx="40" ry="20" fill="none" stroke="#F36B2B" strokeWidth="2" strokeDasharray="4,4" className="animate-pulse" />
              )}
              {activeRoom === "workspace" && (
                <ellipse cx="480" cy="170" rx="45" ry="22" fill="none" stroke="#FFB45C" strokeWidth="2" strokeDasharray="4,4" className="animate-pulse" />
              )}
              {activeRoom === "lounge" && (
                <ellipse cx="230" cy="230" rx="45" ry="22" fill="none" stroke="#10B981" strokeWidth="2" strokeDasharray="4,4" className="animate-pulse" />
              )}
              {activeRoom === "bedroom" && (
                <ellipse cx="150" cy="360" rx="55" ry="26" fill="none" stroke="#38BDF8" strokeWidth="2" strokeDasharray="4,4" className="animate-pulse" />
              )}
            </svg>
          </div>

          {/* Interactive Room Floating Pills on bottom of Canvas */}
          <div className="absolute bottom-3 inset-x-3 flex flex-wrap items-center justify-center gap-1.5 z-20">
            {(
              [
                { id: "study", label: "Study Desk", icon: Timer, color: "text-flame" },
                { id: "workspace", label: "Planning Atelier", icon: Workflow, color: "text-amber" },
                { id: "lounge", label: "Living Hearth", icon: Flame, color: "text-emerald" },
                { id: "bedroom", label: "Rest Haven", icon: Armchair, color: "text-sky" },
              ] as const
            ).map((room) => {
              const Icon = room.icon;
              const isSelected = activeRoom === room.id;
              return (
                <button
                  key={room.id}
                  type="button"
                  onClick={() => {
                    setActiveRoom(room.id);
                    setInteractiveNotice(`Selected ${room.label}. Click action button to enter workspace.`);
                  }}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-200 cursor-pointer backdrop-blur-md shadow-md",
                    isSelected
                      ? "border border-flame/70 bg-surface-elevated text-text-primary shadow-[0_0_15px_-3px_rgba(243,107,43,0.4)]"
                      : "border border-border-subtle/80 bg-surface/85 text-text-secondary hover:text-text-primary hover:bg-surface-elevated"
                  )}
                  aria-label={`Switch to ${room.label}`}
                >
                  <Icon className={cn("h-3.5 w-3.5", room.color)} />
                  <span>{room.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Room HUD & Action Panel (cols 12 -> 4) */}
        <div className="lg:col-span-4 flex flex-col justify-between border-t lg:border-t-0 lg:border-l border-border-subtle bg-surface-elevated p-5 sm:p-6 space-y-6">
          <div className="space-y-4">
            {/* Header info */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span
                  className="text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md border"
                  style={{
                    color: roomConfig.accent,
                    borderColor: `${roomConfig.accent}40`,
                    backgroundColor: `${roomConfig.accent}15`,
                  }}
                >
                  {roomConfig.role}
                </span>
                <span className="text-xs text-text-muted flex items-center gap-1">
                  <Sparkles className="h-3 w-3 text-amber" />
                  Sanctuary V2
                </span>
              </div>
              <h3 className="text-xl font-semibold tracking-tight text-text-primary">
                {roomConfig.name}
              </h3>
              <p className="text-xs text-text-secondary leading-relaxed">
                {roomConfig.subtitle}
              </p>
            </div>

            {/* Live Contextual Stat Card */}
            <div className="rounded-xl border border-border-subtle bg-surface p-4 space-y-2 shadow-inner">
              <span className="text-[10px] font-medium uppercase tracking-wider text-text-muted">
                {roomConfig.metricLabel}
              </span>
              <div className="text-2xl font-bold tracking-tight text-text-primary">
                {roomConfig.metricValue}
              </div>
              <p className="text-xs text-text-secondary leading-normal">
                {roomConfig.detail}
              </p>
            </div>

            {/* Interactive Notice Toast */}
            {interactiveNotice && (
              <div className="flex items-center gap-2 rounded-lg border border-flame/30 bg-flame/10 p-2.5 text-xs text-text-primary animate-in fade-in duration-200">
                <Info className="h-4 w-4 shrink-0 text-flame" />
                <span className="flex-1">{interactiveNotice}</span>
              </div>
            )}

            {/* Guided Tour Explainer */}
            {showTour && (
              <div className="rounded-xl border border-amber/30 bg-amber/10 p-3.5 text-xs text-text-primary space-y-2">
                <p className="font-medium text-amber">Welcome to the Amber House Sanctuary:</p>
                <ul className="space-y-1 text-text-secondary list-disc pl-4">
                  <li><strong>Study:</strong> Click the desk to launch your focus sessions.</li>
                  <li><strong>Workspace:</strong> Check active and upcoming study tasks.</li>
                  <li><strong>Lounge:</strong> Visit your companion &amp; check digital wellbeing.</li>
                  <li><strong>Bedroom:</strong> Track habit check-in streaks &amp; rest goals.</li>
                  <li><strong>Hearth Audio:</strong> Toggle synthesized ambient crackle anytime.</li>
                </ul>
              </div>
            )}
          </div>

          {/* Action button linking to the workspace view */}
          <div className="pt-2">
            <Button asChild variant="ember" className="w-full justify-between h-11 text-sm font-medium shadow-lg">
              <Link href={roomConfig.actionHref}>
                <span>Enter {roomConfig.name}</span>
                <span className="inline-flex items-center gap-1 text-xs opacity-90">
                  {roomConfig.actionLabel}
                  <Zap className="h-3.5 w-3.5" />
                </span>
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
