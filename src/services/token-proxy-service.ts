/**
 * @module token-proxy-service
 * @description Proxies Google OAuth token operations through the notehublm
 *   Callable Cloud Functions instead of calling Google's endpoints directly,
 *   keeping GOOGLE_CLIENT_SECRET on the server and out of the extension bundle.
 *   Calls go through the Firebase Functions SDK (httpsCallable), which attaches
 *   the caller's Firebase ID token automatically so the functions can read
 *   request.auth server-side — no hand-built Authorization header.
 * @dependencies firebase-app, firebase-token-service
 * @public refreshAccessToken, revokeToken, TokenRefreshResult
 */

import { httpsCallable, FunctionsError } from 'firebase/functions';
import { getFirebaseFunctions } from './firebase-app';
import { getFirebaseIdToken } from './firebase-token-service';

export type TokenRefreshResult =
  | { ok: true; accessToken: string; expiresAt: number; scopes: string[]; idToken: undefined }
  | { ok: false; reason: 'invalid_grant' | 'network_error' | 'server_error'; error: string };

interface RefreshCFResult {
  accessToken: string;
  expiresIn: number;
  scope: string;
}

/** Transport-level callable error codes that indicate a recoverable network issue. */
const NETWORK_CODES = new Set(['functions/unavailable', 'functions/deadline-exceeded']);

/**
 * Obtains a new Google OAuth access token by calling the refreshGoogleToken
 * Callable Function. The server uses the stored refresh token + client_secret.
 */
export async function refreshAccessToken(): Promise<TokenRefreshResult> {
  // Classify the session up front: only a genuinely dead/absent session warrants
  // the destructive invalid_grant path. A transient ID-token failure must stay
  // recoverable so an idle-time network blip never forces a sign-out.
  const idTokenResult = await getFirebaseIdToken();
  if (!idTokenResult.ok) {
    if (idTokenResult.reason === 'transient') {
      return {
        ok: false,
        reason: 'network_error',
        error: 'Transient failure obtaining Firebase ID token',
      };
    }
    return {
      ok: false,
      reason: 'invalid_grant',
      error: idTokenResult.reason === 'signed_out'
        ? 'No signed-in Firebase user — user is signed out'
        : 'Firebase session is invalid',
    };
  }

  try {
    const callRefresh = httpsCallable<Record<string, never>, RefreshCFResult>(
      getFirebaseFunctions(),
      'refreshGoogleToken',
    );
    const { data } = await callRefresh({});
    return {
      ok: true,
      accessToken: data.accessToken,
      expiresAt: Date.now() + data.expiresIn * 1000,
      scopes: data.scope ? data.scope.split(' ').filter(Boolean) : [],
      idToken: undefined,
    };
  } catch (err) {
    const code = err instanceof FunctionsError ? err.code : '';
    const details = err instanceof FunctionsError ? err.details : undefined;
    const message = err instanceof Error ? err.message : String(err);

    // A dead Google refresh token: the function throws failed-precondition and
    // signals invalid_grant via the message/details.
    const isInvalidGrant =
      code === 'functions/failed-precondition' ||
      details === 'invalid_grant' ||
      message.includes('invalid_grant');
    if (isInvalidGrant) {
      return { ok: false, reason: 'invalid_grant', error: message };
    }

    if (NETWORK_CODES.has(code)) {
      return { ok: false, reason: 'network_error', error: message };
    }
    return { ok: false, reason: 'server_error', error: message };
  }
}

/**
 * Revokes the stored Google OAuth token by calling the revokeGoogleToken Callable
 * Function. The server reads + revokes the refresh token from Firestore and
 * deletes the doc. Best-effort: a failure must not block sign-out.
 */
export async function revokeToken(): Promise<boolean> {
  const idTokenResult = await getFirebaseIdToken();
  if (!idTokenResult.ok) return true; // No usable session — nothing to revoke.

  try {
    const callRevoke = httpsCallable<Record<string, never>, unknown>(
      getFirebaseFunctions(),
      'revokeGoogleToken',
    );
    await callRevoke({});
    return true;
  } catch (err) {
    // Already revoked / no token on file is success for our purposes.
    if (err instanceof FunctionsError && err.code === 'functions/not-found') return true;
    return false;
  }
}

// Re-export the type under the old name so token-lifecycle-service can import it unchanged
export type { TokenRefreshResult as ProxyRefreshResult };
