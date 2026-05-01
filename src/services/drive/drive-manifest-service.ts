/**
 * @module drive-manifest-service
 * @description Sole owner of `manifest.json` in Drive AppData — the file-ID registry
 * that maps every known AppData filename to its Drive file ID, version, and last-synced
 * timestamp. The manifest is held in a module-level variable for the service-worker
 * lifetime and backed by session-storage cache; manifest writes are never debounced
 * because the manifest must stay consistent with Drive file state after every write.
 * @dependencies ./drive-cache-service, ./drive-io-service, ./types/drive-schemas
 * @public load, save, upsertEntry, getEntry, getManifest, initialize, clearInMemory, driveManifestService
 */

/**
 * drive-manifest-service.ts
 *
 * Single owner of the `manifest.json` file in Drive AppData.
 *
 * The manifest stores Drive file IDs for every known AppData file so subsequent
 * writes go directly to PATCH /files/{id} without a list-by-name lookup.
 * It also stores version numbers and `syncedAt` timestamps for conflict resolution.
 *
 * In-memory copy:
 *   The manifest is held in a module-level variable for the lifetime of the
 *   service worker. On service worker restart the in-memory copy is gone, but
 *   `load()` first checks the session-storage cache before falling back to Drive.
 *
 * Writes to the manifest are NEVER debounced — the manifest must stay consistent
 * with Drive file state. Every successful Drive write calls upsertEntry().
 */

import type { DriveManifest, DriveManifestEntry, DriveFilename } from './types/drive-schemas';
import { DRIVE_SCHEMA_VERSION } from './types/drive-schemas';
import { CacheKeys, get as cacheGet, set as cacheSet } from './drive-cache-service';
import {
  createFile,
  updateFile,
  readFile,
  findFileByName,
} from './drive-io-service';

const MANIFEST_FILENAME = 'manifest.json' satisfies DriveFilename;

// ── In-memory manifest ─────────────────────────────────────────────────────────

/** Module-level in-memory copy. Populated by load() and kept in sync by upsertEntry(). */
let inMemoryManifest: DriveManifest | null = null;
/** Drive file ID for the manifest itself. */
let manifestFileId: string | null = null;

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Loads the manifest from session cache or Drive.
 * Populates the in-memory copy and session cache.
 * Returns null if no manifest exists in Drive (first-time user).
 */
export async function load(token: string): Promise<DriveManifest | null> {
  // 1. Fast path: in-memory copy (service worker has not restarted)
  if (inMemoryManifest) return inMemoryManifest;

  // 2. Session storage cache (service worker restarted but browser is still open)
  const cached = await cacheGet<{ manifest: DriveManifest; fileId: string }>(CacheKeys.manifest);
  if (cached) {
    inMemoryManifest = cached.manifest;
    manifestFileId = cached.fileId;
    return inMemoryManifest;
  }

  // 3. Drive read
  const findResult = await findFileByName(MANIFEST_FILENAME, token);
  if (!findResult.ok) {
    console.warn('[MANIFEST] Failed to search for manifest:', findResult.error);
    return null;
  }
  if (!findResult.data) {
    // First-time user — no manifest yet
    return null;
  }

  manifestFileId = findResult.data.id;
  const readResult = await readFile(manifestFileId, token);
  if (!readResult.ok) {
    console.warn('[MANIFEST] Failed to read manifest file:', readResult.error);
    return null;
  }

  try {
    const manifest = JSON.parse(readResult.data) as DriveManifest;
    inMemoryManifest = manifest;
    await cacheSet(CacheKeys.manifest, { manifest, fileId: manifestFileId });
    return manifest;
  } catch (err) {
    console.error('[MANIFEST] Failed to parse manifest JSON:', err);
    return null;
  }
}

/**
 * Writes the manifest to Drive and updates the in-memory + session caches.
 * Creates the manifest file if it does not yet have a Drive file ID.
 */
export async function save(manifest: DriveManifest, token: string): Promise<void> {
  const body = JSON.stringify(manifest, null, 2);

  if (manifestFileId) {
    const result = await updateFile(manifestFileId, body, token);
    if (!result.ok) {
      console.error('[MANIFEST] Failed to update manifest:', result.error);
      return;
    }
    manifest.files[MANIFEST_FILENAME] = {
      ...(manifest.files[MANIFEST_FILENAME] ?? {}),
      driveFileId: manifestFileId,
      filename: MANIFEST_FILENAME,
      schemaVersion: DRIVE_SCHEMA_VERSION,
      syncedAt: Date.now(),
      version: result.data.version,
    };
  } else {
    const result = await createFile(MANIFEST_FILENAME, 'application/json', body, token);
    if (!result.ok) {
      console.error('[MANIFEST] Failed to create manifest:', result.error);
      return;
    }
    manifestFileId = result.data.id;
    manifest.files[MANIFEST_FILENAME] = {
      driveFileId: manifestFileId,
      filename: MANIFEST_FILENAME,
      schemaVersion: DRIVE_SCHEMA_VERSION,
      syncedAt: Date.now(),
      version: result.data.version,
    };
  }

  inMemoryManifest = manifest;
  await cacheSet(CacheKeys.manifest, { manifest, fileId: manifestFileId });
}

/**
 * Updates (or inserts) a single file entry in the manifest.
 * This is called after every successful Drive write for a non-manifest file.
 *
 * Updates are applied immediately to the in-memory copy and persisted to Drive
 * without debounce to keep the manifest consistent.
 */
export async function upsertEntry(
  filename: string,
  patch: Partial<DriveManifestEntry>,
  token: string,
): Promise<void> {
  const manifest = inMemoryManifest;
  if (!manifest) {
    console.warn('[MANIFEST] upsertEntry called before manifest was loaded — skipping');
    return;
  }

  const existing = manifest.files[filename] ?? {
    driveFileId: '',
    filename,
    schemaVersion: DRIVE_SCHEMA_VERSION,
    syncedAt: 0,
  };

  manifest.files[filename] = { ...existing, ...patch };
  manifest.updatedAt = Date.now();
  await save(manifest, token);
}

/**
 * Returns the manifest entry for a given filename from the in-memory copy.
 * Synchronous — callers must ensure load() has been called first.
 * Returns null if the entry does not exist or the manifest is not loaded.
 */
export function getEntry(filename: string): DriveManifestEntry | null {
  return inMemoryManifest?.files[filename] ?? null;
}

/**
 * Returns the full in-memory manifest, or null if not yet loaded.
 */
export function getManifest(): DriveManifest | null {
  return inMemoryManifest;
}

/**
 * Creates a brand-new manifest for a first-time user.
 * Uploads it to Drive and populates the in-memory + session caches.
 */
export async function initialize(ownerUid: string, token: string): Promise<DriveManifest> {
  const manifest: DriveManifest = {
    schemaVersion: DRIVE_SCHEMA_VERSION,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ownerUid,
    files: {},
  };
  await save(manifest, token);
  return manifest;
}

/**
 * Clears the in-memory manifest and session cache (called on sign-out).
 */
export function clearInMemory(): void {
  inMemoryManifest = null;
  manifestFileId = null;
}

export const driveManifestService = {
  load,
  save,
  upsertEntry,
  getEntry,
  getManifest,
  initialize,
  clearInMemory,
};
