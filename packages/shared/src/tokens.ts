/**
 * Ember design tokens — dark-first charcoal surfaces with restrained warm flame accents.
 * Shared across web UI and extension shell so spacing, color roles, and motion stay consistent.
 */
export const EMBER_TOKENS = {
  colors: {
    canvas: "#0B0C0E",
    surface: "#131519",
    surfaceElevated: "#1A1D23",
    surfaceHover: "#22262E",
    borderSubtle: "#252932",
    borderStrong: "#353B48",
    textPrimary: "#F4F5F7",
    textSecondary: "#A1A7B4",
    textMuted: "#6F7685",
    flameAccent: "#F97316",
    flameSoft: "rgba(249, 115, 22, 0.14)",
    emeraldAccent: "#10B981",
    skyAccent: "#38BDF8",
    roseAccent: "#F43F5E",
  },
  radii: {
    sm: "0.5rem",
    md: "0.75rem",
    lg: "1rem",
    xl: "1.25rem",
    pill: "9999px",
  },
  spacing: {
    cardPadding: "1.25rem",
    sectionGap: "1.5rem",
  },
  motion: {
    snappy: "cubic-bezier(0.16, 1, 0.3, 1)",
    durationMs: 200,
  },
} as const;
