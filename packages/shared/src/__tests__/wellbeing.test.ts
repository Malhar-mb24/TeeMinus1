import { describe, expect, it } from "vitest";
import {
  classifyUsageTarget,
  extractTrackableHostname,
  formatDurationCompact,
  getDesktopAppDisplayName,
  normalizeDesktopAppName,
  syncWellbeingSchema,
  upsertCategorySchema,
} from "../wellbeing";

describe("wellbeing shared helpers & privacy sanitizers", () => {
  it("extracts normalized hostnames and strips www, paths, queries, and fragments", () => {
    expect(extractTrackableHostname("https://www.GitHub.com/owner/repo?tab=readme#top")).toBe(
      "github.com"
    );
    expect(extractTrackableHostname("http://localhost:3000/dashboard?focus=1")).toBe("localhost");
    expect(extractTrackableHostname("https://docs.python.org/3/library/os.html")).toBe(
      "docs.python.org"
    );
  });

  it("rejects internal browser URLs, file URLs, data URLs, and invalid strings", () => {
    expect(extractTrackableHostname("chrome://extensions")).toBeNull();
    expect(extractTrackableHostname("edge://settings")).toBeNull();
    expect(extractTrackableHostname("about:blank")).toBeNull();
    expect(extractTrackableHostname("chrome-extension://abcdef/popup.html")).toBeNull();
    expect(extractTrackableHostname("file:///C:/Users/secret.txt")).toBeNull();
    expect(extractTrackableHostname("not a url")).toBeNull();
  });

  it("normalizes desktop process names safely without paths", () => {
    expect(normalizeDesktopAppName("C:\\Program Files\\Microsoft VS Code\\Code.exe")).toBe(
      "code.exe"
    );
    expect(normalizeDesktopAppName("WindowsTerminal.exe")).toBe("windowsterminal.exe");
    expect(normalizeDesktopAppName("")).toBeNull();
    expect(getDesktopAppDisplayName("code.exe")).toBe("VS Code");
    expect(getDesktopAppDisplayName("my-custom-tool.exe")).toBe("My Custom Tool");
  });

  it("applies custom category rules over built-in defaults", () => {
    expect(classifyUsageTarget("website", "github.com")).toBe("productive");
    expect(classifyUsageTarget("website", "youtube.com")).toBe("distracting");
    expect(classifyUsageTarget("website", "unknown-example.org")).toBe("neutral");
    expect(
      classifyUsageTarget("website", "youtube.com", [
        { targetType: "website", pattern: "youtube.com", category: "productive" },
      ])
    ).toBe("productive");
    expect(classifyUsageTarget("desktop_app", "code.exe")).toBe("productive");
  });

  it("rejects URLs with paths or query params in syncWellbeingSchema", () => {
    const today = new Date().toISOString().slice(0, 10);
    const invalid = syncWellbeingSchema.safeParse({
      entries: [
        {
          hostname: "https://github.com/secret/repo?token=123",
          localDate: today,
          activeSeconds: 45,
          visitCount: 1,
        },
      ],
    });
    expect(invalid.success).toBe(false);

    const valid = syncWellbeingSchema.safeParse({
      entries: [
        {
          hostname: "www.github.com",
          localDate: today,
          activeSeconds: 120,
          visitCount: 3,
        },
      ],
      appEntries: [
        {
          appName: "Code.exe",
          localDate: today,
          activeSeconds: 300,
          launchCount: 2,
        },
      ],
    });
    expect(valid.success).toBe(true);
    if (valid.success) {
      expect(valid.data.entries[0]?.hostname).toBe("github.com");
      expect(valid.data.appEntries[0]?.appName).toBe("code.exe");
    }
  });

  it("validates category rules for websites and desktop apps", () => {
    expect(
      upsertCategorySchema.safeParse({
        targetType: "website",
        pattern: "notion.so",
        category: "productive",
      }).success
    ).toBe(true);

    expect(
      upsertCategorySchema.safeParse({
        targetType: "website",
        pattern: "https://notion.so/page",
        category: "productive",
      }).success
    ).toBe(false);

    expect(formatDurationCompact(45)).toBe("45s");
    expect(formatDurationCompact(3900)).toBe("1h 5m");
  });
});
