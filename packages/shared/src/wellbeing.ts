import { z } from "zod";
import { addDaysToDateKey, getLocalDateKey } from "./dates";

export const DEVICE_TYPES = ["chrome_extension", "windows_desktop"] as const;
export type DeviceType = (typeof DEVICE_TYPES)[number];

export const USAGE_CATEGORIES = ["productive", "neutral", "distracting"] as const;
export type UsageCategory = (typeof USAGE_CATEGORIES)[number];

export const USAGE_TARGET_TYPES = ["website", "desktop_app"] as const;
export type UsageTargetType = (typeof USAGE_TARGET_TYPES)[number];

const HOSTNAME_REGEX =
  /^(?:localhost|(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9-]{2,63})$/;

const APP_PATTERN_REGEX = /^[a-z0-9][a-z0-9._-]{0,119}$/;

const LOCAL_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const BLOCKED_SCHEMES = [
  "chrome:",
  "chrome-extension:",
  "edge:",
  "about:",
  "file:",
  "moz-extension:",
  "view-source:",
  "data:",
  "blob:",
  "javascript:",
  "devtools:",
];

/**
 * Extracts a normalized, privacy-safe hostname from a browser URL.
 * Rejects internal browser schemes, file paths, query strings, hashes, and invalid domains.
 */
export function extractTrackableHostname(rawUrl: string): string | null {
  if (typeof rawUrl !== "string") {
    return null;
  }
  const trimmed = rawUrl.trim();
  if (!trimmed || trimmed.length > 2048) {
    return null;
  }

  const lower = trimmed.toLowerCase();
  if (BLOCKED_SCHEMES.some((scheme) => lower.startsWith(scheme))) {
    return null;
  }

  let hostname = "";
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    hostname = parsed.hostname.toLowerCase();
  } catch {
    return null;
  }

  hostname = hostname.replace(/\.+$/, "");
  if (hostname.startsWith("www.") && hostname.length > 4) {
    hostname = hostname.slice(4);
  }

  if (!hostname || hostname.length > 253 || !HOSTNAME_REGEX.test(hostname)) {
    return null;
  }

  return hostname;
}

/**
 * Validates and normalizes a bare hostname (no protocol/path/query allowed).
 */
export function normalizeHostnamePattern(rawPattern: string): string | null {
  if (typeof rawPattern !== "string") {
    return null;
  }
  let normalized = rawPattern.trim().toLowerCase().replace(/\.+$/, "");
  if (normalized.startsWith("www.") && normalized.length > 4) {
    normalized = normalized.slice(4);
  }
  if (!normalized || normalized.length > 253 || !HOSTNAME_REGEX.test(normalized)) {
    return null;
  }
  return normalized;
}

/**
 * Normalizes a desktop executable/process identifier into a privacy-safe lowercase pattern.
 */
export function normalizeDesktopAppName(rawProcessName: string): string | null {
  if (typeof rawProcessName !== "string") {
    return null;
  }
  const trimmed = rawProcessName.trim();
  if (!trimmed) {
    return null;
  }
  const baseName = trimmed.split(/[\\/]/).pop()?.trim().toLowerCase() ?? "";
  if (!baseName || baseName.length > 120 || !APP_PATTERN_REGEX.test(baseName)) {
    return null;
  }
  return baseName;
}

