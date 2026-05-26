/**
 * @module scoped-storage
 * @description chrome.storage.local wrapper that namespaces every key under
 * `u:<uid>:` so multiple signed-in accounts can coexist on the same device
 * without overwriting each other. Auth-related keys (authProfile, authClaims,
 * etc.) and a handful of device-global keys (driveInitialized) bypass the
 * prefix via an allowlist. When no user is signed in, keys are scoped to
 * `u:anon:` so the content-script pre-auth flow keeps working.
 *
 * The API mirrors chrome.storage.local — `get`, `set`, `remove`, `onChanged` —
 * so callsites change with a one-line swap.
 *
 * @dependencies (none — must not import from any storage module to avoid cycles)
 * @public scopedStorage
 */
import type { StoredAuthProfile } from '@/types';

const ANON_UID = 'anon';
const PREFIX = 'u:';

const GLOBAL_KEYS: ReadonlySet<string> = new Set([
  'authProfile',
  'authClaims',
  'authFirebaseRefreshToken',
  'driveInitialized',
]);

const GLOBAL_PREFIXES: readonly string[] = ['u:'];

let currentUid: string = ANON_UID;
let hydrated: Promise<void> | null = null;

function isGlobalKey(key: string): boolean {
  if (GLOBAL_KEYS.has(key)) return true;
  for (const p of GLOBAL_PREFIXES) {
    if (key.startsWith(p)) return true;
  }
  return false;
}

function namespaceKey(logicalKey: string): string {
  if (isGlobalKey(logicalKey)) return logicalKey;
  return `${PREFIX}${currentUid}:${logicalKey}`;
}

function stripNamespace(storageKey: string): string {
  if (!storageKey.startsWith(PREFIX)) return storageKey;
  const colonAfterUid = storageKey.indexOf(':', PREFIX.length);
  if (colonAfterUid < 0) return storageKey;
  const uid = storageKey.slice(PREFIX.length, colonAfterUid);
  if (uid !== currentUid) return storageKey;
  return storageKey.slice(colonAfterUid + 1);
}

async function hydrateUid(): Promise<void> {
  const result = await chrome.storage.local.get('authProfile');
  const profile = (result.authProfile as StoredAuthProfile | undefined) ?? null;
  currentUid = profile?.uid ?? ANON_UID;
}

function ensureHydrated(): Promise<void> {
  if (hydrated) return hydrated;
  hydrated = hydrateUid();
  return hydrated;
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  const profileChange = changes.authProfile;
  if (!profileChange) return;
  const nextProfile = profileChange.newValue as StoredAuthProfile | undefined;
  currentUid = nextProfile?.uid ?? ANON_UID;
});

void ensureHydrated();

type GetKey = string | string[] | null;

async function get<T = unknown>(key: GetKey): Promise<Record<string, T>> {
  await ensureHydrated();
  if (key === null) {
    const all = await chrome.storage.local.get(null);
    const out: Record<string, T> = {};
    const myPrefix = `${PREFIX}${currentUid}:`;
    for (const [k, v] of Object.entries(all)) {
      if (k.startsWith(myPrefix)) {
        out[k.slice(myPrefix.length)] = v as T;
      }
    }
    return out;
  }
  const keys = Array.isArray(key) ? key : [key];
  const namespaced = keys.map(namespaceKey);
  const raw = await chrome.storage.local.get(namespaced);
  const out: Record<string, T> = {};
  for (const logical of keys) {
    const ns = namespaceKey(logical);
    if (ns in raw) out[logical] = raw[ns] as T;
  }
  return out;
}

async function set(items: Record<string, unknown>): Promise<void> {
  await ensureHydrated();
  const namespaced: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(items)) {
    namespaced[namespaceKey(k)] = v;
  }
  await chrome.storage.local.set(namespaced);
}

async function remove(key: string | string[]): Promise<void> {
  await ensureHydrated();
  const keys = Array.isArray(key) ? key : [key];
  await chrome.storage.local.remove(keys.map(namespaceKey));
}

/**
 * Lists every logical key currently present in the active user's namespace.
 * Useful for dynamic-key enumeration (e.g., `chatContent_<id>`).
 */
async function listLogicalKeys(filterPrefix?: string): Promise<string[]> {
  await ensureHydrated();
  const all = await chrome.storage.local.get(null);
  const myPrefix = `${PREFIX}${currentUid}:`;
  const out: string[] = [];
  for (const k of Object.keys(all)) {
    if (!k.startsWith(myPrefix)) continue;
    const logical = k.slice(myPrefix.length);
    if (!filterPrefix || logical.startsWith(filterPrefix)) out.push(logical);
  }
  return out;
}

type ChangeRecord<T> = { newValue?: T; oldValue?: T };

/**
 * Subscribes to changes for one or more logical keys in the active user's
 * namespace. The callback receives a map keyed by logical key (prefix
 * stripped). Globally-allowlisted keys pass through unchanged.
 *
 * Returns an unsubscribe function.
 */
function onChanged<T = unknown>(
  key: string | string[],
  callback: (changes: Record<string, ChangeRecord<T>>) => void,
): () => void {
  const watchedLogical = Array.isArray(key) ? key : [key];
  const listener = (
    changes: Record<string, chrome.storage.StorageChange>,
    area: string,
  ): void => {
    if (area !== 'local') return;
    const relevant: Record<string, ChangeRecord<T>> = {};
    for (const logical of watchedLogical) {
      const ns = namespaceKey(logical);
      if (ns in changes) {
        relevant[logical] = {
          newValue: changes[ns].newValue as T | undefined,
          oldValue: changes[ns].oldValue as T | undefined,
        };
      }
    }
    if (Object.keys(relevant).length > 0) callback(relevant);
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}

/**
 * Returns the currently active uid (or 'anon' when signed out).
 * Useful in rare cases where a service needs to tag a payload with the owner.
 */
function getCurrentUid(): string {
  return currentUid;
}

export const scopedStorage = {
  get,
  set,
  remove,
  onChanged,
  listLogicalKeys,
  getCurrentUid,
};
