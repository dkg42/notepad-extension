/**
 * @module firebase-token-service
 * @description Manages Firebase ID token lifecycle in the extension background context.
 *   Refreshes Firebase ID tokens via the securetoken.googleapis.com REST endpoint using
 *   the stored Firebase refresh token. No client_secret is required — Firebase refresh
 *   tokens are designed for client-side storage and the securetoken endpoint only needs
 *   the public Firebase API key. The current ID token is cached in chrome.storage.session.
 *   Failures are classified so callers can distinguish a recoverable hiccup (network /
 *   5xx / rate-limit) from a genuinely dead refresh token — only the latter should ever
 *   trigger a forced sign-out.
 * @dependencies auth-storage-service
 * @public getFirebaseIdToken, FirebaseIdTokenResult
 */

import { authStorageService } from './auth-storage-service';

const SECURETOKEN_ENDPOINT = 'https://securetoken.googleapis.com/v1/token';
const FIREBASE_API_KEY = import.meta.env.VITE_FIREBASE_API_KEY as string ?? '';

const FIREBASE_ID_TOKEN_CACHE_KEY = 'firebaseIdTokenCache';
/** Refresh the cached ID token this many ms before it expires to avoid races. */
const LEAD_TIME_MS = 5 * 60 * 1000;

interface FirebaseIdTokenCache {
  idToken: string;
  expiresAt: number; // Unix ms
}

interface SecureTokenResponse {
  id_token: string;
  refresh_token: string;
  expires_in: string; // seconds as string
}

/**
 * Result of an ID-token fetch.
 *
 * `reason` discriminates failure modes so callers never treat a recoverable
 * hiccup as a dead session:
 *   - `transient`  — network error, 5xx, or 429. Retry later; auth is fine.
 *   - `invalid`    — the refresh token is genuinely dead (revoked/expired/
 *                    disabled user). Re-authentication is required.
 *   - `signed_out` — no Firebase refresh token stored (user is not signed in).
 */
export type FirebaseIdTokenResult =
  | { ok: true; idToken: string }
  | { ok: false; reason: 'transient' | 'invalid' | 'signed_out' };

/**
 * securetoken.googleapis.com error-body message values that indicate the
 * refresh token itself is permanently unusable. Anything else (including
 * any 5xx / 429 / network failure) is treated as transient.
 * @see https://firebase.google.com/docs/reference/rest/auth#section-refresh-token
 */
const INVALID_REFRESH_TOKEN_ERRORS = new Set([
  'INVALID_REFRESH_TOKEN',
  'TOKEN_EXPIRED',
  'USER_DISABLED',
  'USER_NOT_FOUND',
  'MISSING_REFRESH_TOKEN',
  'INVALID_GRANT_TYPE',
]);

interface SecureTokenErrorBody {
  error?: { message?: string };
}

// ── Cache helpers ──────────────────────────────────────────────────────────────

async function getCachedIdToken(): Promise<FirebaseIdTokenCache | null> {
  const result = await (chrome.storage.session as typeof chrome.storage.local).get(FIREBASE_ID_TOKEN_CACHE_KEY);
  return (result[FIREBASE_ID_TOKEN_CACHE_KEY] as FirebaseIdTokenCache) ?? null;
}

async function setCachedIdToken(idToken: string, expiresAt: number): Promise<void> {
  await (chrome.storage.session as typeof chrome.storage.local).set({
    [FIREBASE_ID_TOKEN_CACHE_KEY]: { idToken, expiresAt } satisfies FirebaseIdTokenCache,
  });
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Returns a valid Firebase ID token, refreshing it if expired or near expiry.
 *
 * The result discriminates failure modes (see {@link FirebaseIdTokenResult}):
 * a network blip, 5xx, or 429 is `transient` (the caller must retry, NOT sign
 * the user out); only a genuinely dead refresh token is `invalid`.
 */
export async function getFirebaseIdToken(): Promise<FirebaseIdTokenResult> {
  const cache = await getCachedIdToken();
  if (cache && cache.expiresAt - Date.now() > LEAD_TIME_MS) {
    return { ok: true, idToken: cache.idToken };
  }

  const refreshToken = await authStorageService.getFirebaseRefreshToken();
  if (!refreshToken) return { ok: false, reason: 'signed_out' };

  let response: Response;
  try {
    response = await fetch(`${SECURETOKEN_ENDPOINT}?key=${FIREBASE_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    });
  } catch (err) {
    // Network failure / service worker torn down mid-fetch — recoverable.
    console.warn('[FIREBASE-TOKEN] Network error refreshing ID token (transient):', err);
    return { ok: false, reason: 'transient' };
  }

  if (!response.ok) {
    const errorMessage = await readSecureTokenError(response);
    const isDeadToken =
      response.status === 400 && errorMessage !== null &&
      INVALID_REFRESH_TOKEN_ERRORS.has(errorMessage);

    if (isDeadToken) {
      console.warn('[FIREBASE-TOKEN] Refresh token rejected (invalid):', errorMessage);
      return { ok: false, reason: 'invalid' };
    }

    // 5xx, 429, or any other non-OK status: treat as recoverable so a
    // transient outage never forces a sign-out.
    console.warn(
      `[FIREBASE-TOKEN] ID token refresh failed (transient): HTTP ${response.status}`,
      errorMessage ?? '',
    );
    return { ok: false, reason: 'transient' };
  }

  const data = await response.json() as SecureTokenResponse;
  const expiresAt = Date.now() + parseInt(data.expires_in, 10) * 1000;
  await setCachedIdToken(data.id_token, expiresAt);

  // If the refresh token was rotated, persist the new one
  if (data.refresh_token && data.refresh_token !== refreshToken) {
    await authStorageService.saveFirebaseRefreshToken(data.refresh_token);
  }

  return { ok: true, idToken: data.id_token };
}

/** Best-effort parse of the securetoken error body's `error.message` field. */
async function readSecureTokenError(response: Response): Promise<string | null> {
  try {
    const body = await response.json() as SecureTokenErrorBody;
    return body.error?.message ?? null;
  } catch {
    return null;
  }
}

/** Clears the cached Firebase ID token (call on sign-out). */
export async function clearFirebaseIdTokenCache(): Promise<void> {
  await (chrome.storage.session as typeof chrome.storage.local).remove(FIREBASE_ID_TOKEN_CACHE_KEY);
}