const FRIENDLY_DESKTOP_APP_NAMES: Record<string, string> = {
  "code.exe": "VS Code",
  "cursor.exe": "Cursor",
  "windsurf.exe": "Windsurf",
  "devenv.exe": "Visual Studio",
  "idea64.exe": "IntelliJ IDEA",
  "pycharm64.exe": "PyCharm",
  "webstorm64.exe": "WebStorm",
  "windowsterminal.exe": "Windows Terminal",
  "wt.exe": "Windows Terminal",
  "pwsh.exe": "PowerShell",
  "powershell.exe": "Windows PowerShell",
  "cmd.exe": "Command Prompt",
  "chrome.exe": "Google Chrome",
  "msedge.exe": "Microsoft Edge",
  "firefox.exe": "Mozilla Firefox",
  "brave.exe": "Brave Browser",
  "arc.exe": "Arc Browser",
  "notion.exe": "Notion",
  "obsidian.exe": "Obsidian",
  "figma.exe": "Figma",
  "slack.exe": "Slack",
  "ms-teams.exe": "Microsoft Teams",
  "teams.exe": "Microsoft Teams",
  "zoom.exe": "Zoom",
  "discord.exe": "Discord",
  "spotify.exe": "Spotify",
  "steam.exe": "Steam",
  "vlc.exe": "VLC Media Player",
  "winword.exe": "Microsoft Word",
  "excel.exe": "Microsoft Excel",
  "powerpnt.exe": "Microsoft PowerPoint",
  "onenote.exe": "OneNote",
  "outlook.exe": "Microsoft Outlook",
  "explorer.exe": "File Explorer",
  "notepad.exe": "Notepad",
  "postman.exe": "Postman",
  "docker desktop.exe": "Docker Desktop",
};

