import { formatDurationCompact } from "@ember/shared";
import { formatLocalDateKey, isTrackingPermitted, type PersistedExtensionState } from "./tracker";

function byId<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing DOM element #${id}`);
  return el as T;
}

function sendExtensionMessage<T = { ok: boolean; state?: PersistedExtensionState; message?: string; error?: string }>(
  message: Record<string, unknown>
): Promise<T> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, (response: T) => resolve(response));
  });
}

function showFeedback(text: string) {
  const banner = byId<HTMLDivElement>("feedback");
  banner.textContent = text;
  banner.hidden = false;
}

function renderState(state: PersistedExtensionState) {
  const pill = byId<HTMLSpanElement>("status-pill");
  const totalEl = byId<HTMLDivElement>("today-total");
  const activeHostEl = byId<HTMLDivElement>("active-host");
  const toggleBtn = byId<HTMLButtonElement>("toggle-pause-btn");
  const syncBadge = byId<HTMLSpanElement>("sync-badge");
  const syncNowBtn = byId<HTMLButtonElement>("sync-now-btn");
  const topSitesEl = byId<HTMLDivElement>("top-sites");

  if (state.settings.paused) {
    pill.textContent = "Paused";
    pill.className = "pill paused";
    toggleBtn.textContent = "Resume Tracking";
  } else if (state.idleState !== "active") {
    pill.textContent = "Idle";
    pill.className = "pill paused";
    toggleBtn.textContent = "Pause Tracking";
  } else if (isTrackingPermitted(state)) {
    pill.textContent = "Tracking";
    pill.className = "pill active";
    toggleBtn.textContent = "Pause Tracking";
  } else {
    pill.textContent = "Standby";
    pill.className = "pill";
    toggleBtn.textContent = "Pause Tracking";
  }

  activeHostEl.textContent = state.activeSession.isIncognito
    ? "Incognito window excluded for privacy"
    : state.activeSession.hostname
      ? `Active site: ${state.activeSession.hostname}`
      : "No trackable HTTP/HTTPS tab active";

  const today = formatLocalDateKey(Date.now());
  const todayHosts = state.dailyUsage[today] ?? {};
  const sorted = Object.entries(todayHosts)
    .map(([hostname, stats]) => ({ hostname, ...stats }))
    .sort((a, b) => b.activeSeconds - a.activeSeconds);

  const totalSeconds = sorted.reduce((acc, item) => acc + item.activeSeconds, 0);
  totalEl.textContent = formatDurationCompact(totalSeconds);

  if (state.settings.deviceToken && state.settings.syncEnabled) {
    syncBadge.textContent = "Sync active";
    syncNowBtn.hidden = false;
  } else if (state.settings.deviceToken) {
    syncBadge.textContent = "Paired (sync off)";
    syncNowBtn.hidden = false;
  } else {
    syncBadge.textContent = "Local only";
    syncNowBtn.hidden = true;
  }

  topSitesEl.replaceChildren();
  const topFive = sorted.slice(0, 5);
  if (topFive.length === 0) {
    const empty = document.createElement("div");
    empty.className = "muted";
    empty.textContent = "Browse any website to see real-time totals here.";
    topSitesEl.appendChild(empty);
    return;
  }

  const maxSeconds = Math.max(1, topFive[0]?.activeSeconds ?? 1);
  for (const item of topFive) {
    const wrapper = document.createElement("div");
    wrapper.className = "site-item";

    const row = document.createElement("div");
    row.className = "site-row";

    const nameSpan = document.createElement("span");
    nameSpan.className = "site-name";
    nameSpan.textContent = item.hostname;

    const timeSpan = document.createElement("span");
    timeSpan.className = "site-time";
    timeSpan.textContent = formatDurationCompact(item.activeSeconds);

    row.append(nameSpan, timeSpan);

    const track = document.createElement("div");
    track.className = "bar-track";
    const fill = document.createElement("div");
    fill.className = "bar-fill";
    fill.style.width = `${Math.max(8, Math.round((item.activeSeconds / maxSeconds) * 100))}%`;
    track.appendChild(fill);

    wrapper.append(row, track);
    topSitesEl.appendChild(wrapper);
  }
}

async function init() {
  const res = await sendExtensionMessage({ type: "GET_STATE" });
  if (res?.state) {
    renderState(res.state);
  }

  byId<HTMLButtonElement>("toggle-pause-btn").addEventListener("click", async () => {
    const current = await sendExtensionMessage({ type: "GET_STATE" });
    const nextPaused = !(current?.state?.settings.paused ?? false);
    const updated = await sendExtensionMessage({ type: "SET_PAUSED", paused: nextPaused });
    if (updated?.state) renderState(updated.state);
  });

  byId<HTMLButtonElement>("open-options-btn").addEventListener("click", () => {
    void chrome.runtime.openOptionsPage();
  });

  byId<HTMLButtonElement>("sync-now-btn").addEventListener("click", async () => {
    showFeedback("Syncing usage summary...");
    const result = await sendExtensionMessage({ type: "SYNC_NOW" });
    if (result?.state) renderState(result.state);
    showFeedback(result?.message ?? (result?.ok ? "Synced." : "Sync failed."));
  });

  byId<HTMLButtonElement>("export-btn").addEventListener("click", async () => {
    const current = await sendExtensionMessage({ type: "GET_STATE" });
    if (!current?.state) return;
    const blob = new Blob([JSON.stringify(current.state.dailyUsage, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `ember-browser-usage-${formatLocalDateKey(Date.now())}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    showFeedback("Exported local usage JSON.");
  });
}

void init();
