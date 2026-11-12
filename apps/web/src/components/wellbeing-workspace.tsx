"use client";

import {
  formatDurationCompact,
  type DeviceType,
  type PairingCodeResponseDto,
  type UsageCategory,
  type UsageTargetType,
  type WellbeingSummaryDto,
  type WellbeingUsageItemDto,
} from "@ember/shared";
import {
  Check,
  Chrome,
  Copy,
  Download,
  Globe,
  KeyRound,
  Laptop,
  Monitor,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Timer,
  Trash2,
  Unplug,
} from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { WellbeingTrendChart } from "./wellbeing-trend-chart";

interface WellbeingWorkspaceProps {
  initialSummary: WellbeingSummaryDto;
}

const CATEGORY_META: Record<
  UsageCategory,
  { label: string; badgeVariant: "emerald" | "neutral" | "rose"; barColor: string }
> = {
  productive: { label: "Productive", badgeVariant: "emerald", barColor: "bg-emerald" },
  neutral: { label: "Neutral", badgeVariant: "neutral", barColor: "bg-sky" },
  distracting: { label: "Distracting", badgeVariant: "rose", barColor: "bg-rose" },
};

export function WellbeingWorkspace({ initialSummary }: WellbeingWorkspaceProps) {
  const [summary, setSummary] = React.useState<WellbeingSummaryDto>(initialSummary);
  const [rangeDays, setRangeDays] = React.useState<7 | 14>(
    initialSummary.rangeDays === 14 ? 14 : 7
  );
  const [activeListTab, setActiveListTab] = React.useState<"websites" | "desktop_apps">(
    "websites"
  );
  const [pairingInfo, setPairingInfo] = React.useState<PairingCodeResponseDto | null>(null);
  const [copiedCode, setCopiedCode] = React.useState(false);
  const [busyAction, setBusyAction] = React.useState<string | null>(null);
  const [confirmClearData, setConfirmClearData] = React.useState(false);
  const [feedback, setFeedback] = React.useState<string | null>(null);

  const originUrl =
    typeof window !== "undefined" ? window.location.origin : "https://ember-nine-flame.vercel.app";

  async function refreshSummary(targetDays: 7 | 14 = rangeDays) {
    try {
      const res = await fetch(`/api/wellbeing?days=${targetDays}`, { cache: "no-store" });
      if (!res.ok) {
        setFeedback("Unable to refresh wellbeing data right now.");
        return;
      }
      const next = (await res.json()) as WellbeingSummaryDto;
      setSummary(next);
    } catch {
      setFeedback("Network error while refreshing wellbeing data.");
    }
  }

  async function handleRangeChange(days: 7 | 14) {
    setRangeDays(days);
    setBusyAction("refresh");
    try {
      await refreshSummary(days);
    } finally {
      setBusyAction(null);
    }
  }

  async function handleToggleSyncConsent() {
    const nextValue = !summary.syncConsentEnabled;
    setBusyAction("consent");
    setFeedback(null);
    try {
      const res = await fetch("/api/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ extensionTrackingConsent: nextValue }),
      });
      if (res.ok) {
        await refreshSummary();
        setFeedback(
          nextValue
            ? "Cloud sync consent enabled. Paired trackers can now upload daily totals."
            : "Cloud sync paused. Paired devices will keep data local until re-enabled."
        );
      } else {
        setFeedback("Failed to update sync consent setting.");
      }
    } finally {
      setBusyAction(null);
    }
  }

  async function handleGeneratePairingCode(deviceType: DeviceType) {
    setBusyAction(`pair-${deviceType}`);
    setFeedback(null);
    setCopiedCode(false);
    try {
      const res = await fetch("/api/devices/pairing-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceType,
          deviceName:
            deviceType === "windows_desktop" ? "Windows Desktop" : "Chrome Browser",
        }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        setFeedback(err.error ?? "Unable to generate pairing code.");
        return;
      }
      const data = (await res.json()) as PairingCodeResponseDto;
      setPairingInfo(data);
    } finally {
      setBusyAction(null);
    }
  }

  async function handleCategoryChange(
    item: WellbeingUsageItemDto,
    category: UsageCategory
  ) {
    setBusyAction(`cat-${item.targetType}-${item.pattern}`);
    setFeedback(null);
    try {
      const res = await fetch("/api/wellbeing/categories", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetType: item.targetType satisfies UsageTargetType,
          pattern: item.pattern,
          category,
        }),
      });
      if (res.ok) {
        await refreshSummary();
        setFeedback(`Classified ${item.displayName} as ${category}.`);
      } else {
        setFeedback("Unable to update classification rule.");
      }
    } catch {
      setFeedback("Network error while updating category.");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleRevokeDevice(deviceId: string, deviceName: string) {
    setBusyAction(`revoke-${deviceId}`);
    setFeedback(null);
    try {
      const res = await fetch(`/api/devices/${deviceId}/revoke`, {
        method: "POST",
      });
      if (res.ok) {
        await refreshSummary();
        setFeedback(`Revoked access for "${deviceName}".`);
      } else {
        setFeedback(`Unable to revoke "${deviceName}".`);
      }
    } catch {
      setFeedback("Network error while revoking device.");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleDeleteSyncedData() {
    setBusyAction("delete-data");
    setFeedback(null);
    try {
      const res = await fetch("/api/wellbeing/data", { method: "DELETE" });
      if (res.ok) {
        const result = (await res.json()) as {
          deletedWebsiteRows: number;
          deletedAppRows: number;
        };
        setConfirmClearData(false);
        await refreshSummary();
        setFeedback(
          `Deleted ${result.deletedWebsiteRows} website rows and ${result.deletedAppRows} desktop app rows.`
        );
      } else {
        setFeedback("Unable to delete synced usage data.");
      }
    } catch {
      setFeedback("Network error while deleting synced usage data.");
    } finally {
      setBusyAction(null);
    }
  }

  const totalBreakdownSeconds =
    summary.categoryBreakdown.productiveSeconds +
    summary.categoryBreakdown.neutralSeconds +
    summary.categoryBreakdown.distractingSeconds;

  const pct = (part: number) =>
    totalBreakdownSeconds > 0 ? Math.round((part / totalBreakdownSeconds) * 100) : 0;

  const visibleItems =
    activeListTab === "websites" ? summary.topWebsites : summary.topDesktopApps;

  const activeDeviceCount = summary.devices.filter((d) => d.status === "active").length;

  return (
    <div className="space-y-6">
      {/* Header + Consent Toggle */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-text-primary">
            Digital Wellbeing
          </h1>
          <p className="text-sm text-text-secondary">
            Real-time Chrome website and Windows desktop app activity unified with Ember focus.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-xl border border-border-subtle bg-surface-elevated p-1">
            <button
              type="button"
              onClick={() => void handleRangeChange(7)}
              className={cn(
                "rounded-lg px-3 py-1 text-xs font-medium transition-colors cursor-pointer",
                rangeDays === 7
                  ? "bg-flame text-charcoal"
                  : "text-text-secondary hover:text-text-primary"
              )}
            >
              7 Days
            </button>
            <button
              type="button"
              onClick={() => void handleRangeChange(14)}
              className={cn(
                "rounded-lg px-3 py-1 text-xs font-medium transition-colors cursor-pointer",
                rangeDays === 14
                  ? "bg-flame text-charcoal"
                  : "text-text-secondary hover:text-text-primary"
              )}
            >
              14 Days
            </button>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => void handleRangeChange(rangeDays)}
            disabled={busyAction === "refresh"}
          >
            <RefreshCw className={cn("h-3.5 w-3.5", busyAction === "refresh" && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Sync Consent & Privacy Strip */}
      <Card className="border-border-subtle bg-surface-elevated/60">
        <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <ShieldCheck className="h-5 w-5 text-emerald shrink-0 mt-0.5" />
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-text-primary">
                  Privacy-First Opt-In Sync
                </span>
                <Badge variant={summary.syncConsentEnabled ? "emerald" : "neutral"}>
                  {summary.syncConsentEnabled ? "Sync Enabled" : "Local Only"}
                </Badge>
              </div>
              <p className="mt-0.5 text-xs text-text-secondary">
                Hostnames and executable names only—no URL paths, incognito sessions, window
                titles, or keystrokes. Off-timer idle/disconnected intervals are never guessed.
              </p>
            </div>
          </div>

          <Button
            variant={summary.syncConsentEnabled ? "outline" : "primary"}
            size="sm"
            onClick={() => void handleToggleSyncConsent()}
            disabled={busyAction === "consent"}
            className="shrink-0"
          >
            {summary.syncConsentEnabled ? "Pause Cloud Sync" : "Enable Cloud Sync"}
          </Button>
        </CardContent>
      </Card>

      {feedback && (
        <div
          role="status"
          className="rounded-xl border border-flame/30 bg-flame/10 px-4 py-2.5 text-xs text-flame-soft"
        >
          {feedback}
        </div>
      )}

      {/* Hero Stats & 7-Day Digital Wellbeing Chart */}
      <div className="grid gap-6 lg:grid-cols-12">
        <Card className="lg:col-span-5 flex flex-col justify-between">
          <CardHeader>
            <CardDescription className="text-xs uppercase tracking-wider text-text-muted">
              Today&apos;s Tracked Streams ({summary.todayDate})
            </CardDescription>
            <CardTitle className="text-4xl font-bold tracking-tight tabular-nums">
              {formatDurationCompact(summary.todayTotalSeconds)}
            </CardTitle>
            <p className="text-[11px] text-text-muted">
              Sum of browser host and Windows desktop app captures shown separately below.
            </p>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-3 gap-2.5">
              <div className="rounded-xl border border-border-subtle bg-surface-elevated p-3">
                <div className="flex items-center gap-1.5 text-[11px] text-text-muted">
                  <Globe className="h-3.5 w-3.5 text-sky" />
                  Websites
                </div>
                <p className="mt-1 text-base font-semibold tabular-nums text-text-primary">
                  {formatDurationCompact(summary.todayWebsiteSeconds)}
                </p>
              </div>
              <div className="rounded-xl border border-border-subtle bg-surface-elevated p-3">
                <div className="flex items-center gap-1.5 text-[11px] text-text-muted">
                  <Monitor className="h-3.5 w-3.5 text-flame-soft" />
                  Desktop
                </div>
                <p className="mt-1 text-base font-semibold tabular-nums text-text-primary">
                  {formatDurationCompact(summary.todayDesktopSeconds)}
                </p>
              </div>
              <div className="rounded-xl border border-border-subtle bg-surface-elevated p-3">
                <div className="flex items-center gap-1.5 text-[11px] text-text-muted">
                  <Timer className="h-3.5 w-3.5 text-emerald" />
                  Ember Focus
                </div>
                <p className="mt-1 text-base font-semibold tabular-nums text-text-primary">
                  {formatDurationCompact(summary.todayFocusSeconds)}
                </p>
              </div>
            </div>

            {/* Category Breakdown Bar */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-text-secondary">
                  {rangeDays}-Day Balance ({formatDurationCompact(summary.rangeTotalSeconds)})
                </span>
                <span className="text-text-muted">
                  {pct(summary.categoryBreakdown.productiveSeconds)}% productive
                </span>
              </div>
              <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-surface-elevated">
                <div
                  className="bg-emerald transition-all"
                  style={{ width: `${pct(summary.categoryBreakdown.productiveSeconds)}%` }}
                  title="Productive"
                />
                <div
                  className="bg-sky transition-all"
                  style={{ width: `${pct(summary.categoryBreakdown.neutralSeconds)}%` }}
                  title="Neutral"
                />
                <div
                  className="bg-rose transition-all"
                  style={{ width: `${pct(summary.categoryBreakdown.distractingSeconds)}%` }}
                  title="Distracting"
                />
              </div>
              <div className="grid grid-cols-3 gap-2 text-[11px] text-text-muted">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald" />
                  Productive: {formatDurationCompact(summary.categoryBreakdown.productiveSeconds)}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-sky" />
                  Neutral: {formatDurationCompact(summary.categoryBreakdown.neutralSeconds)}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-rose" />
                  Distracting: {formatDurationCompact(summary.categoryBreakdown.distractingSeconds)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-7">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div>
              <CardTitle className="text-base">Daily Activity Trend</CardTitle>
              <CardDescription className="text-xs">
                Combined browser &amp; desktop usage across the past {rangeDays} days
              </CardDescription>
            </div>
            <Badge variant="flame" className="tabular-nums">
              {activeDeviceCount} active device{activeDeviceCount === 1 ? "" : "s"}
            </Badge>
          </CardHeader>
          <CardContent>
            <WellbeingTrendChart
              trend={summary.dailyTrend}
              todayDate={summary.todayDate}
              height={220}
            />
          </CardContent>
        </Card>
      </div>

      {/* Websites & Desktop Apps Ranked Lists */}
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-base">Screen Time Breakdown</CardTitle>
            <CardDescription className="text-xs">
              Customize whether a website or Windows app counts as Productive, Neutral, or
              Distracting.
            </CardDescription>
          </div>
          <div className="inline-flex rounded-xl border border-border-subtle bg-surface-elevated p-1 self-start">
            <button
              type="button"
              onClick={() => setActiveListTab("websites")}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer",
                activeListTab === "websites"
                  ? "bg-flame text-charcoal"
                  : "text-text-secondary hover:text-text-primary"
              )}
            >
              <Globe className="h-3.5 w-3.5" />
              Websites ({summary.topWebsites.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveListTab("desktop_apps")}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer",
                activeListTab === "desktop_apps"
                  ? "bg-flame text-charcoal"
                  : "text-text-secondary hover:text-text-primary"
              )}
            >
              <Monitor className="h-3.5 w-3.5" />
              Windows Apps ({summary.topDesktopApps.length})
            </button>
          </div>
        </CardHeader>
        <CardContent>
          {visibleItems.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border-subtle bg-surface-elevated/40 p-6 text-center">
              <Sparkles className="mx-auto h-6 w-6 text-flame-soft" />
              <p className="mt-2 text-sm font-medium text-text-primary">
                No {activeListTab === "websites" ? "website" : "Windows app"} data synced yet
              </p>
              <p className="mt-1 text-xs text-text-secondary max-w-md mx-auto">
                Enable cloud sync above, generate a pairing code below, and link your Chrome
                extension or Windows desktop tracker to inspect live usage here.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {visibleItems.map((item) => {
                const meta = CATEGORY_META[item.category];
                return (
                  <div
                    key={`${item.targetType}-${item.pattern}`}
                    className="rounded-xl border border-border-subtle bg-surface-elevated/50 p-3.5"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex min-w-0 items-center gap-2">
                            <span className="truncate font-medium text-sm text-text-primary">
                              {item.displayName}
                            </span>
                            {item.displayName !== item.pattern && (
                              <span className="hidden sm:inline text-[11px] font-mono text-text-muted">
                                ({item.pattern})
                              </span>
                            )}
                            <Badge variant={meta.badgeVariant}>{meta.label}</Badge>
                          </div>
                          <span className="shrink-0 text-sm font-semibold tabular-nums text-text-primary">
                            {formatDurationCompact(item.activeSeconds)}
                          </span>
                        </div>

                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface">
                          <div
                            className={cn("h-full rounded-full transition-all", meta.barColor)}
                            style={{ width: `${Math.max(4, item.sharePercent)}%` }}
                          />
                        </div>

                        <div className="flex items-center justify-between text-[11px] text-text-muted">
                          <span>
                            {item.count}{" "}
                            {item.targetType === "website" ? "sessions" : "switches"} ·{" "}
                            {item.sharePercent}% share
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {(["productive", "neutral", "distracting"] as UsageCategory[]).map(
                          (cat) => (
                            <button
                              key={cat}
                              type="button"
                              onClick={() => void handleCategoryChange(item, cat)}
                              disabled={busyAction === `cat-${item.targetType}-${item.pattern}`}
                              className={cn(
                                "rounded-lg border px-2.5 py-1 text-[11px] font-medium capitalize transition-colors cursor-pointer",
                                item.category === cat
                                  ? "border-flame bg-flame/15 text-flame-soft"
                                  : "border-border-subtle bg-surface text-text-muted hover:text-text-primary"
                              )}
                            >
                              {cat}
                            </button>
                          )
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Device Pairing, Paired Devices & Privacy Data Controls */}
      <div className="grid gap-6 lg:grid-cols-12">
        <Card className="lg:col-span-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <KeyRound className="h-4 w-4 text-flame-soft" />
              Pair Extension or Windows Tracker
            </CardTitle>
            <CardDescription className="text-xs">
              Generate a 10-minute one-time pairing code. Ember issues a revocable SHA-256 hashed
              device token.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button
                variant="primary"
                size="sm"
                onClick={() => void handleGeneratePairingCode("chrome_extension")}
                disabled={busyAction === "pair-chrome_extension"}
              >
                <Chrome className="h-4 w-4" />
                Pair Chrome Extension
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => void handleGeneratePairingCode("windows_desktop")}
                disabled={busyAction === "pair-windows_desktop"}
              >
                <Laptop className="h-4 w-4" />
                Pair Windows App Tracker
              </Button>
            </div>

            {pairingInfo && (
              <div className="rounded-xl border border-flame/35 bg-flame/10 p-4 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-[11px] uppercase tracking-wider text-flame-soft">
                      One-Time Code (expires{" "}
                      {new Date(pairingInfo.expiresAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                      )
                    </p>
                    <p className="mt-1 font-mono text-2xl font-bold tracking-widest text-text-primary">
                      {pairingInfo.code}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      void navigator.clipboard.writeText(pairingInfo.code);
                      setCopiedCode(true);
                    }}
                  >
                    {copiedCode ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        Copy
                      </>
                    )}
                  </Button>
                </div>

                {pairingInfo.deviceType === "windows_desktop" ? (
                  <div className="rounded-lg bg-charcoal/80 p-2.5 font-mono text-[11px] text-text-secondary break-all">
                    pnpm --filter @ember/desktop-tracker start pair --code {pairingInfo.code}{" "}
                    --server {originUrl}
                  </div>
                ) : (
                  <p className="text-xs text-text-secondary">
                    Open <strong>Ember Companion → Options &amp; Sync</strong> in Chrome and paste{" "}
                    <code>{pairingInfo.code}</code> with server URL <code>{originUrl}</code>.
                  </p>
                )}
              </div>
            )}

            <div className="border-t border-border-subtle pt-4 flex flex-wrap items-center justify-between gap-2">
              <Button asChild variant="outline" size="sm">
                <a href="/api/export" download="ember-wellbeing-export.json">
                  <Download className="h-3.5 w-3.5" />
                  Export Synced Data
                </a>
              </Button>

              {!confirmClearData ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setConfirmClearData(true)}
                  className="text-rose hover:text-rose"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete Synced Usage
                </Button>
              ) : (
                <div className="flex items-center gap-2">
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => void handleDeleteSyncedData()}
                    disabled={busyAction === "delete-data"}
                  >
                    Confirm Wipe
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setConfirmClearData(false)}
                  >
                    Cancel
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-6">
          <CardHeader>
            <CardTitle className="text-base">Connected Devices</CardTitle>
            <CardDescription className="text-xs">
              Revoking a device immediately blocks future syncs from that token.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {summary.devices.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border-subtle bg-surface-elevated/40 p-5 text-xs text-text-muted">
                No browsers or Windows trackers have been paired yet.
              </div>
            ) : (
              <div className="space-y-2.5">
                {summary.devices.map((device) => (
                  <div
                    key={device.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-border-subtle bg-surface-elevated/60 p-3"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        {device.deviceType === "windows_desktop" ? (
                          <Laptop className="h-4 w-4 text-flame-soft shrink-0" />
                        ) : (
                          <Chrome className="h-4 w-4 text-sky shrink-0" />
                        )}
                        <span className="truncate text-sm font-medium text-text-primary">
                          {device.deviceName}
                        </span>
                        <Badge variant={device.status === "active" ? "emerald" : "neutral"}>
                          {device.status}
                        </Badge>
                      </div>
                      <p className="mt-1 text-[11px] text-text-muted">
                        {device.lastSeenAt
                          ? `Last synced ${new Date(device.lastSeenAt).toLocaleString()}`
                          : "No sync received yet"}
                      </p>
                    </div>

                    {device.status === "active" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void handleRevokeDevice(device.id, device.deviceName)}
                        disabled={busyAction === `revoke-${device.id}`}
                        className="shrink-0 text-rose hover:text-rose"
                      >
                        <Unplug className="h-3.5 w-3.5" />
                        Revoke
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