export function getDesktopAppDisplayName(appName: string, providedDisplayName?: string | null): string {
  const normalized = normalizeDesktopAppName(appName) ?? appName.trim().toLowerCase();
  if (FRIENDLY_DESKTOP_APP_NAMES[normalized]) {
    return FRIENDLY_DESKTOP_APP_NAMES[normalized];
  }
  const cleanedProvided = providedDisplayName?.trim();
  if (cleanedProvided && cleanedProvided.length <= 80) {
    return cleanedProvided;
  }
  const withoutExt = normalized.replace(/\.exe$/i, "");
  return withoutExt
    .split(/[-_.\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export const DEFAULT_WEBSITE_CATEGORIES: Record<string, UsageCategory> = {
  "github.com": "productive",
  "gitlab.com": "productive",
  "localhost": "productive",
  "docs.google.com": "productive",
  "drive.google.com": "productive",
  "notion.so": "productive",
  "linear.app": "productive",
  "figma.com": "productive",
  "stackoverflow.com": "productive",
  "developer.mozilla.org": "productive",
  "vercel.com": "productive",
  "neon.tech": "productive",
  "clerk.com": "productive",
  "nextjs.org": "productive",
  "react.dev": "productive",
  "typescriptlang.org": "productive",
  "youtube.com": "distracting",
  "reddit.com": "distracting",
  "x.com": "distracting",
  "twitter.com": "distracting",
  "instagram.com": "distracting",
  "tiktok.com": "distracting",
  "facebook.com": "distracting",
  "twitch.tv": "distracting",
  "netflix.com": "distracting",
};

export const DEFAULT_DESKTOP_APP_CATEGORIES: Record<string, UsageCategory> = {
  "code.exe": "productive",
  "cursor.exe": "productive",
  "windsurf.exe": "productive",
  "devenv.exe": "productive",
  "idea64.exe": "productive",
  "pycharm64.exe": "productive",
  "webstorm64.exe": "productive",
  "windowsterminal.exe": "productive",
  "wt.exe": "productive",
  "pwsh.exe": "productive",
  "powershell.exe": "productive",
  "notion.exe": "productive",
  "obsidian.exe": "productive",
  "figma.exe": "productive",
  "postman.exe": "productive",
  "winword.exe": "productive",
  "excel.exe": "productive",
  "powerpnt.exe": "productive",
  "discord.exe": "distracting",
  "steam.exe": "distracting",
  "spotify.exe": "neutral",
  "chrome.exe": "neutral",
  "msedge.exe": "neutral",
  "firefox.exe": "neutral",
  "explorer.exe": "neutral",
};

export interface UsageCategoryOverride {
  targetType: UsageTargetType;
  pattern: string;
  category: UsageCategory;
}

export function classifyUsageTarget(
  targetType: UsageTargetType,
  rawPattern: string,
  customRules: UsageCategoryOverride[] = []
): UsageCategory {
  const normalized =
    targetType === "website"
      ? normalizeHostnamePattern(rawPattern) ?? rawPattern.trim().toLowerCase()
      : normalizeDesktopAppName(rawPattern) ?? rawPattern.trim().toLowerCase();

  for (const rule of customRules) {
    if (rule.targetType === targetType && rule.pattern.toLowerCase() === normalized) {
      return rule.category;
    }
  }

  if (targetType === "website") {
    if (DEFAULT_WEBSITE_CATEGORIES[normalized]) {
      return DEFAULT_WEBSITE_CATEGORIES[normalized];
    }
    const parts = normalized.split(".");
    for (let i = 1; i < parts.length - 1; i += 1) {
      const parentDomain = parts.slice(i).join(".");
      const parentRule = customRules.find(
        (rule) => rule.targetType === "website" && rule.pattern.toLowerCase() === parentDomain
      );
      if (parentRule) {
        return parentRule.category;
      }
      if (DEFAULT_WEBSITE_CATEGORIES[parentDomain]) {
        return DEFAULT_WEBSITE_CATEGORIES[parentDomain];
      }
    }
    return "neutral";
  }

  return DEFAULT_DESKTOP_APP_CATEGORIES[normalized] ?? "neutral";
}

export function isValidLocalDateKey(dateKey: string): boolean {
  if (!LOCAL_DATE_REGEX.test(dateKey)) {
    return false;
  }
  const parts = dateKey.split("-");
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  const d = Number(parts[2]);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

/**
 * Ensures synced localDate is not meaningfully in the future while tolerating +/-14h world timezones.
 */
export function isReasonableSyncLocalDate(dateKey: string, now: Date = new Date()): boolean {
  if (!isValidLocalDateKey(dateKey)) {
    return false;
  }
  const utcToday = getLocalDateKey(now, "UTC");
  const maxAllowed = addDaysToDateKey(utcToday, 1);
  const minAllowed = addDaysToDateKey(utcToday, -90);
  return dateKey >= minAllowed && dateKey <= maxAllowed;
}

export const createPairingCodeSchema = z.object({
  deviceType: z.enum(DEVICE_TYPES).default("chrome_extension"),
  deviceName: z.string().trim().min(1).max(80).optional(),
});

export const pairDeviceSchema = z.object({
  pairingCode: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9-]{6,16}$/, "Pairing code must be 6-16 uppercase characters."),
  deviceName: z.string().trim().min(1).max(80),
  deviceType: z.enum(DEVICE_TYPES).default("chrome_extension"),
  browser: z.string().trim().min(1).max(40).default("chrome"),
});

export const syncWebsiteEntrySchema = z.object({
  hostname: z
    .string()
    .trim()
    .transform((val) => val.toLowerCase().replace(/^www\./, "").replace(/\.+$/, ""))
    .refine((val) => HOSTNAME_REGEX.test(val), {
      message: "Invalid hostname format; URLs, paths, and query parameters are not permitted.",
    }),
  localDate: z.string().refine((val) => isReasonableSyncLocalDate(val), {
    message: "Invalid or out-of-range localDate (expected YYYY-MM-DD within recent 90 days).",
  }),
  activeSeconds: z.number().int().min(0).max(86400),
  visitCount: z.number().int().min(0).max(50000).default(1),
});

export const syncDesktopAppEntrySchema = z.object({
  appName: z
    .string()
    .trim()
    .transform((val) => normalizeDesktopAppName(val) ?? "")
    .refine((val) => val.length > 0, {
      message: "Invalid desktop application identifier.",
    }),
  displayName: z.string().trim().min(1).max(80).optional(),
  localDate: z.string().refine((val) => isReasonableSyncLocalDate(val), {
    message: "Invalid or out-of-range localDate (expected YYYY-MM-DD within recent 90 days).",
  }),
  activeSeconds: z.number().int().min(0).max(86400),
  launchCount: z.number().int().min(0).max(50000).default(1),
});

export const syncWellbeingSchema = z
  .object({
    entries: z.array(syncWebsiteEntrySchema).max(500).default([]),
    appEntries: z.array(syncDesktopAppEntrySchema).max(500).default([]),
    clientTimestamp: z.string().datetime().optional(),
  })
  .refine((payload) => payload.entries.length + payload.appEntries.length <= 500, {
    message: "Maximum 500 usage entries per sync batch.",
  });

export const upsertCategorySchema = z
  .object({
    targetType: z.enum(USAGE_TARGET_TYPES),
    pattern: z.string().trim().min(1).max(253),
    category: z.enum(USAGE_CATEGORIES),
  })
  .superRefine((val, ctx) => {
    if (val.targetType === "website" && !normalizeHostnamePattern(val.pattern)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["pattern"],
        message: "Website pattern must be a valid bare hostname (e.g. github.com).",
      });
    }
    if (val.targetType === "desktop_app" && !normalizeDesktopAppName(val.pattern)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["pattern"],
        message: "App pattern must be a valid executable/process name (e.g. code.exe).",
      });
    }
  });

