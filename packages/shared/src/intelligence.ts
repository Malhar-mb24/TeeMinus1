import type { UsageCategory, UsageTargetType } from "./wellbeing";

export type TrackingCoverageStatus = "none" | "partial" | "connected";

export interface TrackingCoverageDto {
  status: TrackingCoverageStatus;
  syncConsentEnabled: boolean;
  hasActiveExtension: boolean;
  hasActiveDesktopTracker: boolean;
  activeDeviceCount: number;
  explanation: string;
}

export interface FocusSessionTimelineItemDto {
  id: string;
  localDate: string;
  startedAt: string;
  endedAt: string | null;
  mode: string;
  status: string;
  title: string;
  plannedDurationSeconds: number;
  accumulatedSeconds: number;
  pauseGapSeconds: number;
  xpEarned: number;
  outcomeFlag: "deep_completion" | "completed" | "interrupted" | "cancelled";
  sameDayTrackedWebSeconds: number | null;
  sameDayTrackedDesktopSeconds: number | null;
  sameDayDistractingSeconds: number | null;
  sameDayDistractingTargets: string[];
}

export interface DistractionSignalDto {
  id: string;
  localDate: string;
  targetType: UsageTargetType | "focus_session";
  pattern: string;
  displayName: string;
  activeSeconds: number;
  category: UsageCategory | "interrupted_session";
  reason: string;
}

export interface TimeAccountingSummaryDto {
  rangeDays: number;
  focusSeconds: number;
  completedFocusSessions: number;
  interruptedFocusSessions: number;
  trackedWebsiteSeconds: number | null;
  trackedDesktopSeconds: number | null;
  sessionPauseSeconds: number;
  idleAndUntrackedNote: string;
}

export interface FocusIntelligenceSummaryDto {
  timezone: string;
  todayDate: string;
  rangeDays: number;
  coverage: TrackingCoverageDto;
  accounting: TimeAccountingSummaryDto;
  sessionsTimeline: FocusSessionTimelineItemDto[];
  distractionSignals: DistractionSignalDto[];
  methodologyNotes: string[];
}

export const FLOWTUNES_OFFICIAL_URL = "https://www.flowtunes.app/index.html";

export interface FocusSessionOutcomeInput {
  status: string;
  mode: string;
  accumulatedSeconds: number;
  plannedDurationSeconds: number;
}

export function classifyFocusOutcome(
  session: FocusSessionOutcomeInput
): FocusSessionTimelineItemDto["outcomeFlag"] {
  if (session.status === "cancelled") {
    return "cancelled";
  }
  if (session.status === "interrupted") {
    return "interrupted";
  }
  if (
    session.mode !== "stopwatch" &&
    session.plannedDurationSeconds > 0 &&
    session.accumulatedSeconds >= session.plannedDurationSeconds
  ) {
    return "deep_completion";
  }
  return "completed";
}

/**
 * Computes observed pause duration inside a finished focus block without inventing missing intervals.
 */
export function computeSessionPauseGapSeconds(params: {
  startedAtMs: number;
  endedAtMs: number | null;
  accumulatedSeconds: number;
}): number {
  if (params.endedAtMs === null || params.endedAtMs <= params.startedAtMs) {
    return 0;
  }
  const wallClockSeconds = Math.floor((params.endedAtMs - params.startedAtMs) / 1000);
  return Math.max(0, wallClockSeconds - Math.max(0, params.accumulatedSeconds));
}
