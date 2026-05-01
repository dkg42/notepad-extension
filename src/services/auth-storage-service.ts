/**
 * @module auth-storage-service
 * @description Single source of truth for all auth-related chrome.storage reads and writes, spanning three storage areas: authProfile (plaintext user identity) in chrome.storage.local, the AES-GCM encrypted Google OAuth refresh token in chrome.storage.local, and the volatile session access token in chrome.storage.session (cleared on browser close). Centralising storage here ensures the token encryption contract and storage-area split are enforced consistently across background, popup, and dashboard contexts.
 * @dependencies token-crypto-service
 * @public authStorageService, OAuthCredentialPayload
 */
/**
 * Auth storage service — single source of truth for all auth-related storage.
 *
 * Storage split:
 *   chrome.storage.local   → authProfile (plaintext profile, persists across restarts)
 *   chrome.storage.local   → authRefreshToken (AES-GCM encrypted Google OAuth refresh token)
 *   chrome.storage.session → authSession (Google OAuth access token, volatile — cleared on browser close)
 *
 * Token notes:
 *   The Google OAuth access token (oauthAccessToken) is stored in session — it grants Drive API access.
 *   The Google OAuth refresh token is encrypted on disk and used to obtain new access tokens via
 *   https://oauth2.googleapis.com/token when the session token expires or is missing.
 *   Profile fields (uid, email, displayName, photoURL) come directly from the Firebase UserCredential
 *   returned by the BFF and are always populated after sign-in.
 */

import type { StoredAuthProfile, EncryptedTokenBlob, SessionTokenData, OAuthCredentialPayload } from '@/types';
import { encryptToken, decryptToken } from './token-crypto-service';

// Re-export so existing importers don't need to change.
export type { OAuthCredentialPayload };

const AUTH_PROFILE_KEY = 'authProfile';
const AUTH_REFRESH_KEY = 'authRefreshToken';
const AUTH_SESSION_KEY = 'authSession';

export const authStorageService = {
  /**
   * Persists auth data after a successful sign-in.
   *
   * - Profile (non-sensitive fields) → chrome.storage.local (survives browser restart)
   * - Google OAuth access token → chrome.storage.session (volatile, no disk footprint)
   * - Google OAuth refresh token → AES-GCM encrypted in chrome.storage.local
   *
   * All fields are read directly from the credential — the BFF returns a full
   * Firebase UserCredential JSON that contains both profile and token data.
   *
   * @param credential  Full Firebase UserCredential payload from the BFF iframe auth flow.
   */
  async saveAuthData(credential: OAuthCredentialPayload): Promise<void> {
    // 1. Profile — read directly from credential.user.
    const storedProfile: StoredAuthProfile = {
      uid:         credential.user.uid,
      email:       credential.user.email,
      displayName: credential.user.displayName,
      photoURL:    credential.user.photoURL,
    };
    await chrome.storage.local.set({ [AUTH_PROFILE_KEY]: storedProfile });

    // 2. Google OAuth access token → chrome.storage.session (volatile, cleared on browser close).
    //    Parse granted_scopes from rawUserInfo so hasDriveScope is accurate immediately
    //    without waiting for the first proactive token refresh.
    let scopes: string[] = [];
    try {
      const raw = JSON.parse(credential._tokenResponse.rawUserInfo) as Record<string, unknown>;
      if (typeof raw.granted_scopes === 'string') {
        scopes = raw.granted_scopes.split(' ').filter(Boolean);
      }
    } catch {
      // rawUserInfo is not valid JSON — scopes will be empty until the first token refresh.
    }

    const sessionData: SessionTokenData = {
      accessToken: credential._tokenResponse.oauthAccessToken,
      expiresAt:   Date.now() + credential._tokenResponse.oauthExpireIn * 1000,
      scopes,
    };
    await (chrome.storage.session as typeof chrome.storage.local).set({
      [AUTH_SESSION_KEY]: sessionData,
    });

    // 3. Google OAuth refresh token → encrypted in chrome.storage.local.
    await this.saveRefreshToken(credential._tokenResponse.refreshToken);
  },

  /**
   * Updates only the session token after a proactive or just-in-time token refresh.
   * Does not touch the auth profile or encrypted refresh token.
   *
   * @param accessToken  New Google OAuth access token.
   * @param expiresAt    Exact expiry timestamp in Unix ms (from token endpoint expires_in).
   * @param scopes       Granted OAuth scopes returned by the token endpoint.
   */
  async saveSessionToken(accessToken: string, expiresAt: number, scopes?: string[]): Promise<void> {
    const sessionData: SessionTokenData = { accessToken, expiresAt, scopes };
    await (chrome.storage.session as typeof chrome.storage.local).set({
      [AUTH_SESSION_KEY]: sessionData,
    });
  },

  /**
   * Encrypts and stores a refresh token in chrome.storage.local.
   * Call this when Firebase user.refreshToken becomes available.
   */
  async saveRefreshToken(refreshToken: string): Promise<void> {
    const encrypted = await encryptToken(refreshToken);
    await chrome.storage.local.set({ [AUTH_REFRESH_KEY]: encrypted });
  },

  /** Returns the stored user profile, or null if not signed in. */
  async getAuthProfile(): Promise<StoredAuthProfile | null> {
    const result = await chrome.storage.local.get(AUTH_PROFILE_KEY);
    return (result[AUTH_PROFILE_KEY] as StoredAuthProfile) ?? null;
  },

  /** Returns the session-stored access token, or null if expired/missing. */
  async getAccessToken(): Promise<SessionTokenData | null> {
    const result = await (chrome.storage.session as typeof chrome.storage.local).get(
      AUTH_SESSION_KEY,
    );
    return (result[AUTH_SESSION_KEY] as SessionTokenData) ?? null;
  },

  /**
   * Decrypts and returns the stored refresh token, or null if not available.
   * Returns null silently if decryption fails (e.g., after extension reinstall).
   */
  async getRefreshToken(): Promise<string | null> {
    const result = await chrome.storage.local.get(AUTH_REFRESH_KEY);
    const blob = result[AUTH_REFRESH_KEY] as EncryptedTokenBlob | undefined;
    if (!blob) return null;
    try {
      return await decryptToken(blob);
    } catch {
      return null;
    }
  },

  /** Removes all auth data from both local and session storage. */
  async clearAll(): Promise<void> {
    await Promise.all([
      chrome.storage.local.remove([AUTH_PROFILE_KEY, AUTH_REFRESH_KEY]),
      (chrome.storage.session as typeof chrome.storage.local).remove(AUTH_SESSION_KEY),
    ]);
  },

  /**
   * Subscribes to profile changes in chrome.storage.local.
   * Fires when the background writes or removes the authProfile key.
   * Returns an unsubscribe function.
   */
  onProfileChanged(callback: (profile: StoredAuthProfile | null) => void): () => void {
    const listener = (
      changes: Record<string, chrome.storage.StorageChange>,
      area: string,
    ) => {
      if (area !== 'local' || !(AUTH_PROFILE_KEY in changes)) return;
      const profile = (changes[AUTH_PROFILE_KEY].newValue as StoredAuthProfile) ?? null;
      callback(profile);
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  },
};
