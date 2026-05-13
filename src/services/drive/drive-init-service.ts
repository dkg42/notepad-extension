/**
 * @module drive-init-service
 * @description Bootstrap, migration, and conflict-resolution orchestrator for Google
 * Drive AppData sync. Called once from background.ts after a successful sign-in with
 * `hasDriveScope: true`. Handles three distinct paths: first-time migration from
 * `chrome.storage.local` to Drive (Path A), returning-user first-login conflict
 * detection that may pause for a user merge/overwrite decision (Path B first-login),
 * and subsequent device sync using last-write-wins per file (Path B returning). The
 * `driveInitialized` flag in `chrome.storage.local` distinguishes the latter two paths.
 * @dependencies ./drive-manifest-service, ./drive-sync-service, ./drive-cache-service, ./drive-write-queue, ./drive-io-service, @/services/storage-service, @/services/notebook-annotation-service, @/services/pipeline-service, @/services/chat-history-storage, @/services/domain-router-service
 * @public initialize, migrateLocalDataToDrive, teardown, InitResult, ConflictSummary, driveInitService
 */

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
 *    - Read all tracked files from Drive into memory.
 *
 *    First-login on this device (driveInitialized flag absent in chrome.storage.local):
 *      - If local storage is empty → apply Drive data, set flag.
 *      - If local storage has data → return needsMergeDecision: true (no writes yet).
 *        Caller resolves via a second initialize() call with conflictDecision param.
 *
 *    Device already initialized (driveInitialized flag present):
 *      - Existing last-write-wins per file (compare manifest.syncedAt vs driveFile.updatedAt).
 *
 * Conflict resolution (merge):
 *    snippets: Drive metadata applied to local snippets; local-only snippets added to Drive.
 *    folders/tags: union of Drive + local-only entries; pushed back to Drive.
 *    settings and all other files: Drive always wins.
 *
 * Conflict resolution (overwrite):
 *    Drive data is applied to local storage for every file.
 */

import { load as loadManifest, initialize as initManifest, clearInMemory } from './drive-manifest-service';
import { writeAllFromLocal, driveSyncService } from './drive-sync-service';
import { invalidateAll as invalidateCache, get as cacheGet, CacheKeys } from './drive-cache-service';
import { authStorageService } from '@/services/auth-storage-service';
import { cancelAll as cancelQueue, setInitializing, enqueue } from './drive-write-queue';
import { readFile } from './drive-io-service';
import { snippetTextFilename } from './types/drive-schemas';
import type { DriveFilename, DriveSnippetMeta } from './types/drive-schemas';
import { storageService } from '@/services/storage-service';
import { notebookAnnotationService } from '@/services/notebook-annotation-service';
import { notebookFolderService } from '@/services/notebook-folder-service';
import { pipelineService } from '@/services/pipeline-service';
import { chatHistoryStorage } from '@/services/chat-history-storage';
import { domainRouterService } from '@/services/domain-router-service';
import type { Folder, TagMeta } from '@/types';

// ── Result types ───────────────────────────────────────────────────────────────

/**
 * Summary of data counts shown to the user when a merge conflict is detected
 * on first login (local data exists that hasn't been synced to Drive yet).
 */
export interface ConflictSummary {
  localSnippetCount: number;
  driveSnippetCount: number;
  localFolderCount: number;
  driveFolderCount: number;
  localTagCount: number;
  driveTagCount: number;
  /** Unix ms of the Drive file's last update — used to show the user when Drive was last synced. */
  driveLastSync: number;
}

export interface InitResult {
  isFirstTime: boolean;
  filesLoaded: number;
  conflicts: string[];
  /** True when local data exists and the user must choose merge or overwrite. */
  needsMergeDecision?: boolean;
  /** Present when needsMergeDecision is true. */
  conflictSummary?: ConflictSummary;
}

// ── Pro-tier check ─────────────────────────────────────────────────────────────

async function isProUser(): Promise<boolean> {
  const claims = await authStorageService.getAuthClaims();
  return (
    claims?.subscriptionStatus === 'active' &&
    (claims.subscriptionPlan === 'pro_monthly' || claims.subscriptionPlan === 'pro_yearly')
  );
}

/**
 * Flushes any Drive data currently in the session cache to chrome.storage.local.
 * Called for free-tier users to preserve data that arrived during a Pro→Free
 * transition without making any new Drive API calls.
 */
