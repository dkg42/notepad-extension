import type { AuthUser } from '@/types';

const AUTH_USER_KEY = 'authUser';

/**
 * Auth service for use in popup, dashboard, and components.
 *
 * Has zero Firebase SDK imports — all Firebase operations are delegated to
 * the background service worker via chrome.runtime.sendMessage. Auth state
 * is read from chrome.storage.local where the background writes it after
 * each sign-in/sign-out via onAuthStateChanged.
 */
export const authService = {
  /**
   * Returns the currently signed-in user from chrome.storage.local,
   * or null if no user is authenticated.
   */
  async getCurrentUser(): Promise<AuthUser | null> {
    const result = await chrome.storage.local.get(AUTH_USER_KEY);
    return (result[AUTH_USER_KEY] as AuthUser) ?? null;
  },

  /**
   * Triggers Google sign-in via the background → offscreen → iframe flow.
   * Resolves when the background confirms that auth state has been persisted
   * to chrome.storage.local.
   */
  async signIn(): Promise<{ ok: boolean; error?: string }> {
    console.log('[AUTH][authService] Sending firebase-auth message to background');
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(
        { type: 'firebase-auth' },
        (response: { ok: boolean; error?: string } | undefined) => {
          if (chrome.runtime.lastError) {
            console.error('[AUTH][authService] chrome.runtime.lastError:', chrome.runtime.lastError.message);
            resolve({ ok: false, error: chrome.runtime.lastError.message });
            return;
          }
          console.log('[AUTH][authService] Received response from background:', response);
          resolve(response ?? { ok: false, error: 'No response from background' });
        },
      );
    });
  },

  /**
   * Signs out the current user. The background clears Firebase auth state
   * and removes the authUser key from chrome.storage.local.
   */
  async signOut(): Promise<{ ok: boolean; error?: string }> {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(
        { type: 'firebase-sign-out' },
        (response: { ok: boolean; error?: string } | undefined) => {
          if (chrome.runtime.lastError) {
            resolve({ ok: false, error: chrome.runtime.lastError.message });
            return;
          }
          resolve(response ?? { ok: false, error: 'No response from background' });
        },
      );
    });
  },

  /**
   * Subscribes to auth state changes via chrome.storage.onChanged.
   * Fires immediately-on-change when the background writes or removes authUser.
   * Returns an unsubscribe function — call it in React's cleanup effect.
   */
  onAuthStateChange(callback: (user: AuthUser | null) => void): () => void {
    const listener = (
      changes: Record<string, chrome.storage.StorageChange>,
      area: string,
    ) => {
      if (area !== 'local' || !(AUTH_USER_KEY in changes)) return;
      const user = (changes[AUTH_USER_KEY].newValue as AuthUser) ?? null;
      callback(user);
    };

    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  },
};
