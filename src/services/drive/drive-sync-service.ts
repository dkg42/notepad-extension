/**
 * @module drive-sync-service
 * @description Domain-level read/write facade that abstracts Drive AppData behind
 * typed per-domain methods (snippets, folders, tags, settings, pipelines, chat, etc.).
 * Reads follow a cache-first pattern: session cache hit returns immediately; on miss
 * the file is fetched from Drive and the cache is populated. Writes are local-first:
 * the session cache is updated synchronously then a debounced Drive write is enqueued
 * via drive-write-queue, ensuring the UI is never blocked by Drive API latency.
 * @dependencies ./drive-cache-service, ./drive-manifest-service, ./drive-io-service, ./drive-write-queue, ./types/drive-schemas
 * @public getSnippetsMeta, saveSnippetsMeta, getSnippetText, saveSnippet, deleteSnippet, saveAllSnippets, getFolders, saveFolders, getTags, saveTags, getSettings, saveSettings, getExportHistory, appendExportRecord, getAnnotations, saveAnnotations, getPipelines, savePipelines, getPipelineRuns, appendPipelineRun, getPodcastEpisodes, savePodcastEpisodes, getDomainRouterRules, saveDomainRouterRules, getChatConversationsMeta, saveChatConversationsMeta, getChatConversationContent, saveChatConversationContent, writeAllFromLocal, driveSyncService
 */

/**
 * drive-sync-service.ts
 *
 * Domain-level read/write facade for Drive AppData.
 *
 * Called by existing storage services (storage-service, pipeline-service, etc.)
 * to sync data to Drive without those services needing to know Drive internals.
 *
 * Read pattern (cache-first):
 *   1. Check session-storage cache → return immediately on hit (no Drive call).
 *   2. On miss: read from Drive → populate cache → return data.
 *
 * Write pattern (local-first, async Drive sync):
 *   Callers write to chrome.storage.local first (handled in the calling service).
 *   This service then:
 *   1. Updates the session-storage cache with the new data.
 *   2. Serializes the data and enqueues a debounced Drive write.
 *
 * This means the UI is never blocked by Drive API latency.
 */

import type {
  DriveSnippetMeta,
  DriveSnippetsMetaFile,
  DriveCoreDataFile,
  DriveHistoryDataFile,
  DriveNotebookAnnotationsFile,
  DrivePipelinesFile,
  DriveChatConversationsMetaFile,
  DriveConversationMetaLine,
  DriveSafePodcastEpisode,
} from './types/drive-schemas';
import {
  DRIVE_SCHEMA_VERSION,
  snippetTextFilename,
  chatContentFilename,
  toDriveSafeEpisode,
} from './types/drive-schemas';
import { CacheKeys, get as cacheGet, set as cacheSet, invalidate as cacheInvalidate } from './drive-cache-service';
import { getEntry } from './drive-manifest-service';
import { readFile } from './drive-io-service';
import { enqueue } from './drive-write-queue';
import { authStorageService } from '@/services/auth-storage-service';

// Cached pro-status — updated eagerly on load and on claims changes.
// Drive writes are no-ops for free-tier users; reads return null (no Drive files exist).
let _driveEnabled = false;
void authStorageService.getAuthClaims().then((claims) => {
  _driveEnabled = claims?.subscriptionStatus === 'active' &&
    (claims.subscriptionPlan === 'pro_monthly' || claims.subscriptionPlan === 'pro_yearly');
});
authStorageService.onClaimsChanged((claims) => {
  _driveEnabled = claims?.subscriptionStatus === 'active' &&
    (claims.subscriptionPlan === 'pro_monthly' || claims.subscriptionPlan === 'pro_yearly');
});
import type { Snippet, Folder, TagMeta, NotebookAnnotation, NotebookCollection, PodcastEpisode } from '@/types';
import type { DashboardSettings, ExportRecord } from '@/types/dashboard';
import type { Pipeline, PipelineRun } from '@/types/pipeline';
import type { DomainRouterRule } from '@/types/import';
import type { ConversationMeta, ConversationFull, ChatSyncMeta } from '@/types/chat-history';

const MAX_EXPORT_HISTORY = 200;
const MAX_PIPELINE_RUNS = 200;

// ── Internal helpers ───────────────────────────────────────────────────────────

/**
 * Reads a JSON file from Drive and populates the session cache.
 * Returns null if the file does not exist or read fails.
 * For free-tier users (_driveEnabled=false), returns null on a cache miss rather
 * than making a Drive API call — but cached data (from a prior pro session) is
 * always returned via the callers' cache-check guard above.
 */