async function applyCachedDriveDataToLocal(): Promise<void> {
  const filesToApply: Array<{ cacheKey: string; filename: DriveFilename }> = [
    { cacheKey: CacheKeys.coreData,     filename: 'core-data.json' },
    { cacheKey: CacheKeys.historyData,  filename: 'history-data.json' },
    { cacheKey: CacheKeys.snippetsMeta, filename: 'snippets-meta.json' },
    { cacheKey: CacheKeys.annotations,  filename: 'notebook-annotations.json' },
    { cacheKey: CacheKeys.pipelines,    filename: 'pipelines.json' },
    { cacheKey: CacheKeys.chatMeta,     filename: 'chat-conversations-meta.json' },
  ];

  let applied = 0;
  for (const { cacheKey, filename } of filesToApply) {
    const cached = await cacheGet<Record<string, unknown>>(cacheKey);
    if (cached) {
      try {
        await applyDriveData(filename, cached, '', '');
        applied++;
      } catch (err) {
        console.error(`[DRIVE-INIT] Free-tier cache flush failed for ${filename}:`, err);
      }
    }
  }
  if (applied > 0) {
    console.log(`[DRIVE-INIT] Free-tier: flushed ${applied} cached Drive files to local storage`);
  }
}

// ── Device sync flag ───────────────────────────────────────────────────────────

/**
 * chrome.storage.local key that tracks whether this browser has already been
 * through the first-login conflict-check process. Device-local — never synced
 * to Drive. Absent means this device has never gone through conflict resolution.
 */
const DEVICE_INITIALIZED_KEY = 'driveInitialized';

async function isDeviceInitialized(): Promise<boolean> {
  const result = await chrome.storage.local.get(DEVICE_INITIALIZED_KEY);
  return result[DEVICE_INITIALIZED_KEY] === true;
}

async function markDeviceInitialized(): Promise<void> {
  await chrome.storage.local.set({ [DEVICE_INITIALIZED_KEY]: true });
}

// ── Internal types ─────────────────────────────────────────────────────────────

