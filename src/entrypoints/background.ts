import { defineBackground } from 'wxt/sandbox';

/**
 * Background service worker.
 *
 * ── Future: Google Docs sync ─────────────────────────────────────────────────
 * When direct Google Drive sync is enabled:
 *   1. Add `identity` permission and `oauth2` block to wxt.config.ts manifest.
 *   2. Uncomment the message listener below.
 *   3. Update GoogleDocExportStrategy to send { type: 'GET_GOOGLE_AUTH_TOKEN' }
 *      and use the returned token to POST to the Drive API.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export default defineBackground(() => {
  // chrome.runtime.onMessage.addListener(
  //   (message: unknown, _sender, sendResponse: (r: unknown) => void) => {
  //     if (!isMessage(message)) return false;
  //     if (message.type === 'GET_GOOGLE_AUTH_TOKEN') {
  //       chrome.identity.getAuthToken({ interactive: true }, (token) => {
  //         if (chrome.runtime.lastError || !token) {
  //           sendResponse({ error: chrome.runtime.lastError?.message ?? 'Auth cancelled' });
  //         } else {
  //           sendResponse({ token });
  //         }
  //       });
  //       return true; // keep channel open for async callback
  //     }
  //     return false;
  //   },
  // );
});

// function isMessage(value: unknown): value is { type: string } {
//   return typeof value === 'object' && value !== null && 'type' in value;
// }
