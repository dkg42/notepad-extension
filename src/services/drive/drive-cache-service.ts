/**
 * @module drive-cache-service
 * @description Session-storage cache layer that sits in front of all Drive reads.
 * Uses `chrome.storage.session` (MV3, volatile, 10 MB quota) to avoid redundant Drive
 * API calls within a single browser session. Applies LRU eviction exclusively to
 * `snippet-text-*` entries — the only unbounded-growth cache type — when estimated
 * session storage exceeds 8 MB, evicting 25% of the oldest entries at a time.
 * @dependencies (none — no internal src/ imports)
 * @public CacheKeys, get, set, invalidate, invalidateAll, getVersion, setVersion, driveCacheService
 */

/**
 * drive-cache-service.ts
 *
 * Session-storage cache layer for Drive data.
 *
 * Uses chrome.storage.session (MV3 — volatile, cleared on browser close, 10 MB quota)
 * as the in-process cache for Drive file contents. This avoids redundant Drive API
 * reads within a browser session.
 *
 * Cache key catalogue:
 *   drive_cache_manifest              → DriveManifest
 *   drive_cache_snippets_meta         → DriveSnippetsMetaFile
 *   drive_cache_snippet_text_{id}     → string (raw snippet text)
 *   drive_cache_core_data             → DriveCoreDataFile (folders+tags+settings+domainRouterRules)
 *   drive_cache_history_data          → DriveHistoryDataFile (exportHistory+pipelineRuns+podcastEpisodes)
 *   drive_cache_annotations           → DriveNotebookAnnotationsFile
 *   drive_cache_pipelines             → DrivePipelinesFile
 *   drive_cache_chat_meta             → DriveChatConversationsMetaFile
 *   drive_cache_chat_{platform}_{id}  → string (NDJSON conversation content)
 *   drive_cache_version_{fileId}      → number (Drive version for a file)
 *
 * LRU eviction:
 *   Only `drive_cache_snippet_text_*` entries are subject to LRU eviction.
 *   All other keys are bounded by domain-level trim limits (200 runs, etc.).
 *   Eviction is triggered when the estimated session storage size exceeds 8 MB
 *   (leaving 2 MB headroom before the 10 MB limit).
 */

// ── Constants ──────────────────────────────────────────────────────────────────

const KEY_PREFIX = 'drive_cache_';
const SNIPPET_TEXT_PREFIX = `${KEY_PREFIX}snippet_text_`;
const CHAT_CONTENT_PREFIX = `${KEY_PREFIX}chat_`;
const VERSION_PREFIX = `${KEY_PREFIX}version_`;

/** Session storage size threshold (bytes) above which LRU eviction kicks in. */
const EVICTION_THRESHOLD_BYTES = 8 * 1024 * 1024; // 8 MB

/**
 * In-memory LRU tracker for snippet text cache keys.
 * Maps cacheKey → last-access Unix ms.
 * Only tracks snippet text entries (the only unbounded-growth cache type).
 */
const snippetTextAccessTime = new Map<string, number>();

// ── Well-known cache keys ──────────────────────────────────────────────────────

export const CacheKeys = {
  manifest: `${KEY_PREFIX}manifest`,
  snippetsMeta: `${KEY_PREFIX}snippets_meta`,
  coreData: `${KEY_PREFIX}core_data`,
  historyData: `${KEY_PREFIX}history_data`,
  annotations: `${KEY_PREFIX}annotations`,
  pipelines: `${KEY_PREFIX}pipelines`,
  chatMeta: `${KEY_PREFIX}chat_meta`,

  snippetText: (snippetId: string) => `${SNIPPET_TEXT_PREFIX}${snippetId}`,
  chatContent: (platform: string, id: string) => `${CHAT_CONTENT_PREFIX}${platform}_${id}`,
  version: (fileId: string) => `${VERSION_PREFIX}${fileId}`,
} as const;

// ── Core cache operations ──────────────────────────────────────────────────────

