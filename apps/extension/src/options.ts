import { formatDurationCompact } from "@ember/shared";
import { formatLocalDateKey, type PersistedExtensionState } from "./tracker";

function byId<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing DOM element #${id}`);
  return el as T;
}

function sendExtensionMessage<
  T = { ok: boolean; state?: PersistedExtensionState; message?: string; error?: string },
>(message: Record<string, unknown>): Promise<T> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, (response: T) => resolve(response));
  });
}

function showFeedback(text: string) {
  const banner = byId<HTMLDivElement>("options-feedback");
  banner.textContent = text;
  banner.hidden = false;
}

function renderOptions(state: PersistedExtensionState) {
  const pill = byId<HTMLSpanElement>("pair-status-pill");
  const apiUrlInput = byId<HTMLInputElement>("api-base-url");
  const idleInput = byId<HTMLInputElement>("idle-seconds");
  const consentCheckbox = byId<HTMLInputElement>("sync-consent-checkbox");
  const deviceNameInput = byId<HTMLInputElement>("device-name-input");
  const localSummary = byId<HTMLParagraphElement>("local-summary");

  apiUrlInput.value = state.settings.apiBaseUrl;
  idleInput.value = String(state.settings.idleDetectionSeconds || 60);
  consentCheckbox.checked = state.settings.syncEnabled;
  deviceNameInput.value = state.settings.deviceName || "Chrome Desktop";

  if (state.settings.deviceToken) {
    pill.textContent = state.settings.syncEnabled
      ? `Paired: ${state.settings.deviceName} (Sync On)`
      : `Paired: ${state.settings.deviceName} (Sync Off)`;
    pill.className = state.settings.syncEnabled ? "pill active" : "pill paused";
  } else {
    pill.textContent = "Unpaired (Local Only)";
    pill.className = "pill";
  }

  let totalSeconds = 0;
  const hostSet = new Set<string>();
  const daysCount = Object.keys(state.dailyUsage).length;
  for (const dayHosts of Object.values(state.dailyUsage)) {
    for (const [host, usage] of Object.entries(dayHosts)) {
      hostSet.add(host);
      totalSeconds += usage.activeSeconds;
    }
  }

  const syncLine = state.settings.lastSyncedAt
    ? ` Last synced: ${new Date(state.settings.lastSyncedAt).toLocaleString()}.`
    : "";
  const errorLine = state.settings.lastSyncError
    ? ` Last sync notice: ${state.settings.lastSyncError}`
    : "";

  localSummary.textContent = `${daysCount} tracked day(s), ${hostSet.size} hostname(s), ${formatDurationCompact(totalSeconds)} total.${syncLine}${errorLine}`;
}

async function init() {
  const res = await sendExtensionMessage({ type: "GET_STATE" });
  if (res?.state) renderOptions(res.state);

  byId<HTMLButtonElement>("save-settings-btn").addEventListener("click", async () => {
    const apiBaseUrl = byId<HTMLInputElement>("api-base-url").value.trim();
    const idleDetectionSeconds = Number(byId<HTMLInputElement>("idle-seconds").value) || 60;
    const syncEnabled = byId<HTMLInputElement>("sync-consent-checkbox").checked;

    const updated = await sendExtensionMessage({
      type: "UPDATE_SETTINGS",
      patch: {
        apiBaseUrl: apiBaseUrl || "https://ember-nine-flame.vercel.app",
        idleDetectionSeconds,
        syncEnabled,
      },
    });
    if (updated?.state) renderOptions(updated.state);
    showFeedback("Preferences saved locally.");
  });

  byId<HTMLButtonElement>("pair-btn").addEventListener("click", async () => {
    const pairingCode = byId<HTMLInputElement>("pairing-code-input").value.trim();
    const deviceName = byId<HTMLInputElement>("device-name-input").value.trim() || "Chrome Desktop";
    const apiBaseUrl =
      byId<HTMLInputElement>("api-base-url").value.trim() || "https://ember-nine-flame.vercel.app";

    if (!pairingCode) {
      showFeedback("Enter the pairing code generated in Ember Wellbeing first.");
      return;
    }

    showFeedback("Pairing browser with Ember...");
    const result = await sendExtensionMessage({
      type: "PAIR_DEVICE",
      pairingCode,
      deviceName,
      apiBaseUrl,
    });
    if (result?.state) renderOptions(result.state);
    if (result?.ok) {
      byId<HTMLInputElement>("pairing-code-input").value = "";
      showFeedback("Paired successfully! Cloud sync is now enabled for this browser.");
    } else {
      showFeedback(result?.error ?? "Pairing failed.");
    }
  });

  byId<HTMLButtonElement>("sync-btn").addEventListener("click", async () => {
    showFeedback("Uploading anonymized daily domain totals...");
    const result = await sendExtensionMessage({ type: "SYNC_NOW" });
    if (result?.state) renderOptions(result.state);
    showFeedback(result?.message ?? (result?.ok ? "Synced." : "Sync failed."));
  });

  byId<HTMLButtonElement>("unpair-btn").addEventListener("click", async () => {
    const result = await sendExtensionMessage({ type: "UNPAIR_DEVICE" });
    if (result?.state) renderOptions(result.state);
    showFeedback("Disconnected local token from Ember sync.");
  });

  byId<HTMLButtonElement>("export-local-btn").addEventListener("click", async () => {
    const current = await sendExtensionMessage({ type: "GET_STATE" });
    if (!current?.state) return;
    const blob = new Blob([JSON.stringify(current.state.dailyUsage, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `ember-extension-usage-${formatLocalDateKey(Date.now())}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  });

  byId<HTMLButtonElement>("clear-local-btn").addEventListener("click", async () => {
    const result = await sendExtensionMessage({ type: "CLEAR_DATA" });
    if (result?.state) renderOptions(result.state);
    showFeedback("Cleared all local extension tracking data.");
  });
}

void init();