interface DriveFileData {
  driveFile: Record<string, unknown>;
  driveUpdatedAt: number;
  rawContent: string;
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Entry point for Drive sync initialization.
 * Call from background.ts after confirming hasDriveScope: true.
 *
 * @param conflictDecision  When provided on a second call, applies the user's
 *                          merge/overwrite choice instead of re-running detection.
 */
export async function initialize(
  token: string,
  ownerUid: string,
  conflictDecision?: 'merge' | 'overwrite',
): Promise<InitResult> {
  // Free-tier users must not make Drive API calls. Apply any data already
  // in the session cache (from a prior Pro session) so it is not discarded.
  if (!await isProUser()) {
    console.log('[DRIVE-INIT] Free-tier user — skipping Drive API calls');
    await applyCachedDriveDataToLocal();
    return { isFirstTime: false, filesLoaded: 0, conflicts: [] };
  }

  setInitializing(true);
  try {
    const manifest = await loadManifest(token);

    if (!manifest) {
      // Path A: First-time user
      console.log('[DRIVE-INIT] No manifest found — migrating local data to Drive');
      // Clear the guard before migration so writeAllFromLocal() can enqueue writes.
      setInitializing(false);
      await migrateLocalDataToDrive(token, ownerUid);
      return { isFirstTime: true, filesLoaded: 0, conflicts: [] };
    }

    // Guard against cross-account data
    if (manifest.ownerUid !== ownerUid) {
      console.warn('[DRIVE-INIT] ownerUid mismatch — Drive data belongs to a different account. Skipping sync.');
      return { isFirstTime: false, filesLoaded: 0, conflicts: ['ownerUid_mismatch'] };
    }

    // Path B: Returning user — read all Drive files in parallel
    const allDriveFiles = new Map<DriveFilename, DriveFileData>();

    // Plain-text and NDJSON files (.txt) are read on-demand — init cannot apply
    // them to storage and JSON.parse would fail on NDJSON content.
    const fileEntries = (Object.keys(manifest.files) as DriveFilename[]).filter(
      (f) => f !== 'manifest.json' && !f.endsWith('.txt') && manifest.files[f]?.driveFileId,
    );

    const settled = await Promise.all(
      fileEntries.map(async (filename) => {
        const entry = manifest.files[filename]!;
        const result = await readFile(entry.driveFileId, token);
        return { filename, result };
      }),
    );

    for (const { filename, result } of settled) {
      if (!result.ok) {
        console.warn(`[DRIVE-INIT] Could not read ${filename}:`, result.error);
        continue;
      }
      try {
        const driveFile = JSON.parse(result.data) as Record<string, unknown>;
        const driveUpdatedAt = (driveFile.updatedAt as number | undefined) ?? 0;
        allDriveFiles.set(filename, { driveFile, driveUpdatedAt, rawContent: result.data });
      } catch (err) {
        console.error(`[DRIVE-INIT] Failed to parse ${filename}:`, err);
      }
    }

      if (conflictDecision) {
        // Second call: user made a resolution decision — apply it
        await applyConflictDecision(allDriveFiles, conflictDecision, token);
        await markDeviceInitialized();
        console.log(`[DRIVE-INIT] Conflict resolved ('${conflictDecision}') — ${allDriveFiles.size} files processed`);
        return { isFirstTime: false, filesLoaded: allDriveFiles.size, conflicts: [] };
      }

      // Check whether local storage has any user-generated data
      const [localSnippets, localFolders, localTags] = await Promise.all([
        storageService.getAll(),
        storageService.getFolders(),
        storageService.getTagsMeta(),
      ]);
      const hasLocalData =
        localSnippets.length > 0 || localFolders.length > 0 || localTags.length > 0;

      if (!hasLocalData) {
        // Empty local storage → Drive wins, no prompt needed
        await Promise.all(
          [...allDriveFiles.entries()].map(async ([filename, { driveFile, rawContent }]) => {
            try {
              await applyDriveData(filename, driveFile, rawContent, token);
            } catch (err) {
              console.error(`[DRIVE-INIT] Failed to apply ${filename}:`, err);
            }
          }),
        );
        await markDeviceInitialized();
        console.log(`[DRIVE-INIT] First-time init (empty local) — ${allDriveFiles.size} files applied from Drive`);
        return { isFirstTime: false, filesLoaded: allDriveFiles.size, conflicts: [] };
      }

      // Local data exists — surface conflict summary to the user without modifying storage
      const driveSnippetsFile = allDriveFiles.get('snippets-meta.json')?.driveFile;
      const driveCoreFile = allDriveFiles.get('core-data.json')?.driveFile;

      const conflictSummary: ConflictSummary = {
        localSnippetCount: localSnippets.length,
        driveSnippetCount: ((driveSnippetsFile?.snippets as unknown[] | undefined) ?? []).length,
        localFolderCount: localFolders.length,
        driveFolderCount: ((driveCoreFile?.folders as unknown[] | undefined) ?? []).length,
        localTagCount: localTags.length,
        driveTagCount: ((driveCoreFile?.tags as unknown[] | undefined) ?? []).length,
        driveLastSync: allDriveFiles.get('snippets-meta.json')?.driveUpdatedAt ?? 0,
      };

      console.log('[DRIVE-INIT] First-time init — local data detected, awaiting user conflict decision');
      return {
        isFirstTime: false,
        filesLoaded: 0,
        conflicts: [],
        needsMergeDecision: true,
        conflictSummary,
      };

  } finally {
    setInitializing(false);
  }
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
    notebookFolders,
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
    notebookFolderService.getFolders(),
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
    notebookFolders,
    pipelines,
    pipelineRuns,
    podcastEpisodes,
    domainRouterRules,
    conversations,
    chatSyncMeta,
  }, token);

  await markDeviceInitialized();
  console.log('[DRIVE-INIT] First-time migration complete');
}

// ── Conflict resolution helpers ────────────────────────────────────────────────

/**
 * Applies the user's conflict resolution decision across all Drive files.
 * 'overwrite': Drive data replaces all local storage.
 * 'merge': snippets/folders/tags are unioned; all other files use Drive data.
 */
async function applyConflictDecision(
  allDriveFiles: Map<DriveFilename, DriveFileData>,
  decision: 'merge' | 'overwrite',
  token: string,
): Promise<void> {
  await Promise.all(
    [...allDriveFiles.entries()].map(async ([filename, { driveFile, rawContent }]) => {
      try {
        if (decision === 'overwrite') {
          await applyDriveData(filename, driveFile, rawContent, token);
        } else {
          await applyMergedData(filename, driveFile, rawContent, token);
        }
      } catch (err) {
        console.error(`[DRIVE-INIT] Failed to apply ${filename} (${decision}):`, err);
      }
    }),
  );
}

