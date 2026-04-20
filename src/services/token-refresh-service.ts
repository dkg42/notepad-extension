/**
 * token-refresh-service — pure HTTP I/O for Google OAuth2 token operations.
 *
 * Responsibilities:
 *   - Exchange a refresh token for a new access token via Google's token endpoint.
 *   - Revoke a token (access or refresh) via Google's revoke endpoint.
 *
 * This service has NO dependency on chrome.storage or any other extension service.
 * All orchestration (reading/writing storage, scheduling alarms) lives in
 * token-lifecycle-service.ts.
 *
 * Security: The client_secret is injected at build time via the VITE_GOOGLE_CLIENT_SECRET
 * env var. Store it in a .env.local file (not committed to git). This is the documented
 * pattern for Chrome extensions using web application OAuth credentials — the secret is
 * technically recoverable from the bundle, but the risk is mitigated by the token being
 * bound to the signed-in user and requiring explicit OAuth consent.
 *
 * TODO: Move token refresh to the webapp (BFF). Add a /auth/token/refresh endpoint that
 * holds client_secret server-side. The extension should POST the refresh token to that
 * endpoint and receive a new access token in return. This removes VITE_GOOGLE_CLIENT_SECRET
 * from the extension bundle entirely.
 */

import type { GoogleTokenRefreshResponse } from '@/types';

const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const REVOKE_ENDPOINT = 'https://oauth2.googleapis.com/revoke';

export type TokenRefreshResult =
  | { ok: true; accessToken: string; expiresAt: number; scopes: string[] }
  | { ok: false; reason: 'invalid_grant' | 'network_error' | 'server_error'; error: string };

/**
 * Exchanges a Google OAuth refresh token for a new access token.
 *
 * Uses the "refresh_token" grant type against https://oauth2.googleapis.com/token.
 * The clientId and clientSecret must correspond to the web application OAuth credential
 * that was used during the initial sign-in flow in the BFF.
 *
 * @returns TokenRefreshResult — on success includes the new access token, exact expiry,
 *          and the space-separated granted scopes parsed into an array.
 */
export async function refreshAccessToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string,
): Promise<TokenRefreshResult> {
  let response: Response;

  try {
    response = await fetch(TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });
  } catch (err) {
    return {
      ok: false,
      reason: 'network_error',
      error: err instanceof Error ? err.message : String(err),
    };
  }

  if (!response.ok) {
    let reason: 'invalid_grant' | 'network_error' | 'server_error' = 'server_error';
    let errorText = `HTTP ${response.status}`;

    try {
      const body = await response.json() as { error?: string; error_description?: string };
      if (body.error === 'invalid_grant') {
        reason = 'invalid_grant';
      }
      errorText = body.error_description ?? body.error ?? errorText;
    } catch {
      // Response body is not JSON — use the HTTP status text
      errorText = response.statusText || errorText;
    }

    return { ok: false, reason, error: errorText };
  }

  const data = await response.json() as GoogleTokenRefreshResponse;
  return {
    ok: true,
    accessToken: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
    scopes: data.scope ? data.scope.split(' ').filter(Boolean) : [],
  };
}

/**
 * Revokes a Google OAuth token (access token or refresh token).
 *
 * Revoking the refresh token is preferred — it invalidates the entire OAuth grant
 * and all access tokens derived from it. Revoking an access token only invalidates
 * that single short-lived token.
 *
 * This is best-effort: returns true even if Google returns 400 (token already
 * expired or revoked). Returns false only on unexpected server/network errors.
 *
 * @param token  The access token or refresh token to revoke.
 */
export async function revokeToken(token: string): Promise<boolean> {
  try {
    const response = await fetch(REVOKE_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token }),
    });

    // 200 = successfully revoked; 400 = already expired/revoked — both are acceptable.
    return response.ok || response.status === 400;
  } catch {
    return false;
  }
}
