/// <reference types="vite/client" />
/**
 * @module token-lifecycle-service
 * @description Orchestrates the full Google OAuth token lifecycle for the extension: validating stored tokens, triggering just-in-time or proactive refreshes, scheduling Chrome alarms to pre-empt expiry, and handling invalid_grant by clearing auth state and notifying open pages. This is the single entry point for any code needing a valid access token; callers do not interact with refresh logic or alarm scheduling directly. A module-level deduplication guard prevents concurrent refresh races.
 * @dependencies auth-storage-service, token-proxy-service
 * @public getValidToken, scheduleRefreshAlarm, handleRefreshAlarm, cancelRefreshAlarm, revokeToken, TOKEN_REFRESH_ALARM, GetTokenResult
 */
/**
 * token-lifecycle-service — orchestrates token validity, proactive refresh, and alarm management.
 *
 * This is the single entry point for any code that needs a valid Google OAuth access token.
 * Callers do not need to know about refresh logic or alarm scheduling.
 *
 * Responsibilities:
 *   - getValidToken(): return a valid token, refreshing just-in-time if near expiry.
 *   - scheduleRefreshAlarm(): arm a Chrome alarm to fire 5 min before token expiry.
 *   - handleRefreshAlarm(): called by background.ts when the alarm fires.
 *   - cancelRefreshAlarm(): called on sign-out to prevent stale alarm firings.
 *
 * Concurrency: a module-level deduplication guard prevents concurrent refresh calls
 * (e.g., alarm firing at the same moment as a just-in-time refresh).
 */

import { authStorageService } from './auth-storage-service';
import { verifyFirebaseIdToken } from './firebase-claims-verifier';
import { refreshAccessToken, revokeToken } from './token-proxy-service';
import type { TokenRefreshResult } from './token-proxy-service';
import { logger } from '@/utils/logger';

export { revokeToken };

export const TOKEN_REFRESH_ALARM = 'token-refresh';

/** Refresh this many milliseconds before token expiry to avoid racing with expiry. */
const LEAD_TIME_MS = 5 * 60 * 1000; // 5 minutes

// ── Transient-failure retry/backoff ────────────────────────────────────────────
//
// The refresh alarm is one-shot. Before this, a transient failure (network blip,
// 5xx, SW torn down mid-fetch) during the proactive refresh left NO alarm armed,
// so the token was never refreshed again and the user was effectively signed out
// on next interaction. Now a transient failure re-arms the alarm with capped
// exponential backoff. The attempt count lives in chrome.storage.session so it
// survives service-worker kills but resets on browser close.

const RETRY_BASE_MS = 60 * 1000; // 1 minute
const RETRY_MAX_MS = 15 * 60 * 1000; // 15 minutes
const RETRY_COUNT_KEY = 'tokenRefreshRetryCount';

const sessionStore = chrome.storage.session as typeof chrome.storage.local;

async function getRetryCount(): Promise<number> {
  const result = await sessionStore.get(RETRY_COUNT_KEY);
  return (result[RETRY_COUNT_KEY] as number) ?? 0;
}

async function clearRetryCount(): Promise<void> {
  await sessionStore.remove(RETRY_COUNT_KEY);
}

/** Re-arms TOKEN_REFRESH_ALARM after a transient failure with capped exponential backoff. */
async function scheduleRetryAlarm(): Promise<void> {
  const attempt = await getRetryCount();
  const delayMs = Math.min(RETRY_BASE_MS * 2 ** attempt, RETRY_MAX_MS);
  await sessionStore.set({ [RETRY_COUNT_KEY]: attempt + 1 });
  console.warn(
    `[TOKEN] Transient refresh failure — retry #${attempt + 1} in ${Math.round(delayMs / 1000)}s`,
  );
  chrome.alarms.create(TOKEN_REFRESH_ALARM, { delayInMinutes: delayMs / 60_000 });
}

const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.appdata';

export type GetTokenResult =
  | { ok: true; accessToken: string; hasDriveScope: boolean }
  | { ok: false; reason: 'not_signed_in' | 'refresh_failed' | 'reauth_required'; error: string };

// ── Concurrency guard ──────────────────────────────────────────────────────────

// Deduplicates concurrent refresh calls (alarm + just-in-time race).
// Both callers await the same in-flight promise and get the same result.
let refreshInProgress: Promise<TokenRefreshResult> | null = null;

// ── Core token operations ──────────────────────────────────────────────────────

/**
 * Returns a valid Google OAuth access token, refreshing proactively if the
 * stored token is within LEAD_TIME_MS of expiry or already expired.
 *
 * Decision tree:
 *   1. Session token present + not near expiry → return immediately (fast path).
 *   2. Session token missing or near expiry → try refresh with stored refresh token.
 *      a. Refresh succeeds → store new session data → return new token.
 *      b. invalid_grant → clear all auth + cancel alarm → return 'reauth_required'.
 *      c. network_error / server_error → return 'refresh_failed' (caller may retry).
 *   3. No refresh token available → return 'not_signed_in'.
 */