/**
 * Merges Drive file data with local storage data for user-generated content.
 * For snippets/folders/tags: produces a union of Drive + local-only entries.
 * For all other files: Drive wins (same as applyDriveData).
 */
async function applyMergedData(
  filename: DriveFilename,
  driveFile: Record<string, unknown>,
  rawContent: string,
  token: string,
): Promise<void> {
  switch (filename) {
    case 'snippets-meta.json': {
      const driveMetas = (driveFile.snippets as DriveSnippetMeta[]) ?? [];
      const localSnippets = await storageService.getAll();

      // Apply Drive metadata (tags, folderId, isFavorite) to overlapping local snippets
      const driveById = new Map(driveMetas.map((m) => [m.id, m]));
      const updatedLocalSnippets = localSnippets.map((s) => {
        const driveMeta = driveById.get(s.id);
        if (!driveMeta) return s;
        return { ...s, tags: driveMeta.tags, folderId: driveMeta.folderId, isFavorite: driveMeta.isFavorite };
      });
      await chrome.storage.local.set({ snippets: updatedLocalSnippets });

      // Build merged snippets-meta for Drive: Drive entries + local-only entries
      const driveIds = new Set(driveMetas.map((m) => m.id));
      const localOnlySnippets = updatedLocalSnippets.filter((s) => !driveIds.has(s.id));
      const localOnlyMetas: DriveSnippetMeta[] = localOnlySnippets.map(({ text: _text, ...meta }) => ({
        ...meta,
        textFileId: null,
      } as DriveSnippetMeta));
      const mergedMetas = [...driveMetas, ...localOnlyMetas];
      driveSyncService.saveSnippetsMeta(mergedMetas, token);

      // Upload text files for local-only snippets
      for (const snippet of localOnlySnippets) {
        enqueue(snippetTextFilename(snippet.id), snippet.text, token);
      }
      break;
    }

    case 'core-data.json': {
      // Merge folders and tags; settings and domain-router-rules: Drive wins.
      const driveFolders = (driveFile.folders as Folder[]) ?? [];
      const localFolders = await storageService.getFolders();
      const driveFolderIds = new Set(driveFolders.map((f) => f.id));
      const mergedFolders = [...driveFolders, ...localFolders.filter((f) => !driveFolderIds.has(f.id))];

      const driveTags = (driveFile.tags as TagMeta[]) ?? [];
      const localTags = await storageService.getTagsMeta();
      const driveTagNames = new Set(driveTags.map((t) => t.name));
      const mergedTags = [...driveTags, ...localTags.filter((t) => !driveTagNames.has(t.name))];

      const domainRouterRules = (driveFile.domainRouterRules as unknown[]) ?? [];
      await chrome.storage.local.set({ folders: mergedFolders, tagsMeta: mergedTags, domainRouterRules });
      if (driveFile.settings) {
        await chrome.storage.local.set({ dashboardSettings: driveFile.settings });
      }
      driveSyncService.saveFolders(mergedFolders, token);
      driveSyncService.saveTags(mergedTags, token);
      break;
    }

    default:
      // Drive wins for history-data, annotations, pipelines, chat, etc.
      await applyDriveData(filename, driveFile, rawContent, token);
      break;
  }
}