async function readJsonFromDrive<T>(
  filename: string,
  cacheKey: string,
  token: string,
): Promise<T | null> {
  if (!_driveEnabled) return null;

  const entry = getEntry(filename);
  if (!entry?.driveFileId) return null;

  const result = await readFile(entry.driveFileId, token);

  if (!result.ok) {
    console.warn(`[DRIVE-SYNC] Failed to read ${filename}:`, result.error);
    return null;
  }

  try {
    const parsed = JSON.parse(result.data) as T;
    await cacheSet(cacheKey, parsed);
    return parsed;
  } catch (err) {
    console.error(`[DRIVE-SYNC] Failed to parse ${filename}:`, err);
    return null;
  }
}

/**
 * Enqueues a JSON file write to Drive and updates the session cache.
 * No-op for free-tier users (_driveEnabled === false).
 */
function writeJson<T>(filename: string, cacheKey: string, data: T, token: string): void {
  if (!_driveEnabled) return;
  void cacheSet(cacheKey, data);
  enqueue(filename, JSON.stringify(data), token);
}

// ── Snippets ───────────────────────────────────────────────────────────────────

export async function getSnippetsMeta(token: string): Promise<DriveSnippetMeta[]> {
  const cached = await cacheGet<DriveSnippetsMetaFile>(CacheKeys.snippetsMeta);
  if (cached) return cached.snippets;

  const file = await readJsonFromDrive<DriveSnippetsMetaFile>('snippets-meta.json', CacheKeys.snippetsMeta, token);
  return file?.snippets ?? [];
}

export function saveSnippetsMeta(metas: DriveSnippetMeta[], token: string): void {
  const file: DriveSnippetsMetaFile = {
    schemaVersion: DRIVE_SCHEMA_VERSION,
    updatedAt: Date.now(),
    snippets: metas,
  };
  writeJson('snippets-meta.json', CacheKeys.snippetsMeta, file, token);
}

/**
 * Reads the raw text of a single snippet from Drive.
 * Returns null on cache miss + Drive miss.
 */
export async function getSnippetText(snippetId: string, token: string): Promise<string | null> {
  const cacheKey = CacheKeys.snippetText(snippetId);
  const cached = await cacheGet<string>(cacheKey);
  if (cached !== null) return cached;

  if (!_driveEnabled) return null;

  const filename = snippetTextFilename(snippetId);
  const entry = getEntry(filename);
  if (!entry?.driveFileId) return null;

  const result = await readFile(entry.driveFileId, token);
  if (!result.ok) return null;

  await cacheSet(cacheKey, result.data);
  return result.data;
}

/**
 * Saves a snippet to Drive: upserts the metadata index and enqueues
 * a separate .txt file write for the text body.
 */
export async function saveSnippet(snippet: Snippet, token: string): Promise<void> {
  if (!_driveEnabled) return;
  // Update snippet text file
  const textFilename = snippetTextFilename(snippet.id);
  const textCacheKey = CacheKeys.snippetText(snippet.id);
  await cacheSet(textCacheKey, snippet.text);
  enqueue(textFilename, snippet.text, token);

  // Update metadata index
  const existing = await getSnippetsMeta(token);
  const { text: _text, ...meta } = snippet;
  const newMeta: DriveSnippetMeta = { ...meta, textFileId: null }; // fileId resolved by write queue
  const updated = existing.some((s) => s.id === snippet.id)
    ? existing.map((s) => (s.id === snippet.id ? newMeta : s))
    : [newMeta, ...existing];
  saveSnippetsMeta(updated, token);
}

export async function deleteSnippet(snippetId: string, token: string): Promise<void> {
  await cacheInvalidate(CacheKeys.snippetText(snippetId));

  const existing = await getSnippetsMeta(token);
  saveSnippetsMeta(existing.filter((s) => s.id !== snippetId), token);
}

export async function saveAllSnippets(snippets: Snippet[], token: string): Promise<void> {
  if (!_driveEnabled) return;
  const metas: DriveSnippetMeta[] = snippets.map(({ text: _text, ...meta }) => ({
    ...meta,
    textFileId: null,
  }));
  saveSnippetsMeta(metas, token);

  // Enqueue text files for all snippets
  for (const snippet of snippets) {
    const textFilename = snippetTextFilename(snippet.id);
    await cacheSet(CacheKeys.snippetText(snippet.id), snippet.text);
    enqueue(textFilename, snippet.text, token);
  }
}

