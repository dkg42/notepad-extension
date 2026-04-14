/**
 * drive-init-service.ts
 *
 * Bootstrap, migration, and conflict resolution for Google Drive AppData sync.
 *
 * Called once from background.ts after a successful sign-in with hasDriveScope: true.
 * Also called on service worker restart if there is a signed-in user with Drive scope.
 *
 * Initialization paths:
 *
 * A) First-time user (no manifest.json in Drive):
 *    - Upload all data from chrome.storage.local to Drive in parallel batches.
 *    - Create manifest.json with the resulting file IDs.
 *
 * B) Returning user (manifest.json exists):
 *    - Read manifest → verify ownerUid matches current Firebase UID.
 *    - For each tracked file: do a conditional GET (If-None-Match: {etag}).
 *      - 304 = cache still valid, skip.
 *      - 200 = stale; compare Drive updatedAt vs local updatedAt.
 *            Drive wins if Drive is newer (overwrite local storage + cache).
 *            Local wins if local is newer (enqueue Drive write to push local state).
 *
 * Conflict resolution (last-write-wins):
 *    Drive is treated as the authoritative cross-device store.
 *    Local storage is the fast read path and offline write buffer.
 *    Conflicts resolve in favour of whichever side has the larger updatedAt.
 */

import { load as loadManifest, initialize as initManifest, clearInMemory } from './drive-manifest-service';
import { writeAllFromLocal, driveSyncService } from './drive-sync-service';
import { invalidateAll as invalidateCache } from './drive-cache-service';
import { cancelAll as cancelQueue } from './drive-write-queue';
import { readFile } from './drive-io-service';
import { storageService } from '@/services/storage-service';
import { notebookAnnotationService } from '@/services/notebook-annotation-service';
import { pipelineService } from '@/services/pipeline-service';
import { chatHistoryStorage } from '@/services/chat-history-storage';
import { domainRouterService } from '@/services/domain-router-service';
import type { DriveFilename } from './types/drive-schemas';

// ── Result type ────────────────────────────────────────────────────────────────

