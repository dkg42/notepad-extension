/**
 * @module firebase-token-service
 * @description Returns a valid Firebase ID token for the signed-in user, sourced
 *   from the Firebase Auth SDK (`auth.currentUser.getIdToken()`). The SDK caches
 *   and refreshes the token internally, so this module no longer talks to the
 *   securetoken REST endpoint or maintains its own cache. Failures are classified
 *   so callers can distinguish a recoverable hiccup (network) from a genuinely
 *   dead session (re-auth required) from a signed-out state — only a dead session
 *   should ever force a sign-out.
 * @dependencies firebase-app
 * @public getFirebaseIdToken, FirebaseIdTokenResult
 */

import { FirebaseError } from 'firebase/app';
import { getFirebaseAuth, whenAuthReady } from './firebase-app';

/**
 * Result of an ID-token fetch.
 *
 * `reason` discriminates failure modes so callers never treat a recoverable
 * hiccup as a dead session:
 *   - `transient`  — network error or any ambiguous SDK failure. Retry later;
 *                    the session is fine.
 *   - `invalid`    — the session is genuinely dead (revoked / disabled / expired
 *                    credential). Re-authentication is required.
 *   - `signed_out` — no signed-in Firebase user (user is not signed in, or a
 *                    pre-SDK session has not been re-established yet).
 */
export type FirebaseIdTokenResult =
  | { ok: true; idToken: string }
  | { ok: false; reason: 'transient' | 'invalid' | 'signed_out' };

/**
 * Firebase Auth error codes that mean the session is permanently unusable.
 * Anything else — most importantly `auth/network-request-failed` — is treated as
 * transient so an idle-time network blip never forces a sign-out.
 * @see https://firebase.google.com/docs/auth/admin/errors
 */
const INVALID_SESSION_CODES = new Set([
  'auth/user-token-expired',
  'auth/user-disabled',
  'auth/user-not-found',
  'auth/invalid-user-token',
  'auth/requires-recent-login',
]);

/**
 * Returns a valid Firebase ID token, refreshing via the SDK if near expiry.
 *
 * The result discriminates failure modes (see {@link FirebaseIdTokenResult}):
 * a network failure is `transient` (the caller must retry, NOT sign the user
 * out); a revoked/disabled session is `invalid`; no signed-in user is
 * `signed_out`.
 */
export async function getFirebaseIdToken(): Promise<FirebaseIdTokenResult> {
  await whenAuthReady();
  const user = getFirebaseAuth().currentUser;
  if (!user) return { ok: false, reason: 'signed_out' };

  try {
    const idToken = await user.getIdToken();
    return { ok: true, idToken };
  } catch (err) {
    const code = err instanceof FirebaseError ? err.code : '';
    if (INVALID_SESSION_CODES.has(code)) {
      console.warn('[FIREBASE-TOKEN] Session rejected (invalid):', code);
      return { ok: false, reason: 'invalid' };
    }
    // Network failure / service worker torn down mid-refresh / anything
    // ambiguous — recoverable. Never force a sign-out on an unclear error.
    console.warn('[FIREBASE-TOKEN] ID token fetch failed (transient):', code || err);
    return { ok: false, reason: 'transient' };
  }
}