// ── core-data.json helpers (folders + tags + settings + domain-router-rules) ──

async function readCoreData(token: string): Promise<DriveCoreDataFile | null> {
  const cached = await cacheGet<DriveCoreDataFile>(CacheKeys.coreData);
  if (cached) return cached;
  return readJsonFromDrive<DriveCoreDataFile>('core-data.json', CacheKeys.coreData, token);
}

function writeCoreData(file: DriveCoreDataFile, token: string): void {
  if (!_driveEnabled) return;
  void cacheSet(CacheKeys.coreData, file);
  enqueue('core-data.json', JSON.stringify(file), token);
}

async function updateCoreData(
  patch: Partial<Pick<DriveCoreDataFile, 'folders' | 'tags' | 'settings' | 'domainRouterRules'>>,
  token: string,
): Promise<void> {
  const current = await readCoreData(token);
  const updated: DriveCoreDataFile = {
    schemaVersion: DRIVE_SCHEMA_VERSION,
    updatedAt: Date.now(),
    folders: patch.folders ?? current?.folders ?? [],
    tags: patch.tags ?? current?.tags ?? [],
    settings: patch.settings !== undefined ? patch.settings : (current?.settings ?? null),
    domainRouterRules: patch.domainRouterRules ?? current?.domainRouterRules ?? [],
  };
  writeCoreData(updated, token);
}

// ── Folders ───────────────────────────────────────────────────────────────────

export async function getFolders(token: string): Promise<Folder[]> {
  const file = await readCoreData(token);
  return file?.folders ?? [];
}

export function saveFolders(folders: Folder[], token: string): void {
  void updateCoreData({ folders }, token);
}

// ── Tags ──────────────────────────────────────────────────────────────────────

export async function getTags(token: string): Promise<TagMeta[]> {
  const file = await readCoreData(token);
  return file?.tags ?? [];
}

export function saveTags(tags: TagMeta[], token: string): void {
  void updateCoreData({ tags }, token);
}

// ── Settings ──────────────────────────────────────────────────────────────────

export async function getSettings(token: string): Promise<DashboardSettings | null> {
  const file = await readCoreData(token);
  return file?.settings ?? null;
}

export function saveSettings(settings: DashboardSettings, token: string): void {
  void updateCoreData({ settings }, token);
}

// ── history-data.json helpers (export-history + pipeline-runs + podcast-episodes)

async function readHistoryData(token: string): Promise<DriveHistoryDataFile | null> {
  const cached = await cacheGet<DriveHistoryDataFile>(CacheKeys.historyData);
  if (cached) return cached;
  return readJsonFromDrive<DriveHistoryDataFile>('history-data.json', CacheKeys.historyData, token);
}

function writeHistoryData(file: DriveHistoryDataFile, token: string): void {
  if (!_driveEnabled) return;
  void cacheSet(CacheKeys.historyData, file);
  enqueue('history-data.json', JSON.stringify(file), token);
}

async function updateHistoryData(
  patch: Partial<Pick<DriveHistoryDataFile, 'exportHistory' | 'pipelineRuns' | 'podcastEpisodes'>>,
  token: string,
): Promise<void> {
  const current = await readHistoryData(token);
  const updated: DriveHistoryDataFile = {
    schemaVersion: DRIVE_SCHEMA_VERSION,
    updatedAt: Date.now(),
    exportHistory: patch.exportHistory ?? current?.exportHistory ?? [],
    pipelineRuns: patch.pipelineRuns ?? current?.pipelineRuns ?? [],
    podcastEpisodes: patch.podcastEpisodes ?? current?.podcastEpisodes ?? [],
  };
  writeHistoryData(updated, token);
}

// ── Export history ─────────────────────────────────────────────────────────────

export async function getExportHistory(token: string): Promise<ExportRecord[]> {
  const file = await readHistoryData(token);
  return file?.exportHistory ?? [];
}

export async function appendExportRecord(record: ExportRecord, token: string): Promise<void> {
  const existing = await getExportHistory(token);
  const exportHistory = [record, ...existing].slice(0, MAX_EXPORT_HISTORY);
  void updateHistoryData({ exportHistory }, token);
}

// ── Notebook annotations ───────────────────────────────────────────────────────

