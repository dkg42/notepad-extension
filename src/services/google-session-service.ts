/**
 * Google session service — validates that the browser has an active Google
 * session (i.e. the required cookies exist) and, if not, opens a
 * NotebookLM tab so the user can sign in.
 *
 * All batchRPC calls to notebooklm.google.com rely on Google session cookies
 * (SID, HSID, etc.) being present in the browser. The Firebase sign-in popup
 * establishes these cookies as a side-effect, but they can be absent if:
 *   - The user has never signed into Google in this browser profile
 *   - The cookies were cleared
 *   - The session expired
 *
 * This service is intended to be called from the background service worker
 * (which has access to chrome.cookies and chrome.tabs).
 */

const NOTEBOOKLM_ORIGIN = 'https://notebooklm.google.com';
const GOOGLE_COOKIE_DOMAIN = '.google.com';
const SESSION_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const SIGN_IN_TIMEOUT_MS = 2 * 60 * 1000;   // 2 minutes

/** Cached validation result with a TTL. */
let cachedValidAt: number | null = null;

/**
 * Checks whether the browser has an active Google session by verifying
 * the SID cookie exists for .google.com.
 *
 * Result is cached for 5 minutes to avoid repeated cookie lookups on
 * every API call. The cache is cleared by `invalidateSessionCache()` on
 * auth failures and when the service worker restarts (acceptable — next
 * call simply re-validates).
 */
export async function validateGoogleSession(): Promise<boolean> {
  const now = Date.now();
  if (cachedValidAt !== null && now - cachedValidAt < SESSION_CACHE_TTL_MS) {
    return true;
  }

  const cookie = await chrome.cookies.get({
    url: NOTEBOOKLM_ORIGIN,
    name: 'SID',
  });

  if (cookie !== null) {
    cachedValidAt = now;
    return true;
  }

  cachedValidAt = null;
  return false;
}

/**
 * Clears the cached validation result so the next call re-checks cookies.
 * Should be called whenever a batchexecute request returns HTTP 401 or
 * the CSRF token is missing from the NotebookLM homepage.
 */
export function invalidateSessionCache(): void {
  cachedValidAt = null;
}

/**
 * Ensures the browser has an active Google/NotebookLM session.
 *
 * If `validateGoogleSession()` returns true, this is a no-op. Otherwise:
 *   1. Opens https://notebooklm.google.com/ in a new tab.
 *   2. Waits (up to 2 minutes) for the tab to land on a notebooklm.google.com
 *      URL, indicating the user completed Google sign-in.
 *   3. Closes the tab automatically once sign-in is detected.
 *   4. Re-validates cookies; throws if still not authenticated.
 *
 * Throws:
 *   - 'Authentication timed out — please sign in to notebooklm.google.com'
 *   - 'Authentication cancelled — sign-in tab was closed before completing'
 *   - 'Google session could not be established'
 */
export async function ensureGoogleSession(force = false): Promise<void> {
  if (!force && (await validateGoogleSession())) {
    return;
  }

  await openSignInTabAndWait();

  // Re-validate after the tab flow completes
  const isValid = await validateGoogleSession();
  if (!isValid) {
    throw new Error('Google session could not be established');
  }
}

/**
 * Opens a NotebookLM tab and waits for the user to complete Google sign-in.
 * Resolves when the tab URL settles on notebooklm.google.com (not a Google
 * accounts redirect). Rejects on timeout or if the tab is closed early.
 */
function openSignInTabAndWait(): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    let tabId: number | null = null;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let settled = false;

    const cleanup = () => {
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      chrome.tabs.onUpdated.removeListener(onUpdated);
      chrome.tabs.onRemoved.removeListener(onRemoved);
    };

    const settle = (fn: () => void) => {
      if (settled) return;
      settled = true;
      cleanup();
      fn();
    };

    const onUpdated = (
      updatedTabId: number,
      changeInfo: chrome.tabs.TabChangeInfo,
      tab: chrome.tabs.Tab,
    ) => {
      if (updatedTabId !== tabId) return;
      if (changeInfo.status !== 'complete') return;

      const url = tab.url ?? '';
      // User is on NotebookLM — sign-in complete (or already signed in)
      if (url.startsWith(NOTEBOOKLM_ORIGIN) && !url.includes('accounts.google.com')) {
        chrome.tabs.remove(updatedTabId).catch(() => {});
        settle(resolve);
      }
    };

    const onRemoved = (removedTabId: number) => {
      if (removedTabId !== tabId) return;
      settle(() =>
        reject(new Error('Authentication cancelled — sign-in tab was closed before completing')),
      );
    };

    chrome.tabs.onUpdated.addListener(onUpdated);
    chrome.tabs.onRemoved.addListener(onRemoved);

    timeoutId = setTimeout(() => {
      if (tabId !== null) {
        chrome.tabs.remove(tabId).catch(() => {});
      }
      settle(() =>
        reject(new Error('Authentication timed out — please sign in to notebooklm.google.com')),
      );
    }, SIGN_IN_TIMEOUT_MS);

    chrome.tabs
      .create({ url: NOTEBOOKLM_ORIGIN, active: true })
      .then((tab) => {
        tabId = tab.id ?? null;
      })
      .catch((err: unknown) => {
        settle(() =>
          reject(err instanceof Error ? err : new Error('Failed to open sign-in tab')),
        );
      });
  });
}
