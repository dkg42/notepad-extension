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

const LIST_ACCOUNTS_URL = 'https://accounts.google.com/ListAccounts?json=standard&gpsia=1&source=ogb&origin=https%3A%2F%2Fwww.google.com';

/** Cached validation result with a TTL. */
let cachedValidAt: number | null = null;
/** Cached primary signed-in Google account email — cleared on session invalidation. */
let cachedAccountEmail: string | null | undefined = undefined; // undefined = not yet fetched

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
  cachedAccountEmail = undefined;
}

/**
 * Returns the email of the primary Google account currently signed into the
 * browser, by calling the accounts.google.com/ListAccounts API.
 *
 * The result is cached until `invalidateSessionCache()` is called (i.e. on
 * auth failure or sign-out), so only one network call is made per session.
 * Returns null if the call fails or no account is found.
 */
export async function getSignedInGoogleAccountEmail(): Promise<string | null> {
  if (cachedAccountEmail != null) return cachedAccountEmail;
  try {
    const resp = await fetch(LIST_ACCOUNTS_URL, { credentials: 'include' });
    if (!resp.ok) {
      cachedAccountEmail = null;
      return null;
    }
    const text = await resp.text();
    // Response is an HTML page (OGB iframe format) containing a postMessage call with
    // the account data as a \xNN-escaped JS string, e.g.:
    //   window.parent.postMessage('\x5b\x22gaia.l.a.r\x22,...', 'https:\/\/www.google.com')
    const match = text.match(/window\.parent\.postMessage\('([\s\S]*?)',\s*'[^']*'\)/);
    if (!match) {
      cachedAccountEmail = null;
      return null;
    }
    // Unescape \xNN hex sequences and escaped forward slashes to get valid JSON.
    const jsonText = match[1]
      .replace(/\\x([0-9a-fA-F]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
      .replace(/\\\//g, '/');
    const data = JSON.parse(jsonText) as unknown[];
    // Decoded: ["gaia.l.a.r", [[account0], [account1], ...]]
    // Each account entry: ["gaia.l.a", index, displayName, email, photoUrl, ...]
    const accounts = data[1];
    if (!Array.isArray(accounts) || accounts.length === 0) {
      cachedAccountEmail = null;
      return null;
    }
    const primary = accounts[0];
    const email = Array.isArray(primary) && typeof primary[3] === 'string' && primary[3].includes('@')
      ? primary[3] as string
      : null;
    cachedAccountEmail = email;
    return email;
  } catch {
    cachedAccountEmail = null;
    return null;
  }
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