export async function getAnnotations(token: string): Promise<{ annotations: NotebookAnnotation[]; collections: NotebookCollection[] }> {
  const cached = await cacheGet<DriveNotebookAnnotationsFile>(CacheKeys.annotations);
  if (cached) return { annotations: cached.annotations, collections: cached.collections };

  const file = await readJsonFromDrive<DriveNotebookAnnotationsFile>('notebook-annotations.json', CacheKeys.annotations, token);
  return { annotations: file?.annotations ?? [], collections: file?.collections ?? [] };
}

export function saveAnnotations(
  annotations: NotebookAnnotation[],
  collections: NotebookCollection[],
  token: string,
): void {
  const file: DriveNotebookAnnotationsFile = {
    schemaVersion: DRIVE_SCHEMA_VERSION,
    updatedAt: Date.now(),
    annotations,
    collections,
  };
  writeJson('notebook-annotations.json', CacheKeys.annotations, file, token);
}

// ── Pipelines ─────────────────────────────────────────────────────────────────

export async function getPipelines(token: string): Promise<Pipeline[]> {
  const cached = await cacheGet<DrivePipelinesFile>(CacheKeys.pipelines);
  if (cached) return cached.pipelines;

  const file = await readJsonFromDrive<DrivePipelinesFile>('pipelines.json', CacheKeys.pipelines, token);
  return file?.pipelines ?? [];
}

export function savePipelines(pipelines: Pipeline[], token: string): void {
  const file: DrivePipelinesFile = { schemaVersion: DRIVE_SCHEMA_VERSION, updatedAt: Date.now(), pipelines };
  writeJson('pipelines.json', CacheKeys.pipelines, file, token);
}

// ── Pipeline runs ─────────────────────────────────────────────────────────────

export async function getPipelineRuns(token: string): Promise<PipelineRun[]> {
  const file = await readHistoryData(token);
  return file?.pipelineRuns ?? [];
}

export async function appendPipelineRun(run: PipelineRun, token: string): Promise<void> {
  const existing = await getPipelineRuns(token);
  const pipelineRuns = [run, ...existing].slice(0, MAX_PIPELINE_RUNS);
  void updateHistoryData({ pipelineRuns }, token);
}

// ── Podcast episodes ───────────────────────────────────────────────────────────

export async function getPodcastEpisodes(token: string): Promise<DriveSafePodcastEpisode[]> {
  const file = await readHistoryData(token);
  return file?.podcastEpisodes ?? [];
}

export function savePodcastEpisodes(episodes: PodcastEpisode[], token: string): void {
  const podcastEpisodes = episodes.map(toDriveSafeEpisode);
  void updateHistoryData({ podcastEpisodes }, token);
}

// ── Domain router rules ────────────────────────────────────────────────────────

export async function getDomainRouterRules(token: string): Promise<DomainRouterRule[]> {
  const file = await readCoreData(token);
  return file?.domainRouterRules ?? [];
}

export function saveDomainRouterRules(rules: DomainRouterRule[], token: string): void {
  void updateCoreData({ domainRouterRules: rules }, token);
}

// ── Chat history ───────────────────────────────────────────────────────────────

export async function getChatConversationsMeta(token: string): Promise<{ conversations: ConversationMeta[]; syncMeta: ChatSyncMeta[] }> {
  const cached = await cacheGet<DriveChatConversationsMetaFile>(CacheKeys.chatMeta);
  if (cached) return { conversations: cached.conversations, syncMeta: cached.syncMeta };

  const file = await readJsonFromDrive<DriveChatConversationsMetaFile>('chat-conversations-meta.json', CacheKeys.chatMeta, token);
  return { conversations: file?.conversations ?? [], syncMeta: file?.syncMeta ?? [] };
}

export function saveChatConversationsMeta(
  conversations: ConversationMeta[],
  syncMeta: ChatSyncMeta[],
  token: string,
): void {
  const file: DriveChatConversationsMetaFile = {
    schemaVersion: DRIVE_SCHEMA_VERSION,
    updatedAt: Date.now(),
    conversations,
    syncMeta,
  };
  writeJson('chat-conversations-meta.json', CacheKeys.chatMeta, file, token);
}

/**
 * Reads a single conversation's full content from Drive.
 * The file is NDJSON: first line is DriveConversationMetaLine, remaining lines are ConversationMessage objects.
 */
