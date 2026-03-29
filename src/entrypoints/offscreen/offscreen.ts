/**
 * Offscreen document — Firebase auth iframe bridge.
 *
 * This document is created by the background service worker when sign-in is
 * triggered. It embeds the externally hosted sign-in page in a hidden iframe,
 * which can load Firebase Auth and open a Google sign-in popup (something a
 * service worker cannot do directly).
 *
 * Message flow:
 *   background  →(chrome.runtime.sendMessage)→  this script
 *   this script →(iframe postMessage)→  externally hosted page
 *   externally hosted page →(window postMessage)→  this script
 *   this script →(sendResponse)→  background
 */

import { OAuthProvider } from 'firebase/auth/web-extension';

const EXTERNAL_AUTH_URL = 'https://localhost:3000/auth';
const EXTERNAL_AUTH_ORIGIN = 'https://localhost:3000';

console.log('[AUTH][Offscreen] Script loaded');

// ── Create the iframe eagerly so the page loads before auth is triggered ──────
// The offscreen document is reused across auth flows (not recreated each time),
// so the iframe will typically already be loaded when auth is triggered.

const iframe = document.createElement('iframe');
iframe.src = EXTERNAL_AUTH_URL;
// Track readiness so we never postMessage before the page's listener is registered
let iframeReady = false;

iframe.addEventListener('load', () => {
  iframeReady = true;
  console.log('[AUTH][Offscreen] iframe loaded and ready:', EXTERNAL_AUTH_URL);
});
iframe.addEventListener('error', (e) => {
  console.error('[AUTH][Offscreen] iframe failed to load:', e);
});

document.documentElement.appendChild(iframe);
console.log('[AUTH][Offscreen] iframe appended, src:', EXTERNAL_AUTH_URL);

// ── Message relay from background → iframe → background ───────────────────────

chrome.runtime.onMessage.addListener(
  (
    message: unknown,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (r: unknown) => void,
  ) => {
    console.log('[AUTH][Offscreen] chrome.runtime.onMessage received:', message);

    if (
      typeof message !== 'object' ||
      message === null ||
      (message as { target?: string }).target !== 'offscreen'
    ) {
      console.log('[AUTH][Offscreen] Message not targeted at offscreen, ignoring');
      return false;
    }

    const msg = message as { type: string; target: string };

    if (msg.type === 'firebase-auth') {
      console.log('[AUTH][Offscreen] Handling firebase-auth, iframe ready:', iframeReady);

      // ACK immediately so Chrome does not hold the request channel open.
      // The actual auth result is delivered via a separate chrome.runtime.sendMessage
      // once the iframe completes the Google sign-in flow.
      sendResponse({ ack: true });

      // One-time listener for the postMessage result from the iframe
      const handleIframeMessage = (event: MessageEvent) => {
        console.log('[AUTH][Offscreen] window.message received — origin:', event.origin, 'data:', event.data);
        // Only accept messages from the known auth origin — prevents spoofing
        if (event.origin !== EXTERNAL_AUTH_ORIGIN) {
          console.log('[AUTH][Offscreen] Ignoring message from unexpected origin:', event.origin);
          return;
        }

        // event.data is a JSON string — parse it before inspecting
        let parsed: { type?: string; payload?: unknown };
        try {
          parsed = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        } catch {
          console.log('[AUTH][Offscreen] Ignoring non-JSON message:', event.data);
          return;
        }

        // Guard: only handle the specific auth-response event; ignore all others
        // (the iframe may emit unrelated postMessages that must not remove this listener)
        if (parsed.type !== 'notehub:auth-response') {
          console.log('[AUTH][Offscreen] Ignoring unrelated message type:', parsed.type);
          return;
        }

        window.removeEventListener('message', handleIframeMessage);

        const payload = parsed.payload as { credential?: Record<string, unknown>; error?: string } | null;

        // Send the auth result back as a new message — the original request
        // channel is already closed (ACK above), so sendResponse can't be reused.
        if (!payload || payload.error) {
          const error = payload?.error ?? 'Unknown auth error';
          console.error('[AUTH][Offscreen] iframe returned error:', error);
          chrome.runtime.sendMessage({ type: 'AUTH_RESULT', ok: false, error }).catch(
            (err: unknown) => console.error('[AUTH][Offscreen] Failed to relay AUTH_RESULT error:', err),
          );
        } else {
          // Reconstruct a Firebase OAuthCredential from the serialised credential fields
          // so the background can call signInWithCredential directly.
          let credentialJSON: unknown = payload;
          if (payload.credential && typeof payload.credential === 'object') {
            const raw = payload.credential as { providerId?: string };
            if (raw.providerId) {
              const reconstructed = OAuthProvider.credentialFromJSON(payload.credential);
              if (reconstructed) {
                credentialJSON = reconstructed.toJSON();
              }
            }
          }
          console.log('[AUTH][Offscreen] iframe returned success, relaying credential');
          chrome.runtime.sendMessage({ type: 'AUTH_RESULT', ok: true, result: credentialJSON }).catch(
            (err: unknown) => console.error('[AUTH][Offscreen] Failed to relay AUTH_RESULT success:', err),
          );
        }
      };

      window.addEventListener('message', handleIframeMessage);

      const triggerAuth = () => {
        console.log('[AUTH][Offscreen] postMessage({ initAuth: true }) sent to iframe');
        iframe.contentWindow?.postMessage({ initAuth: true }, new URL(EXTERNAL_AUTH_URL).origin);
      };

      // Wait for iframe to finish loading before triggering — if we postMessage
      // before the external page's event listener is registered, the message is lost.
      if (iframeReady) {
        triggerAuth();
      } else {
        console.log('[AUTH][Offscreen] iframe not yet ready, waiting for load event...');
        iframe.addEventListener('load', triggerAuth, { once: true });
      }

      // Return false — sendResponse was already called synchronously (ACK).
      return false;
    }

    return false;
  },
);
