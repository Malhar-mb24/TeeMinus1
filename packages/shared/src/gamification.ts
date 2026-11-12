import type { CompanionStyle } from "./preferences";

export const COMPANION_MOODS = [
  "idle",
  "happy",
  "excited",
  "sleepy",
  "celebration",
] as const;
export type CompanionMood = (typeof COMPANION_MOODS)[number];

export interface AchievementDefinition {
  code: string;
  title: string;
  description: string;
  icon: string;
  xpReward: number;
  category: "focus" | "habits" | "goals" | "levels";
  threshold: number;
}

export const ACHIEVEMENT_CATALOG: AchievementDefinition[] = [
  {
    code: "first_focus",
    title: "First Spark",
    description: "Complete your first qualifying focus session.",
    icon: "flame",
    xpReward: 25,
    category: "focus",
    threshold: 1,
  },
  {
    code: "hour_of_focus",
    title: "Deep Hour",
    description: "Accumulate 60 minutes of completed focus time.",
    icon: "timer",
    xpReward: 40,
    category: "focus",
    threshold: 60,
  },
  {
    code: "deep_five_hours",
    title: "Steady Hearth",
    description: "Accumulate 300 minutes of completed focus time.",
    icon: "sparkles",
    xpReward: 100,
    category: "focus",
    threshold: 300,
  },
  {
    code: "habit_starter",
    title: "Daily Rhythm",
    description: "Complete your first habit check-in.",
    icon: "check-circle",
    xpReward: 25,
    category: "habits",
    threshold: 1,
  },
  {
    code: "habit_week_streak",
    title: "Seven-Day Ember",
    description: "Reach a 7-day habit or focus streak.",
    icon: "calendar-check",
    xpReward: 80,
    category: "habits",
    threshold: 7,
  },
  {
    code: "daily_goal_hit",
    title: "Target Met",
    description: "Complete your daily focus goal for a calendar day.",
    icon: "target",
    xpReward: 50,
    category: "goals",
    threshold: 1,
  },
  {
    code: "level_2",
    title: "Warming Up",
    description: "Reach Level 2 and unlock the Ember Spark companion style.",
    icon: "award",
    xpReward: 30,
    category: "levels",
    threshold: 2,
  },
  {
    code: "level_5",
    title: "Focused Mind",
    description: "Reach Level 5 through consistent habits and sessions.",
    icon: "trophy",
    xpReward: 120,
    category: "levels",
    threshold: 5,
  },
];

export const COSMETIC_UNLOCK_RULES: Array<{
  style: CompanionStyle;
  label: string;
  requiredLevel: number;
}> = [
  { style: "classic-flame", label: "Classic Flame", requiredLevel: 1 },
  { style: "ember-spark", label: "Ember Spark", requiredLevel: 2 },
  { style: "calm-hearth", label: "Calm Hearth", requiredLevel: 4 },
];

export function xpRequiredForLevel(level: number): number {
  const safeLevel = Math.max(1, Math.floor(level));
  return 50 * safeLevel * (safeLevel - 1);
}

export interface LevelProgressSummary {
  level: number;
  totalXp: number;
  currentLevelXp: number;
  nextLevelXp: number;
  xpIntoLevel: number;
  xpToNextLevel: number;
  progressPercent: number;
}

export function getLevelProgress(totalXp: number): LevelProgressSummary {
  const safeXp = Math.max(0, Math.floor(totalXp));
  let level = 1;
  while (safeXp >= xpRequiredForLevel(level + 1)) {
    level += 1;
  }
  const currentLevelXp = xpRequiredForLevel(level);
  const nextLevelXp = xpRequiredForLevel(level + 1);
  const span = Math.max(1, nextLevelXp - currentLevelXp);
  const xpIntoLevel = safeXp - currentLevelXp;
  const xpToNextLevel = Math.max(0, nextLevelXp - safeXp);
  const progressPercent = Math.min(100, Math.round((xpIntoLevel / span) * 100));

  return {
    level,
    totalXp: safeXp,
    currentLevelXp,
    nextLevelXp,
    xpIntoLevel,
    xpToNextLevel,
    progressPercent,
  };
}

export function getUnlockedCosmeticsForLevel(level: number): CompanionStyle[] {
  return COSMETIC_UNLOCK_RULES.filter((rule) => level >= rule.requiredLevel).map(
    (rule) => rule.style
  );
}

export function calculateSessionXp(params: {
  mode: "pomodoro" | "custom" | "short_break" | "long_break" | "stopwatch";
  status: "completed" | "interrupted" | "cancelled";
  actualSeconds: number;
}): number {
  if (params.status === "cancelled") {
    return 0;
  }
  if (params.mode === "short_break" || params.mode === "long_break") {
    return 0;
  }

  const safeSeconds = Math.max(0, Math.floor(params.actualSeconds));
  if (params.status === "interrupted") {
    return safeSeconds >= 300 ? 5 : 0;
  }

  const minRequiredSeconds = params.mode === "stopwatch" ? 300 : 60;
  if (safeSeconds < minRequiredSeconds) {
    return 0;
  }

  const minutes = Math.floor(safeSeconds / 60);
  return 10 + Math.min(120, minutes);
}