export async function getChatConversationContent(
  platform: string,
  id: string,
  token: string,
): Promise<ConversationFull | null> {
  const filename = chatContentFilename(platform, id);
  const cacheKey = CacheKeys.chatContent(platform, id);

  const cachedNdjson = await cacheGet<string>(cacheKey);
  if (cachedNdjson !== null) return parseConversationNdjson(cachedNdjson);

  if (!_driveEnabled) return null;

  const entry = getEntry(filename);
  if (!entry?.driveFileId) return null;

  const result = await readFile(entry.driveFileId, token);
  if (!result.ok) return null;

  await cacheSet(cacheKey, result.data);
  return parseConversationNdjson(result.data);
}

/**
 * Saves a full conversation to Drive as NDJSON.
 * First line: { _meta, fetchedAt }; subsequent lines: one ConversationMessage per line.
 */
export async function saveChatConversationContent(full: ConversationFull, token: string): Promise<void> {
  if (!_driveEnabled) return;
  const filename = chatContentFilename(full.meta.platform, full.meta.id);
  const cacheKey = CacheKeys.chatContent(full.meta.platform, full.meta.id);

  const metaLine: DriveConversationMetaLine = { _meta: full.meta, fetchedAt: full.fetchedAt };
  const lines = [
    JSON.stringify(metaLine),
    ...full.messages.map((m) => JSON.stringify(m)),
  ];
  const ndjson = lines.join('\n');

  await cacheSet(cacheKey, ndjson);
  enqueue(filename, ndjson, token);
}

function parseConversationNdjson(ndjson: string): ConversationFull | null {
  try {
    const lines = ndjson.split('\n').filter(Boolean);
    if (lines.length === 0) return null;

    const metaLine = JSON.parse(lines[0]) as DriveConversationMetaLine;
    const messages = lines.slice(1).map((l) => JSON.parse(l) as ConversationFull['messages'][0]);
    return { meta: metaLine._meta, messages, fetchedAt: metaLine.fetchedAt };
  } catch {
    return null;
  }
}

// ── Convenience bulk methods ───────────────────────────────────────────────────

/**
 * Populates Drive with the full dataset from chrome.storage.local.
 * Used by drive-init-service during first-time migration.
 */
export async function writeAllFromLocal(data: {
  snippets: Snippet[];
  folders: Folder[];
  tags: TagMeta[];
  settings: DashboardSettings;
  exportHistory: ExportRecord[];
  annotations: NotebookAnnotation[];
  collections: NotebookCollection[];
  pipelines: Pipeline[];
  pipelineRuns: PipelineRun[];
  podcastEpisodes: PodcastEpisode[];
  domainRouterRules: DomainRouterRule[];
  conversations: ConversationMeta[];
  chatSyncMeta: ChatSyncMeta[];
}, token: string): Promise<void> {
  await saveAllSnippets(data.snippets, token);

  // Write consolidated files directly to avoid partial overwrites from individual save helpers.
  const coreFile: DriveCoreDataFile = {
    schemaVersion: DRIVE_SCHEMA_VERSION,
    updatedAt: Date.now(),
    folders: data.folders,
    tags: data.tags,
    settings: data.settings,
    domainRouterRules: data.domainRouterRules,
  };
  writeCoreData(coreFile, token);

  const historyFile: DriveHistoryDataFile = {
    schemaVersion: DRIVE_SCHEMA_VERSION,
    updatedAt: Date.now(),
    exportHistory: data.exportHistory.slice(0, MAX_EXPORT_HISTORY),
    pipelineRuns: data.pipelineRuns.slice(0, MAX_PIPELINE_RUNS),
    podcastEpisodes: data.podcastEpisodes.map(toDriveSafeEpisode),
  };
  writeHistoryData(historyFile, token);

  saveAnnotations(data.annotations, data.collections, token);
  savePipelines(data.pipelines, token);
  saveChatConversationsMeta(data.conversations, data.chatSyncMeta, token);
}

export const driveSyncService = {
  getSnippetsMeta,
  saveSnippetsMeta,
  getSnippetText,
  saveSnippet,
  deleteSnippet,
  saveAllSnippets,
  getFolders,
  saveFolders,
  getTags,
  saveTags,
  getSettings,
  saveSettings,
  getExportHistory,
  appendExportRecord,
  getAnnotations,
  saveAnnotations,
  getPipelines,
  savePipelines,
  getPipelineRuns,
  appendPipelineRun,
  getPodcastEpisodes,
  savePodcastEpisodes,
  getDomainRouterRules,
  saveDomainRouterRules,
  getChatConversationsMeta,
  saveChatConversationsMeta,
  getChatConversationContent,
  saveChatConversationContent,
  writeAllFromLocal,
};
