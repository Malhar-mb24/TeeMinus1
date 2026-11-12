/**
 * Batch 00 placeholder service worker for the Ember Chrome MV3 extension.
 * Full active-tab/idle hostname aggregation and opt-in pairing will be implemented in Batch 04.
 */

export interface ExtensionFoundationState {
  initializedAt: string;
  trackingEnabled: false;
  syncConsentGranted: false;
}

chrome.runtime.onInstalled.addListener(() => {
  const initialState: ExtensionFoundationState = {
    initializedAt: new Date().toISOString(),
    trackingEnabled: false,
    syncConsentGranted: false,
  };

  void chrome.storage.local.set({ emberFoundationState: initialState });
});