/**
 * Handles a Drive file that has changed since the last sync.
 *
 * Conflict resolution (last-write-wins):
 *   - Drive updatedAt > local updatedAt → Drive wins; overwrite chrome.storage.local + session cache.
 *   - Local updatedAt > Drive updatedAt → local wins; immediately enqueue a Drive write.
 *   - Same updatedAt but version differs → Drive wins (remote is authoritative).
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
      // Drive has newer snippet metadata (tags, folderId, isFavorite).
      // Apply it to local storage by merging into the existing Snippet[] — text bodies
      // come from local storage and are preserved. Snippets that exist in Drive but
      // not locally are skipped here (no text available without fetching .txt files).
      const driveMetas = (driveFile.snippets as Array<{
        id: string; source: string; savedAt: number;
        folderId?: string; tags?: string[]; isFavorite?: boolean;
      }>) ?? [];
      if (driveMetas.length === 0) break;

      const localSnippets = await storageService.getAll();
      if (localSnippets.length === 0) break;

      const driveById = new Map(driveMetas.map((m) => [m.id, m]));
      const updated = localSnippets.map((s) => {
        const driveMeta = driveById.get(s.id);
        if (!driveMeta) return s;
        return { ...s, tags: driveMeta.tags, folderId: driveMeta.folderId, isFavorite: driveMeta.isFavorite };
      });
      await chrome.storage.local.set({ snippets: updated });
      break;
    }
    case 'core-data.json': {
      const folders = (driveFile.folders as unknown[]) ?? [];
      const tagsMeta = (driveFile.tags as unknown[]) ?? [];
      const domainRouterRules = (driveFile.domainRouterRules as unknown[]) ?? [];
      await chrome.storage.local.set({ folders, tagsMeta, domainRouterRules });
      if (driveFile.settings) {
        await chrome.storage.local.set({ dashboardSettings: driveFile.settings });
      }
      break;
    }
    case 'history-data.json': {
      const exportHistory = (driveFile.exportHistory as unknown[]) ?? [];
      const pipelineRuns = (driveFile.pipelineRuns as unknown[]) ?? [];
      const podcastEpisodes = (driveFile.podcastEpisodes as unknown[]) ?? [];
      await chrome.storage.local.set({ exportHistory, pipelineRuns, podcastEpisodes });
      break;
    }
    case 'notebook-annotations.json': {
      const annotations = (driveFile.annotations as unknown[]) ?? [];
      const notebookFolders = (driveFile.folders as unknown[]) ?? [];
      await chrome.storage.sync.set({ notebookAnnotations: annotations, notebookFolders });
      break;
    }
    case 'pipelines.json': {
      const pipelines = (driveFile.pipelines as unknown[]) ?? [];
      await chrome.storage.local.set({ pipelines });
      break;
    }
    case 'chat-conversations-meta.json': {
      const chatConversations = (driveFile.conversations as unknown[]) ?? [];
      const chatSyncMeta = (driveFile.syncMeta as unknown[]) ?? [];
      await chrome.storage.local.set({ chatConversations, chatSyncMeta });
      break;
    }
    default:
      break;
  }
}

/**
 * Pushes the current local state for a filename back to Drive.
 * Called when local data is newer than Drive (e.g., offline edits).
 */
async function pushLocalToDrive(filename: DriveFilename, token: string): Promise<void> {
  switch (filename) {
    case 'core-data.json': {
      const [folders, tags, settings, rules] = await Promise.all([
        storageService.getFolders(),
        storageService.getTagsMeta(),
        storageService.getSettings(),
        domainRouterService.getRules(),
      ]);
      driveSyncService.saveFolders(folders, token);
      driveSyncService.saveTags(tags, token);
      driveSyncService.saveSettings(settings, token);
      driveSyncService.saveDomainRouterRules(rules, token);
      break;
    }
    case 'history-data.json': {
      const exportHistory = await storageService.getExportHistory();
      const podcastEpisodes = await storageService.getPodcastEpisodes();
      driveSyncService.savePodcastEpisodes(podcastEpisodes, token);
      // Export history and pipeline runs are append-only — push the latest
      for (const record of exportHistory) {
        void driveSyncService.appendExportRecord(record, token);
      }
      break;
    }
    case 'notebook-annotations.json': {
      const annotations = await notebookAnnotationService.getAllAnnotations();
      const notebookFolders = await notebookFolderService.getFolders();
      driveSyncService.saveAnnotations(annotations, notebookFolders, token);
      break;
    }
    case 'pipelines.json': {
      const pipelines = await pipelineService.getAll();
      driveSyncService.savePipelines(pipelines, token);
      break;
    }
    case 'chat-conversations-meta.json': {
      const conversations = await chatHistoryStorage.getConversations();
      const syncMeta = await chatHistoryStorage.getSyncMeta();
      driveSyncService.saveChatConversationsMeta(conversations, syncMeta, token);
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
  setInitializing(false);
  cancelQueue();
  await invalidateCache();
  clearInMemory();
}

export const driveInitService = {
  initialize,
  migrateLocalDataToDrive,
  teardown,
};