export type CreatePairingCodeInput = z.infer<typeof createPairingCodeSchema>;
export type PairDeviceInput = z.infer<typeof pairDeviceSchema>;
export type SyncWebsiteEntryInput = z.infer<typeof syncWebsiteEntrySchema>;
export type SyncDesktopAppEntryInput = z.infer<typeof syncDesktopAppEntrySchema>;
export type SyncWellbeingInput = z.infer<typeof syncWellbeingSchema>;
export type UpsertCategoryInput = z.infer<typeof upsertCategorySchema>;

export interface PairedDeviceDto {
  id: string;
  deviceName: string;
  deviceType: DeviceType;
  browser: string;
  status: string;
  lastSeenAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

export interface PairingCodeResponseDto {
  code: string;
  deviceType: DeviceType;
  expiresAt: string;
}

export interface WellbeingDailyTrendDto {
  localDate: string;
  dayLabel: string;
  websiteSeconds: number;
  desktopSeconds: number;
  totalSeconds: number;
  focusSeconds: number;
  productiveSeconds: number;
  neutralSeconds: number;
  distractingSeconds: number;
}

export interface WellbeingUsageItemDto {
  targetType: UsageTargetType;
  pattern: string;
  displayName: string;
  category: UsageCategory;
  activeSeconds: number;
  count: number;
  sharePercent: number;
  lastUpdatedAt: string;
}

export interface WellbeingSummaryDto {
  timezone: string;
  todayDate: string;
  syncConsentEnabled: boolean;
  todayTotalSeconds: number;
  todayWebsiteSeconds: number;
  todayDesktopSeconds: number;
  todayFocusSeconds: number;
  rangeTotalSeconds: number;
  rangeDays: number;
  categoryBreakdown: {
    productiveSeconds: number;
    neutralSeconds: number;
    distractingSeconds: number;
  };
  dailyTrend: WellbeingDailyTrendDto[];
  topWebsites: WellbeingUsageItemDto[];
  topDesktopApps: WellbeingUsageItemDto[];
  devices: PairedDeviceDto[];
}

export interface SyncWellbeingResultDto {
  deviceId: string;
  syncedWebsiteRows: number;
  syncedDesktopAppRows: number;
  lastSeenAt: string;
}

/**
 * Formats seconds cleanly for UI cards (e.g. "2h 14m", "42m", "18s").
 */
export function formatDurationCompact(totalSeconds: number): string {
  const safe = Math.max(0, Math.round(totalSeconds));
  if (safe < 60) {
    return `${safe}s`;
  }
  const totalMinutes = Math.floor(safe / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) {
    return `${minutes}m`;
  }
  if (minutes === 0) {
    return `${hours}h`;
  }
  return `${hours}h ${minutes}m`;
}
