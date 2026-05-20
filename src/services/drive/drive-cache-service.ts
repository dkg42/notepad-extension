/**
 * @module drive-cache-service
 * @description Session-storage cache layer that sits in front of all Drive reads.
 * Uses `chrome.storage.session` (MV3, volatile, 10 MB quota) to avoid redundant Drive
 * API calls within a single browser session.
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
 *   drive_cache_prompts_meta          → DrivePromptsMetaFile (metadata + text bodies)
 *   drive_cache_app_settings          → DriveAppSettingsFile (folders+tags+settings+domainRouterRules)
 *   drive_cache_activity_data         → DriveActivityDataFile (exportHistory+pipelineRuns+podcastEpisodes)
 *   drive_cache_notebook_data         → DriveNotebookDataFile
 *   drive_cache_pipelines             → DrivePipelinesFile
 *   drive_cache_chat_meta             → DriveChatConversationsMetaFile
 *   drive_cache_podcast_audio_index   → DrivePodcastAudioIndexFile
 *   drive_cache_tab_groups            → DriveTabGroupsFile
 *   drive_cache_chat_{platform}_{id}  → string (NDJSON conversation content)
 *   drive_cache_version_{fileId}      → number (Drive version for a file)
 */

// ── Constants ──────────────────────────────────────────────────────────────────

const KEY_PREFIX = 'drive_cache_';
const CHAT_CONTENT_PREFIX = `${KEY_PREFIX}chat_`;
const VERSION_PREFIX = `${KEY_PREFIX}version_`;

// ── Well-known cache keys ──────────────────────────────────────────────────────

export const CacheKeys = {
  manifest: `${KEY_PREFIX}manifest`,
  promptsMeta: `${KEY_PREFIX}prompts_meta`,
  appSettings: `${KEY_PREFIX}app_settings`,
  activityData: `${KEY_PREFIX}activity_data`,
  notebookData: `${KEY_PREFIX}notebook_data`,
  pipelines: `${KEY_PREFIX}pipelines`,
  chatMeta: `${KEY_PREFIX}chat_meta`,
  podcastAudioIndex: `${KEY_PREFIX}podcast_audio_index`,
  tabGroups: `${KEY_PREFIX}tab_groups`,

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
    return value as T;
  } catch {
    return null;
  }
}

/**
 * Writes a value to session storage.
 * Triggers LRU eviction if prompt text cache is approaching the size limit.
 */
export async function set<T>(key: string, value: T): Promise<void> {
  try {
    await chrome.storage.session.set({ [key]: value });
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

export const driveCacheService = {
  get,
  set,
  invalidate,
  invalidateAll,
  getVersion,
  setVersion,
  CacheKeys,
};
