/**
 * @module token-proxy-service
 * @description Replaces token-refresh-service. Proxies Google OAuth token operations
 *   through the notehublm Cloud Functions instead of calling Google's endpoints directly.
 *   This keeps GOOGLE_CLIENT_SECRET on the server and out of the extension bundle.
 *   All requests are authenticated using a Firebase ID token (no client_secret needed
 *   for that — only the public Firebase API key is required).
 * @dependencies firebase-token-service, auth-storage-service
 * @public refreshAccessToken, revokeToken, TokenRefreshResult
 */

import { getFirebaseIdToken } from './firebase-token-service';
import { authStorageService } from './auth-storage-service';

const CF_BASE_URL = import.meta.env.VITE_CLOUD_FUNCTIONS_BASE_URL as string ?? '';

const REFRESH_URL = `${CF_BASE_URL}/refreshGoogleToken`;
const REVOKE_URL = `${CF_BASE_URL}/revokeGoogleToken`;

export type TokenRefreshResult =
  | { ok: true; accessToken: string; expiresAt: number; scopes: string[]; idToken: undefined }
  | { ok: false; reason: 'invalid_grant' | 'network_error' | 'server_error'; error: string };

interface RefreshCFResponse {
  accessToken: string;
  expiresIn: number;
  scope: string;
}

/**
 * Obtains a new Google OAuth access token by calling the refreshGoogleToken
 * Cloud Function. The server uses the stored refresh token + client_secret.
 */
export async function refreshAccessToken(): Promise<TokenRefreshResult> {
  const idTokenResult = await getFirebaseIdToken();
  if (!idTokenResult.ok) {
    // Only a genuinely dead refresh token (or being signed out) warrants the
    // destructive invalid_grant path. A transient ID-token failure must stay
    // recoverable so an idle-time network blip never forces a sign-out.
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
        ? 'No Firebase refresh token — user is signed out'
        : 'Firebase refresh token is invalid',
    };
  }
  const idToken = idTokenResult.idToken;

  let response: Response;
  try {
    response = await fetch(REFRESH_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${idToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });
  } catch (err) {
    return {
      ok: false,
      reason: 'network_error',
      error: err instanceof Error ? err.message : String(err),
    };
  }

  // Parse defensively: a 5xx from an upstream proxy may return non-JSON
  // (e.g. an HTML 502). A parse failure must not throw — that would bypass
  // the retry path and surface as an "unexpected error".
  let body: RefreshCFResponse & { error?: string; message?: string };
  try {
    body = await response.json() as RefreshCFResponse & { error?: string; message?: string };
  } catch {
    body = {} as RefreshCFResponse & { error?: string; message?: string };
  }

  if (!response.ok) {
    const reason = body.error === 'invalid_grant' ? 'invalid_grant' : 'server_error';
    return { ok: false, reason, error: body.message ?? body.error ?? `HTTP ${response.status}` };
  }

  return {
    ok: true,
    accessToken: body.accessToken,
    expiresAt: Date.now() + body.expiresIn * 1000,
    scopes: body.scope ? body.scope.split(' ').filter(Boolean) : [],
    idToken: undefined,
  };
}

/**
 * Revokes the stored Google OAuth token by calling the revokeGoogleToken Cloud Function.
 * The server reads + revokes the refresh token from Firestore and deletes the doc.
 * Best-effort: returns true even on server errors to not block sign-out.
 */
export async function revokeToken(): Promise<boolean> {
  const idTokenResult = await getFirebaseIdToken();
  if (!idTokenResult.ok) return true; // No usable ID token — nothing to revoke

  try {
    const response = await fetch(REVOKE_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${idTokenResult.idToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });
    return response.ok || response.status === 404;
  } catch {
    return false;
  }
}

// Re-export the type under the old name so token-lifecycle-service can import it unchanged
export type { TokenRefreshResult as ProxyRefreshResult };
