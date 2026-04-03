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
// iframeReadyPromise resolves when the iframe's useEffect posts 'notehub:iframe-ready',
// guaranteeing listeners are registered before we send any auth trigger.
let iframeReadyResolve: (() => void) | null = null;
let iframeReadyPromise = new Promise<void>((resolve) => { iframeReadyResolve = resolve; });

// On reload (e.g., unexpected navigation), reset the promise so the next auth call
// waits for the new React mount to complete its useEffect.
iframe.addEventListener('load', () => {
  console.log('[AUTH][Offscreen] iframe load event — awaiting useEffect handshake');
  if (iframeReadyResolve === null) {
    // Previous promise already resolved; create a fresh one for the next auth trigger.
    iframeReadyPromise = new Promise<void>((resolve) => { iframeReadyResolve = resolve; });
  }
});

// Two-way handshake: resolve only when the iframe confirms its listeners are active.
window.addEventListener('message', (event: MessageEvent) => {
  if (event.origin !== EXTERNAL_AUTH_ORIGIN) return;
  let parsed: { type?: string };
  try {
    parsed = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
  } catch { return; }
  if (parsed.type !== 'notehub:iframe-ready') return;
  console.log('[AUTH][Offscreen] iframe truly ready (useEffect listeners registered)');
  iframeReadyResolve?.();
  iframeReadyResolve = null;
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

    if (msg.type === 'firebase-sign-out') {
      console.log('[AUTH][Offscreen] Handling firebase-sign-out');

      sendResponse({ ack: true });

      const handleSignOutMessage = (event: MessageEvent) => {
        console.log('[AUTH][Offscreen] window.message received (sign-out) — origin:', event.origin, 'data:', event.data);
        if (event.origin !== EXTERNAL_AUTH_ORIGIN) {
          console.log('[AUTH][Offscreen] Ignoring message from unexpected origin:', event.origin);
          return;
        }

        let parsed: { type?: string; payload?: unknown };
        try {
          parsed = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        } catch {
          console.log('[AUTH][Offscreen] Ignoring non-JSON message:', event.data);
          return;
        }

        if (parsed.type !== 'notehub:sign-out-response') {
          console.log('[AUTH][Offscreen] Ignoring unrelated message type:', parsed.type);
          return;
        }

        window.removeEventListener('message', handleSignOutMessage);

        const payload = parsed.payload as { error?: string } | null;
        if (!payload || payload.error) {
          const error = payload?.error ?? 'Unknown sign-out error';
          console.error('[AUTH][Offscreen] iframe returned sign-out error:', error);
          chrome.runtime.sendMessage({ type: 'SIGN_OUT_RESULT', ok: false, error }).catch(
            (err: unknown) => console.error('[AUTH][Offscreen] Failed to relay SIGN_OUT_RESULT error:', err),
          );
        } else {
          console.log('[AUTH][Offscreen] iframe sign-out succeeded, relaying result');
          chrome.runtime.sendMessage({ type: 'SIGN_OUT_RESULT', ok: true }).catch(
            (err: unknown) => console.error('[AUTH][Offscreen] Failed to relay SIGN_OUT_RESULT success:', err),
          );
        }
      };

      window.addEventListener('message', handleSignOutMessage);

      const triggerSignOut = () => {
        console.log('[AUTH][Offscreen] postMessage({ signOut: true }) sent to iframe');
        iframe.contentWindow?.postMessage({ signOut: true }, EXTERNAL_AUTH_ORIGIN);
      };

      console.log('[AUTH][Offscreen] Awaiting iframe-ready before triggering sign-out');
      iframeReadyPromise.then(triggerSignOut);

      return false;
    }

    if (msg.type === 'firebase-auth') {
      console.log('[AUTH][Offscreen] Handling firebase-auth');

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

        // The iframe may post either a structured result ({ credential, ... })
        // or a raw FirebaseError object ({ code, name, customData }) when the
        // user cancels or an error occurs. Handle both shapes.
        const payload = parsed.payload as {
          credential?: Record<string, unknown>;
          error?: string;
          code?: string;   // present when iframe posts a FirebaseError directly
          name?: string;   // "FirebaseError"
        } | null;

        // Detect a FirebaseError posted directly as the payload (e.g. auth/user-cancelled).
        // FirebaseError objects have a `code` like "auth/<reason>" but no `error` string.
        const payloadIsFirebaseError =
          payload !== null &&
          typeof payload.code === 'string' &&
          payload.code.startsWith('auth/');

        // Send the auth result back as a new message — the original request
        // channel is already closed (ACK above), so sendResponse can't be reused.
        if (!payload || payload.error || payloadIsFirebaseError) {
          const error = payload?.code ?? payload?.error ?? 'Unknown auth error';
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
        iframe.contentWindow?.postMessage({ initAuth: true }, EXTERNAL_AUTH_ORIGIN);
      };

      console.log('[AUTH][Offscreen] Awaiting iframe-ready before triggering auth');
      iframeReadyPromise.then(triggerAuth);

      // Return false — sendResponse was already called synchronously (ACK).
      return false;
    }

    return false;
  },
);