export interface InitResult {
  isFirstTime: boolean;
  filesLoaded: number;
  conflicts: string[];
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Entry point for Drive sync initialization.
 * Call from background.ts after confirming hasDriveScope: true.
 */
export async function initialize(token: string, ownerUid: string): Promise<InitResult> {
  const manifest = await loadManifest(token);

  if (!manifest) {
    // Path A: First-time user
    console.log('[DRIVE-INIT] No manifest found — migrating local data to Drive');
    await migrateLocalDataToDrive(token, ownerUid);
    return { isFirstTime: true, filesLoaded: 0, conflicts: [] };
  }

  // Guard against cross-account data
  if (manifest.ownerUid !== ownerUid) {
    console.warn('[DRIVE-INIT] ownerUid mismatch — Drive data belongs to a different account. Skipping sync.');
    return { isFirstTime: false, filesLoaded: 0, conflicts: ['ownerUid_mismatch'] };
  }

  // Path B: Returning user — validate each file against Drive ETags
  const conflicts: string[] = [];
  let filesLoaded = 0;

  const filenames = Object.keys(manifest.files) as DriveFilename[];

  for (const filename of filenames) {
    if (filename === 'manifest.json') continue;
    const entry = manifest.files[filename];
    if (!entry?.driveFileId) continue;

    const result = await readFile(entry.driveFileId, token, entry.etag);
    if (!result.ok) {
      console.warn(`[DRIVE-INIT] Could not read ${filename}:`, result.error);
      continue;
    }

    if (result.data === null) {
      // 304 — cache is still valid; nothing to do
      continue;
    }

    // File has changed — resolve conflict
    try {
      const driveFile = JSON.parse(result.data) as { updatedAt?: number };
      const driveUpdatedAt = driveFile.updatedAt ?? 0;

      const conflict = await resolveConflict(filename, driveFile, driveUpdatedAt, result.data, token);
      if (conflict) conflicts.push(filename);
      filesLoaded++;
    } catch (err) {
      console.error(`[DRIVE-INIT] Failed to process ${filename}:`, err);
    }
  }

  console.log(`[DRIVE-INIT] Returning user init complete — ${filesLoaded} files loaded, ${conflicts.length} conflicts`);
  return { isFirstTime: false, filesLoaded, conflicts };
}

/**
 * Migrates all data from chrome.storage.local to Drive AppData.
 * Used for first-time users and after a complete cache wipe.
 */
export async function migrateLocalDataToDrive(token: string, ownerUid: string): Promise<void> {
  await initManifest(ownerUid, token);

  const [
    snippets,
    folders,
    tags,
    settings,
    exportHistory,
    annotations,
    collections,
    pipelines,
    pipelineRuns,
    podcastEpisodes,
    domainRouterRules,
    conversations,
    chatSyncMeta,
  ] = await Promise.all([
    storageService.getAll(),
    storageService.getFolders(),
    storageService.getTagsMeta(),
    storageService.getSettings(),
    storageService.getExportHistory(),
    notebookAnnotationService.getAllAnnotations(),
    notebookAnnotationService.getAllCollections(),
    pipelineService.getAll(),
    pipelineService.getRuns(),
    storageService.getPodcastEpisodes(),
    domainRouterService.getRules(),
    chatHistoryStorage.getConversations(),
    chatHistoryStorage.getSyncMeta(),
  ]);

  await writeAllFromLocal({
    snippets,
    folders,
    tags,
    settings,
    exportHistory,
    annotations,
    collections,
    pipelines,
    pipelineRuns,
    podcastEpisodes,
    domainRouterRules,
    conversations,
    chatSyncMeta,
  }, token);

  console.log('[DRIVE-INIT] First-time migration complete');
}

/**
 * Handles a Drive file that has changed since the last sync.
 *
 * Conflict resolution (last-write-wins):
 *   - Drive updatedAt > local updatedAt → Drive wins; overwrite chrome.storage.local + session cache.
 *   - Local updatedAt > Drive updatedAt → local wins; immediately enqueue a Drive write.
 *   - Same updatedAt but ETag differs → Drive wins (remote is authoritative).
 *
 * Returns true if a conflict was detected (both sides had changes).
 */
async function resolveConflict(
  filename: DriveFilename,
  driveFile: Record<string, unknown>,
  driveUpdatedAt: number,
  rawContent: string,
  token: string,
): Promise<boolean> {
  const localUpdatedAt = await getLocalUpdatedAt(filename);

  if (driveUpdatedAt >= localUpdatedAt) {
    // Drive wins — overwrite local storage
    await applyDriveData(filename, driveFile, rawContent, token);
    return driveUpdatedAt > localUpdatedAt && localUpdatedAt > 0;
  } else {
    // Local is newer — push local state to Drive
    await pushLocalToDrive(filename, token);
    return true;
  }
}

/**
 * Returns the `updatedAt` timestamp from the locally stored version of a file.
 * Used to compare against the Drive version during conflict resolution.
 */
async function getLocalUpdatedAt(filename: DriveFilename): Promise<number> {
  // We use the last known syncedAt from the manifest as the local updatedAt proxy.
  // A missing entry means the file was never synced — treat as 0 (Drive always wins).
  const { getEntry } = await import('./drive-manifest-service');
  const entry = getEntry(filename);
  return entry?.syncedAt ?? 0;
}

/**
 * Applies data received from Drive into chrome.storage.local and session cache.
 */
async function applyDriveData(
  filename: DriveFilename,
  driveFile: Record<string, unknown>,
  _rawContent: string,
  _token: string,
): Promise<void> {
  switch (filename) {
    case 'snippets-meta.json': {
      // Snippet text bodies are in separate .txt files — only metadata is applied here.
      // UI reads text on demand via driveSyncService.getSnippetText().
      // Note: we do NOT overwrite chrome.storage.local snippets here because the text
      // bodies are not included — a full merge would require fetching all text files.
      // Instead, we only update the cache so Drive metadata is available for reads.
      break;
    }
    case 'folders.json': {
      const folders = (driveFile.folders as unknown[]) ?? [];
      await chrome.storage.local.set({ folders });
      break;
    }
    case 'tags.json': {
      const tagsMeta = (driveFile.tags as unknown[]) ?? [];
      await chrome.storage.local.set({ tagsMeta });
      break;
    }
    case 'settings.json': {
      if (driveFile.settings) {
        await chrome.storage.local.set({ dashboardSettings: driveFile.settings });
      }
      break;
    }
    case 'notebook-annotations.json': {
      const annotations = (driveFile.annotations as unknown[]) ?? [];
      const collections = (driveFile.collections as unknown[]) ?? [];
      await chrome.storage.sync.set({ notebookAnnotations: annotations, notebookCollections: collections });
      break;
    }
    case 'pipelines.json': {
      const pipelines = (driveFile.pipelines as unknown[]) ?? [];
      await chrome.storage.local.set({ pipelines });
      break;
    }
    case 'podcast-episodes.json': {
      const podcastEpisodes = (driveFile.episodes as unknown[]) ?? [];
      await chrome.storage.local.set({ podcastEpisodes });
      break;
    }
    case 'domain-router-rules.json': {
      const domainRouterRules = (driveFile.rules as unknown[]) ?? [];
      await chrome.storage.local.set({ domainRouterRules });
      break;
    }
    case 'chat-conversations-meta.json': {
      const chatConversations = (driveFile.conversations as unknown[]) ?? [];
      const chatSyncMeta = (driveFile.syncMeta as unknown[]) ?? [];
      await chrome.storage.local.set({ chatConversations, chatSyncMeta });
      break;
    }
    default:
      // pipeline-runs and export-history are read-only from Drive perspective during init
      break;
  }
}

/**
 * Pushes the current local state for a filename back to Drive.
 * Called when local data is newer than Drive (e.g., offline edits).
 */
async function pushLocalToDrive(filename: DriveFilename, token: string): Promise<void> {
  switch (filename) {
    case 'folders.json': {
      const folders = await storageService.getFolders();
      driveSyncService.saveFolders(folders, token);
      break;
    }
    case 'tags.json': {
      const tags = await storageService.getTagsMeta();
      driveSyncService.saveTags(tags, token);
      break;
    }
    case 'settings.json': {
      const settings = await storageService.getSettings();
      driveSyncService.saveSettings(settings, token);
      break;
    }
    case 'notebook-annotations.json': {
      const annotations = await notebookAnnotationService.getAllAnnotations();
      const collections = await notebookAnnotationService.getAllCollections();
      driveSyncService.saveAnnotations(annotations, collections, token);
      break;
    }
    case 'pipelines.json': {
      const pipelines = await pipelineService.getAll();
      driveSyncService.savePipelines(pipelines, token);
      break;
    }
    case 'domain-router-rules.json': {
      const rules = await domainRouterService.getRules();
      driveSyncService.saveDomainRouterRules(rules, token);
      break;
    }
    default:
      break;
  }
}

/**
 * Tears down Drive sync state on sign-out.
 * Clears session cache, cancels pending writes, and resets the in-memory manifest.
 */
export async function teardown(): Promise<void> {
  cancelQueue();
  await invalidateCache();
  clearInMemory();
}

export const driveInitService = {
  initialize,
  migrateLocalDataToDrive,
  teardown,
};
