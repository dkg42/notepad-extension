/**
 * Auth storage service — single source of truth for all auth-related storage.
 *
 * Storage split:
 *   chrome.storage.local   → authProfile (plaintext profile, persists across restarts)
 *   chrome.storage.local   → authRefreshToken (AES-GCM encrypted refresh token)
 *   chrome.storage.session → authSession (access token, volatile — cleared on browser close)
 *
 * This prevents access tokens from persisting to disk while keeping the user
 * signed in across browser restarts via the stored profile marker.
 *
 * Note: uid/email/displayName/photoURL are populated only when Firebase is initialized
 * in the background service worker. Until then, profile fields are null and the record's
 * presence alone indicates the user is signed in.
 */

import type { StoredAuthProfile, EncryptedTokenBlob, SessionTokenData } from '@/types';
import { encryptToken, decryptToken } from './token-crypto-service';

const AUTH_PROFILE_KEY = 'authProfile';
const AUTH_REFRESH_KEY = 'authRefreshToken';
const AUTH_SESSION_KEY = 'authSession';

/**
 * The shape of the credential payload the offscreen document sends back from the
 * Firebase OAuth sign-in flow. This is the JSON form of an OAuthCredential — NOT
 * a Firebase UserCredential (which would require signInWithCredential in the background).
 */
export interface OAuthCredentialPayload {
  providerId?: string;
  signInMethod?: string;
  idToken?: string;
  accessToken?: string;
}

export const authStorageService = {
  /**
   * Persists auth data after a successful sign-in.
   *
   * - Profile (non-sensitive fields) → chrome.storage.local (survives browser restart)
   * - Access token → chrome.storage.session (volatile, no disk footprint)
   * - Refresh token → encrypted in chrome.storage.local (when provided via saveRefreshToken)
   *
   * @param credential  OAuth credential payload from the offscreen auth flow.
   * @param profile     Optional user profile fields. Null until Firebase is initialized in BG.
   */
  async saveAuthData(
    credential: OAuthCredentialPayload,
    profile?: Partial<StoredAuthProfile>,
  ): Promise<void> {
    const storedProfile: StoredAuthProfile = {
      uid: profile?.uid ?? null,
      email: profile?.email ?? null,
      displayName: profile?.displayName ?? null,
      photoURL: profile?.photoURL ?? null,
    };
    await chrome.storage.local.set({ [AUTH_PROFILE_KEY]: storedProfile });

    if (credential.accessToken) {
      const sessionData: SessionTokenData = {
        accessToken: credential.accessToken,
        expiresAt: Date.now() + 3_600_000, // Google access tokens expire in ~1 hour
      };
      // chrome.storage.session is available in MV3 service workers and MV2 background
      // scripts. It is cleared when the browser closes.
      await (chrome.storage.session as typeof chrome.storage.local).set({
        [AUTH_SESSION_KEY]: sessionData,
      });
    }
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
