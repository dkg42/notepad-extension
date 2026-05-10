/**
 * @module firebase-token-service
 * @description Manages Firebase ID token lifecycle in the extension background context.
 *   Refreshes Firebase ID tokens via the securetoken.googleapis.com REST endpoint using
 *   the stored Firebase refresh token. No client_secret is required — Firebase refresh
 *   tokens are designed for client-side storage and the securetoken endpoint only needs
 *   the public Firebase API key. The current ID token is cached in chrome.storage.session.
 * @dependencies auth-storage-service
 * @public getFirebaseIdToken
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
 * Returns null if no Firebase refresh token is stored (user is signed out).
 */
export async function getFirebaseIdToken(): Promise<string | null> {
  const cache = await getCachedIdToken();
  if (cache && cache.expiresAt - Date.now() > LEAD_TIME_MS) {
    return cache.idToken;
  }

  const refreshToken = await authStorageService.getFirebaseRefreshToken();
  if (!refreshToken) return null;

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
    console.error('[FIREBASE-TOKEN] Network error refreshing ID token:', err);
    return null;
  }

  if (!response.ok) {
    console.error('[FIREBASE-TOKEN] Failed to refresh ID token:', response.status);
    return null;
  }

  const data = await response.json() as SecureTokenResponse;
  const expiresAt = Date.now() + parseInt(data.expires_in, 10) * 1000;
  await setCachedIdToken(data.id_token, expiresAt);

  // If the refresh token was rotated, persist the new one
  if (data.refresh_token && data.refresh_token !== refreshToken) {
    await authStorageService.saveFirebaseRefreshToken(data.refresh_token);
  }

  return data.id_token;
}

/** Clears the cached Firebase ID token (call on sign-out). */
export async function clearFirebaseIdTokenCache(): Promise<void> {
  await (chrome.storage.session as typeof chrome.storage.local).remove(FIREBASE_ID_TOKEN_CACHE_KEY);
}
