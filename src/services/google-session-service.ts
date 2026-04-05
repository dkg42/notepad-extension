/**
 * Google session service — validates that the browser has an active Google
 * session (i.e. the required cookies exist).
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

const LIST_ACCOUNTS_URL = 'https://accounts.google.com/ListAccounts?json=standard&gpsia=1&source=ogb&origin=https%3A%2F%2Fwww.google.com';

/** Cached validation result with a TTL. */
let cachedValidAt: number | null = null;
/**
 * Cached ListAccounts entries — each entry is an account array from the API.
 * `undefined` = not yet fetched; `null` = fetch failed or no accounts found.
 */
let cachedAccounts: unknown[][] | null | undefined = undefined;

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
 * Clears the cached validation result and accounts list so the next call
 * re-checks cookies and re-fetches account data.
 * Should be called whenever a batchexecute request returns HTTP 401 or
 * the CSRF token is missing from the NotebookLM homepage.
 */
export function invalidateSessionCache(): void {
  cachedValidAt = null;
  cachedAccounts = undefined;
}

/**
 * Fetches and parses all Google accounts from the ListAccounts API.
 * Returns the raw account arrays, each of the shape:
 *   ["gaia.l.a", index, displayName, email, photoUrl, ...]
 *
 * Result is cached until `invalidateSessionCache()` is called.
 * Returns null if the call fails or no accounts are found.
 */
async function fetchGoogleAccounts(): Promise<unknown[][] | null> {
  if (cachedAccounts !== undefined) return cachedAccounts;

  try {
    const resp = await fetch(LIST_ACCOUNTS_URL, { credentials: 'include' });
    if (!resp.ok) {
      cachedAccounts = null;
      return null;
    }
    const text = await resp.text();
    // Response is an HTML page (OGB iframe format) containing a postMessage call with
    // the account data as a \xNN-escaped JS string, e.g.:
    //   window.parent.postMessage('\x5b\x22gaia.l.a.r\x22,...', 'https:\/\/www.google.com')
    const match = text.match(/window\.parent\.postMessage\('([\s\S]*?)',\s*'[^']*'\)/);
    if (!match) {
      cachedAccounts = null;
      return null;
    }
    // Unescape \xNN hex sequences and escaped forward slashes to get valid JSON.
    const jsonText = match[1]
      .replace(/\\x([0-9a-fA-F]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
      .replace(/\\\//g, '/');
    const data = JSON.parse(jsonText) as unknown[];
    // Decoded: ["gaia.l.a.r", [[account0], [account1], ...]]
    const accounts = data[1];
    if (!Array.isArray(accounts) || accounts.length === 0) {
      cachedAccounts = null;
      return null;
    }
    cachedAccounts = accounts as unknown[][];
    return cachedAccounts;
  } catch {
    cachedAccounts = null;
    return null;
  }
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
  const accounts = await fetchGoogleAccounts();
  if (!accounts || accounts.length === 0) return null;
  // Each account entry: ["gaia.l.a", index, displayName, email, photoUrl, ...]
  const primary = accounts[0];
  return Array.isArray(primary) && typeof primary[3] === 'string' && primary[3].includes('@')
    ? (primary[3] as string)
    : null;
}

/**
 * Returns the zero-based index of the given email in the ListAccounts response,
 * which corresponds to the `authuser=N` query parameter used to route a
 * NotebookLM request to that specific Google account.
 *
 * Returns null if the email is not found among the browser's signed-in accounts.
 */
export async function findAuthuserIndex(targetEmail: string): Promise<number | null> {
  const accounts = await fetchGoogleAccounts();
  if (!accounts) return null;
  const lower = targetEmail.toLowerCase();
  for (let i = 0; i < accounts.length; i++) {
    const account = accounts[i];
    if (Array.isArray(account) && typeof account[3] === 'string' && account[3].toLowerCase() === lower) {
      return i;
    }
  }
  return null;
}

/**
 * Ensures the browser has an active Google/NotebookLM session.
 *
 * Checks for the presence of the SID cookie. If no valid session exists,
 * throws an error instructing the user to sign in to Google in their browser.
 * Unlike the previous implementation, this no longer opens a sign-in tab.
 *
 * Throws:
 *   - 'No active Google session — please sign in to Google in your browser'
 */
export async function ensureGoogleSession(force = false): Promise<void> {
  if (!force && (await validateGoogleSession())) {
    return;
  }

  // Re-check bypassing the cache when force=true
  const cookie = await chrome.cookies.get({ url: NOTEBOOKLM_ORIGIN, name: 'SID' });
  if (cookie !== null) {
    cachedValidAt = Date.now();
    return;
  }

  throw new Error('No active Google session — please sign in to Google in your browser');
}

// Re-export GOOGLE_COOKIE_DOMAIN in case it's needed by other modules
export { GOOGLE_COOKIE_DOMAIN };