/**
 * Reads a cached value from session storage.
 * Returns null on cache miss or deserialization error.
 */
export async function get<T>(key: string): Promise<T | null> {
  try {
    const result = await chrome.storage.session.get(key);
    const value = result[key];
    if (value === undefined || value === null) return null;

    // Track access time for snippet text LRU
    if (key.startsWith(SNIPPET_TEXT_PREFIX)) {
      snippetTextAccessTime.set(key, Date.now());
    }

    return value as T;
  } catch {
    return null;
  }
}

/**
 * Writes a value to session storage.
 * Triggers LRU eviction if snippet text cache is approaching the size limit.
 */
export async function set<T>(key: string, value: T): Promise<void> {
  try {
    await chrome.storage.session.set({ [key]: value });

    if (key.startsWith(SNIPPET_TEXT_PREFIX)) {
      snippetTextAccessTime.set(key, Date.now());
      // Fire-and-forget eviction check after write
      void evictSnippetTextsIfNeeded();
    }
  } catch {
    // Session storage write failures are non-fatal — cache is best-effort
  }
}

/**
 * Removes a single key from the session storage cache.
 */
export async function invalidate(key: string): Promise<void> {
  try {
    await chrome.storage.session.remove(key);
    snippetTextAccessTime.delete(key);
  } catch {
    // Non-fatal
  }
}

/**
 * Removes all drive_cache_* keys from session storage.
 * Called on sign-out to prevent stale data leaking to a subsequent sign-in.
 */
export async function invalidateAll(): Promise<void> {
  try {
    const all = await chrome.storage.session.get(null);
    const driveKeys = Object.keys(all).filter((k) => k.startsWith(KEY_PREFIX));
    if (driveKeys.length > 0) {
      await chrome.storage.session.remove(driveKeys);
    }
    snippetTextAccessTime.clear();
  } catch {
    // Non-fatal
  }
}

// ── Version helpers ───────────────────────────────────────────────────────────

/** Returns the cached Drive version for a file, or null if not cached. */
export async function getVersion(fileId: string): Promise<number | null> {
  return get<number>(CacheKeys.version(fileId));
}

/** Stores a Drive version number for a file in session storage. */
export async function setVersion(fileId: string, version: number): Promise<void> {
  return set(CacheKeys.version(fileId), version);
}

// ── LRU eviction ──────────────────────────────────────────────────────────────

/**
 * Evicts the least-recently-used snippet text entries from session storage
 * when the total estimated size exceeds EVICTION_THRESHOLD_BYTES.
 *
 * Only snippet text entries are evicted because they are the only cache type
 * that can grow unboundedly (one entry per snippet, potentially thousands).
 */
async function evictSnippetTextsIfNeeded(): Promise<void> {
  try {
    const all = await chrome.storage.session.get(null);
    const estimatedBytes = JSON.stringify(all).length * 2; // rough UTF-16 estimate

    if (estimatedBytes < EVICTION_THRESHOLD_BYTES) return;

    // Sort snippet text keys by last-access time (oldest first)
    const snippetKeys = Object.keys(all).filter((k) => k.startsWith(SNIPPET_TEXT_PREFIX));
    snippetKeys.sort((a, b) => {
      const ta = snippetTextAccessTime.get(a) ?? 0;
      const tb = snippetTextAccessTime.get(b) ?? 0;
      return ta - tb; // oldest first
    });

    // Evict ~25% of snippet text entries
    const toEvict = snippetKeys.slice(0, Math.max(1, Math.floor(snippetKeys.length * 0.25)));
    if (toEvict.length > 0) {
      await chrome.storage.session.remove(toEvict);
      toEvict.forEach((k) => snippetTextAccessTime.delete(k));
    }
  } catch {
    // Non-fatal — eviction is best-effort
  }
}

export const driveCacheService = {
  get,
  set,
  invalidate,
  invalidateAll,
  getVersion,
  setVersion,
  CacheKeys,
};