export async function getValidToken(): Promise<GetTokenResult> {
  const sessionData = await authStorageService.getAccessToken();
  const isNearExpiry = !sessionData || (sessionData.expiresAt - Date.now() <= LEAD_TIME_MS);

  if (!isNearExpiry) {
    return {
      ok: true,
      accessToken: sessionData!.accessToken,
      hasDriveScope: (sessionData!.scopes ?? []).includes(DRIVE_SCOPE),
    };
  }

  // Needs refresh — deduplicate concurrent calls.
  const refreshResult = await runRefresh();
  if (!refreshResult) {
    return { ok: false, reason: 'not_signed_in', error: 'No refresh token stored' };
  }

  if (refreshResult.ok) {
    return {
      ok: true,
      accessToken: refreshResult.accessToken,
      hasDriveScope: refreshResult.scopes.includes(DRIVE_SCOPE),
    };
  }

  if (refreshResult.reason === 'invalid_grant') {
    await handleInvalidGrant();
    return { ok: false, reason: 'reauth_required', error: refreshResult.error };
  }

  return { ok: false, reason: 'refresh_failed', error: refreshResult.error };
}

// ── Alarm management ───────────────────────────────────────────────────────────

/**
 * Schedules (or re-schedules) the token-refresh alarm to fire LEAD_TIME_MS before
 * the current session token expires. Safe to call multiple times — Chrome's
 * chrome.alarms.create with an existing name overwrites the previous alarm.
 *
 * No-ops silently if there is no session token (e.g., user is signed out or
 * chrome.storage.session was cleared on browser close).
 */
export async function scheduleRefreshAlarm(): Promise<void> {
  const sessionData = await authStorageService.getAccessToken();
  if (!sessionData) return;

  const delayMs = sessionData.expiresAt - Date.now() - LEAD_TIME_MS;
  if (delayMs <= 0) {
    // Token is already expired or within the lead-time window; fire immediately.
    void handleRefreshAlarm();
    return;
  }

  const delayInMinutes = delayMs / 60_000;
  chrome.alarms.create(TOKEN_REFRESH_ALARM, { delayInMinutes });
}

/**
 * Handles a token-refresh alarm firing. Called by the alarm listener in background.ts.
 *
 * Errors are swallowed (with logging) — background alarms must not throw, as there
 * is no caller to catch the rejection.
 */
export async function handleRefreshAlarm(): Promise<void> {
  try {
    const refreshResult = await runRefresh();
    if (!refreshResult) {
      // No refresh token — user is signed out; alarm is stale.
      logger.debug('[TOKEN] Refresh alarm fired but no refresh token found — cancelling alarm');
      await Promise.all([cancelRefreshAlarm(), clearRetryCount()]);
      return;
    }

    if (refreshResult.ok) {
      logger.debug('[TOKEN] Proactive token refresh succeeded, re-arming alarm');
      await scheduleRefreshAlarm(); // runRefresh() already cleared the retry count
      return;
    }

    if (refreshResult.reason === 'invalid_grant') {
      console.warn('[TOKEN] Refresh token invalid — clearing auth state and cancelling alarm');
      await handleInvalidGrant();
      return;
    }

    // network_error or server_error: recoverable. Re-arm the (one-shot) alarm
    // with capped exponential backoff so the refresh actually retries instead
    // of silently stopping forever.
    console.warn('[TOKEN] Proactive refresh failed (will retry with backoff):', refreshResult.error);
    await scheduleRetryAlarm();
  } catch (err) {
    console.error('[TOKEN] Unexpected error in handleRefreshAlarm:', err);
  }
}

/**
 * Cancels the token-refresh alarm. Call on sign-out to prevent stale firings.
 */
export async function cancelRefreshAlarm(): Promise<void> {
  await chrome.alarms.clear(TOKEN_REFRESH_ALARM);
}

// ── Internal helpers ───────────────────────────────────────────────────────────

/**
 * Calls the token proxy (Cloud Function) to get a new access token.
 * Returns null if the user is not signed in (no Firebase refresh token).
 * Deduplicates concurrent calls via the module-level guard.
 */
async function runRefresh(): Promise<TokenRefreshResult | null> {
  const firebaseRefreshToken = await authStorageService.getFirebaseRefreshToken();
  if (!firebaseRefreshToken) return null;

  if (!refreshInProgress) {
    refreshInProgress = refreshAccessToken()
      .finally(() => { refreshInProgress = null; });
  }

  const result = await refreshInProgress;

  if (result.ok) {
    // Any successful refresh (proactive or just-in-time) clears the backoff.
    await clearRetryCount();
    await authStorageService.saveSessionToken(
      result.accessToken,
      result.expiresAt,
      result.scopes,
    );
    // Re-verify and update subscription claims when the refresh response includes a new ID token.
    if (result.idToken) {
      verifyFirebaseIdToken(result.idToken).then((claimsResult) => {
        if (claimsResult.ok) {
          void authStorageService.saveAuthClaims(claimsResult.claims);
        }
      }).catch(() => {});
    }
  }

  return result;
}

/**
 * Handles an invalid_grant response: clears all auth data, cancels the alarm,
 * and notifies any open extension pages that re-authentication is required.
 */
async function handleInvalidGrant(): Promise<void> {
  await Promise.all([
    authStorageService.clearAll(),
    cancelRefreshAlarm(),
    clearRetryCount(),
  ]);
  // Best-effort notify open popup/dashboard — ignore if no receiver is open.
  chrome.runtime.sendMessage({ type: 'REAUTH_REQUIRED' }).catch(() => {});
}
