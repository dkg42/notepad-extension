import type { StoredAuthProfile } from '@/types';
import { authStorageService } from './auth-storage-service';

/**
 * Auth service for use in popup, dashboard, and components.
 *
 * Has zero Firebase SDK imports — all Firebase operations are delegated to
 * the background service worker via chrome.runtime.sendMessage. Auth state
 * is read from chrome.storage.local where the background writes it after
 * each sign-in/sign-out.
 */
export const authService = {
  /**
   * Returns the currently signed-in user profile from chrome.storage.local,
   * or null if no user is authenticated.
   */
  async getCurrentUser(): Promise<StoredAuthProfile | null> {
    return authStorageService.getAuthProfile();
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
   * and removes auth data from chrome.storage.local.
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
   * Ensures the browser has an active Google/NotebookLM session.
   * Delegates to the background service worker, which opens a NotebookLM
   * tab for the user to sign in if the required cookies are missing.
   */
  async ensureNotebookLMSession(): Promise<{ ok: boolean; error?: string }> {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(
        { type: 'ensure-google-session' },
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
   * Fires when the background writes or removes the authProfile key.
   * Returns an unsubscribe function — call it in React's cleanup effect.
   */
  onAuthStateChange(callback: (user: StoredAuthProfile | null) => void): () => void {
    return authStorageService.onProfileChanged(callback);
  },
};
