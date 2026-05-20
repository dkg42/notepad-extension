/**
 * @module drive-sync-service
 * @description Domain-level read/write facade that abstracts Drive AppData behind
 * typed per-domain methods (snippets, folders, tags, settings, pipelines, chat, etc.).
 * Reads follow a cache-first pattern: session cache hit returns immediately; on miss
 * the file is fetched from Drive and the cache is populated. Writes are local-first:
 * the session cache is updated synchronously then a debounced Drive write is enqueued
 * via drive-write-queue, ensuring the UI is never blocked by Drive API latency.
 * @dependencies ./drive-cache-service, ./drive-manifest-service, ./drive-io-service, ./drive-write-queue, ./types/drive-schemas
 * @public getSnippetsMeta, saveSnippetsMeta, saveSnippet, deleteSnippet, saveAllSnippets, getFolders, saveFolders, getTags, saveTags, getSettings, saveSettings, getExportHistory, appendExportRecord, saveExportHistory, saveHistoryData, getAnnotations, saveAnnotations, getPipelines, savePipelines, getPipelineRuns, appendPipelineRun, savePipelineRuns, getPodcastEpisodes, savePodcastEpisodes, getDomainRouterRules, saveDomainRouterRules, getChatConversationsMeta, saveChatConversationsMeta, getChatConversationContent, saveChatConversationContent, getCustomAudioIndex, saveCustomAudioIndex, getTabGroups, saveTabGroups, writeAllFromLocal, driveSyncService
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
  DrivePromptMeta,
  DrivePromptsMetaFile,
  DriveAppSettingsFile,
  DriveActivityDataFile,
  DriveNotebookRef,
  DriveNotebookDataFile,
  DrivePipelinesFile,
  DriveChatConversationsMetaFile,
  DriveConversationMetaLine,
  DriveSafePodcastEpisode,
  DrivePodcastAudioEntry,
  DrivePodcastAudioIndexFile,
  DriveTabGroup,
  DriveTabGroupsFile,
} from './types/drive-schemas';
import {
  DRIVE_SCHEMA_VERSION,
  chatContentFilename,
  toDriveSafeEpisode,
} from './types/drive-schemas';
import { CacheKeys, get as cacheGet, set as cacheSet } from './drive-cache-service';
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
import type { Snippet, Folder, TagMeta, NotebookAnnotation, PodcastEpisode } from '@/types';
import type { DashboardSettings, ExportRecord } from '@/types/dashboard';
import type { Pipeline, PipelineRun } from '@/types/pipeline';
import type { DomainRouterRule } from '@/types/import';
import type { ConversationMeta, ConversationFull } from '@/types/chat-history';
import type { TabGroup } from '@/types/tab-groups';

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

export async function getSnippetsMeta(token: string): Promise<DrivePromptMeta[]> {
  const cached = await cacheGet<DrivePromptsMetaFile>(CacheKeys.promptsMeta);
  if (cached) return cached.prompts;

  const file = await readJsonFromDrive<DrivePromptsMetaFile>('prompts-meta.json', CacheKeys.promptsMeta, token);
  return file?.prompts ?? [];
}

export function saveSnippetsMeta(metas: DrivePromptMeta[], token: string): void {
  const file: DrivePromptsMetaFile = {
    schemaVersion: DRIVE_SCHEMA_VERSION,
    updatedAt: Date.now(),
    prompts: metas,
  };
  writeJson('prompts-meta.json', CacheKeys.promptsMeta, file, token);
}

export async function saveSnippet(snippet: Snippet, token: string): Promise<void> {
  if (!_driveEnabled) return;
  const existing = await getSnippetsMeta(token);
  const newMeta: DrivePromptMeta = { ...snippet };
  const updated = existing.some((s) => s.id === snippet.id)
    ? existing.map((s) => (s.id === snippet.id ? newMeta : s))
    : [newMeta, ...existing];
  saveSnippetsMeta(updated, token);
}

export async function deleteSnippet(snippetId: string, token: string): Promise<void> {
  const existing = await getSnippetsMeta(token);
  saveSnippetsMeta(existing.filter((s) => s.id !== snippetId), token);
}

export async function saveAllSnippets(snippets: Snippet[], token: string): Promise<void> {
  if (!_driveEnabled) return;
  const metas: DrivePromptMeta[] = snippets.map((s) => ({ ...s }));
  saveSnippetsMeta(metas, token);
}

// ── app-settings.json helpers (folders + tags + settings + domain-router-rules)

async function readAppSettings(token: string): Promise<DriveAppSettingsFile | null> {
  const cached = await cacheGet<DriveAppSettingsFile>(CacheKeys.appSettings);
  if (cached) return cached;
  return readJsonFromDrive<DriveAppSettingsFile>('app-settings.json', CacheKeys.appSettings, token);
}

function writeAppSettings(file: DriveAppSettingsFile, token: string): void {
  if (!_driveEnabled) return;
  void cacheSet(CacheKeys.appSettings, file);
  enqueue('app-settings.json', JSON.stringify(file), token);
}

async function updateAppSettings(
  patch: Partial<Pick<DriveAppSettingsFile, 'folders' | 'tags' | 'settings' | 'domainRouterRules'>>,
  token: string,
): Promise<void> {
  const current = await readAppSettings(token);
  const updated: DriveAppSettingsFile = {
    schemaVersion: DRIVE_SCHEMA_VERSION,
    updatedAt: Date.now(),
    folders: patch.folders ?? current?.folders ?? [],
    tags: patch.tags ?? current?.tags ?? [],
    settings: patch.settings !== undefined ? patch.settings : (current?.settings ?? null),
    domainRouterRules: patch.domainRouterRules ?? current?.domainRouterRules ?? [],
  };
  writeAppSettings(updated, token);
}

// ── Folders ───────────────────────────────────────────────────────────────────

export async function getFolders(token: string): Promise<Folder[]> {
  const file = await readAppSettings(token);
  return file?.folders ?? [];
}

export function saveFolders(folders: Folder[], token: string): void {
  void updateAppSettings({ folders }, token);
}

// ── Tags ──────────────────────────────────────────────────────────────────────

export async function getTags(token: string): Promise<TagMeta[]> {
  const file = await readAppSettings(token);
  return file?.tags ?? [];
}

export function saveTags(tags: TagMeta[], token: string): void {
  void updateAppSettings({ tags }, token);
}

// ── Settings ──────────────────────────────────────────────────────────────────

export async function getSettings(token: string): Promise<DashboardSettings | null> {
  const file = await readAppSettings(token);
  return file?.settings ?? null;
}

export function saveSettings(settings: DashboardSettings, token: string): void {
  void updateAppSettings({ settings }, token);
}

// ── activity-data.json helpers (export-history + pipeline-runs + podcast-episodes)

async function readActivityData(token: string): Promise<DriveActivityDataFile | null> {
  const cached = await cacheGet<DriveActivityDataFile>(CacheKeys.activityData);
  if (cached) return cached;
  return readJsonFromDrive<DriveActivityDataFile>('activity-data.json', CacheKeys.activityData, token);
}

function writeActivityData(file: DriveActivityDataFile, token: string): void {
  if (!_driveEnabled) return;
  void cacheSet(CacheKeys.activityData, file);
  enqueue('activity-data.json', JSON.stringify(file), token);
}

async function updateActivityData(
  patch: Partial<Pick<DriveActivityDataFile, 'exportHistory' | 'pipelineRuns' | 'podcastEpisodes'>>,
  token: string,
): Promise<void> {
  const current = await readActivityData(token);
  const updated: DriveActivityDataFile = {
    schemaVersion: DRIVE_SCHEMA_VERSION,
    updatedAt: Date.now(),
    exportHistory: patch.exportHistory ?? current?.exportHistory ?? [],
    pipelineRuns: patch.pipelineRuns ?? current?.pipelineRuns ?? [],
    podcastEpisodes: patch.podcastEpisodes ?? current?.podcastEpisodes ?? [],
  };
  writeActivityData(updated, token);
}

/**
 * Writes export-history, pipeline-runs, and podcast-episodes in a single
 * consolidated activity-data.json write. Use this when pushing local-newer state
 * to Drive — calling the three single-slice setters in sequence would each do an
 * independent read-modify-write and lose the others' patches.
 */
export function saveHistoryData(
  data: { exportHistory: ExportRecord[]; pipelineRuns: PipelineRun[]; podcastEpisodes: PodcastEpisode[] },
  token: string,
): void {
  void updateActivityData(
    {
      exportHistory: data.exportHistory.slice(0, MAX_EXPORT_HISTORY),
      pipelineRuns: data.pipelineRuns.slice(0, MAX_PIPELINE_RUNS),
      podcastEpisodes: data.podcastEpisodes.map(toDriveSafeEpisode),
    },
    token,
  );
}

// ── Export history ─────────────────────────────────────────────────────────────

export async function getExportHistory(token: string): Promise<ExportRecord[]> {
  const file = await readActivityData(token);
  return file?.exportHistory ?? [];
}

export async function appendExportRecord(record: ExportRecord, token: string): Promise<void> {
  const existing = await getExportHistory(token);
  const exportHistory = [record, ...existing].slice(0, MAX_EXPORT_HISTORY);
  void updateActivityData({ exportHistory }, token);
}

/**
 * Replaces the entire export-history list in a single consolidated write.
 * Used when pushing local-newer state to Drive — avoids the O(n²) per-record
 * append loop.
 */
export function saveExportHistory(records: ExportRecord[], token: string): void {
  void updateActivityData({ exportHistory: records.slice(0, MAX_EXPORT_HISTORY) }, token);
}

// ── Notebook annotations ───────────────────────────────────────────────────────

export async function getAnnotations(
  token: string,
): Promise<{ annotations: NotebookAnnotation[]; folders: Folder[]; notebooks: DriveNotebookRef[] }> {
  const cached = await cacheGet<DriveNotebookDataFile>(CacheKeys.notebookData);
  if (cached) {
    return {
      annotations: cached.annotations,
      folders: cached.folders ?? [],
      notebooks: cached.notebooks ?? [],
    };
  }

  const file = await readJsonFromDrive<DriveNotebookDataFile>('notebook-data.json', CacheKeys.notebookData, token);
  return {
    annotations: file?.annotations ?? [],
    folders: file?.folders ?? [],
    notebooks: file?.notebooks ?? [],
  };
}

export function saveAnnotations(
  annotations: NotebookAnnotation[],
  folders: Folder[],
  notebooks: DriveNotebookRef[],
  token: string,
): void {
  const file: DriveNotebookDataFile = {
    schemaVersion: DRIVE_SCHEMA_VERSION,
    updatedAt: Date.now(),
    annotations,
    folders,
    notebooks,
  };
  writeJson('notebook-data.json', CacheKeys.notebookData, file, token);
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
  const file = await readActivityData(token);
  return file?.pipelineRuns ?? [];
}

export async function appendPipelineRun(run: PipelineRun, token: string): Promise<void> {
  const existing = await getPipelineRuns(token);
  const pipelineRuns = [run, ...existing].slice(0, MAX_PIPELINE_RUNS);
  void updateActivityData({ pipelineRuns }, token);
}

/**
 * Replaces the entire pipeline-run list in a single consolidated write.
 * Companion to saveExportHistory for the local-newer push path.
 */
export function savePipelineRuns(runs: PipelineRun[], token: string): void {
  void updateActivityData({ pipelineRuns: runs.slice(0, MAX_PIPELINE_RUNS) }, token);
}

// ── Podcast episodes ───────────────────────────────────────────────────────────

export async function getPodcastEpisodes(token: string): Promise<DriveSafePodcastEpisode[]> {
  const file = await readActivityData(token);
  return file?.podcastEpisodes ?? [];
}

export function savePodcastEpisodes(episodes: PodcastEpisode[], token: string): void {
  const podcastEpisodes = episodes.map(toDriveSafeEpisode);
  void updateActivityData({ podcastEpisodes }, token);
}

// ── Domain router rules ────────────────────────────────────────────────────────

export async function getDomainRouterRules(token: string): Promise<DomainRouterRule[]> {
  const file = await readAppSettings(token);
  return file?.domainRouterRules ?? [];
}

export function saveDomainRouterRules(rules: DomainRouterRule[], token: string): void {
  void updateAppSettings({ domainRouterRules: rules }, token);
}

// ── Chat history ───────────────────────────────────────────────────────────────

export async function getChatConversationsMeta(token: string): Promise<{ conversations: ConversationMeta[] }> {
  const cached = await cacheGet<DriveChatConversationsMetaFile>(CacheKeys.chatMeta);
  if (cached) return { conversations: cached.conversations };

  const file = await readJsonFromDrive<DriveChatConversationsMetaFile>('chat-conversations-meta.json', CacheKeys.chatMeta, token);
  return { conversations: file?.conversations ?? [] };
}

export function saveChatConversationsMeta(
  conversations: ConversationMeta[],
  token: string,
): void {
  const file: DriveChatConversationsMetaFile = {
    schemaVersion: DRIVE_SCHEMA_VERSION,
    updatedAt: Date.now(),
    conversations,
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

// ── Custom audio index ─────────────────────────────────────────────────────────

export async function getCustomAudioIndex(token: string): Promise<DrivePodcastAudioEntry[]> {
  const cached = await cacheGet<DrivePodcastAudioIndexFile>(CacheKeys.podcastAudioIndex);
  if (cached) return cached.entries ?? [];

  const file = await readJsonFromDrive<DrivePodcastAudioIndexFile>(
    'podcast-audio-index.json',
    CacheKeys.podcastAudioIndex,
    token,
  );
  return file?.entries ?? [];
}

export function saveCustomAudioIndex(entries: DrivePodcastAudioEntry[], token: string): void {
  const file: DrivePodcastAudioIndexFile = {
    schemaVersion: DRIVE_SCHEMA_VERSION,
    updatedAt: Date.now(),
    entries,
  };
  writeJson('podcast-audio-index.json', CacheKeys.podcastAudioIndex, file, token);
}

// ── Tab groups ─────────────────────────────────────────────────────────────────

/** Strips device-local/churn fields so the synced record is portable. */
function toDriveTabGroup(g: TabGroup): DriveTabGroup {
  return {
    id: g.id,
    name: g.name,
    color: g.color,
    pinned: g.pinned,
    context: g.context,
    aiContext: g.aiContext,
    createdAt: g.createdAt,
    tabUrls: g.tabUrls,
    stashedTabs: g.stashedTabs,
  };
}

export async function getTabGroups(token: string): Promise<DriveTabGroup[]> {
  const cached = await cacheGet<DriveTabGroupsFile>(CacheKeys.tabGroups);
  if (cached) return cached.groups ?? [];

  const file = await readJsonFromDrive<DriveTabGroupsFile>(
    'tab-groups.json',
    CacheKeys.tabGroups,
    token,
  );
  return file?.groups ?? [];
}

export function saveTabGroups(groups: TabGroup[], token: string): void {
  const file: DriveTabGroupsFile = {
    schemaVersion: DRIVE_SCHEMA_VERSION,
    updatedAt: Date.now(),
    groups: groups.map(toDriveTabGroup),
  };
  writeJson('tab-groups.json', CacheKeys.tabGroups, file, token);
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
  notebookFolders: Folder[];
  notebooks: DriveNotebookRef[];
  pipelines: Pipeline[];
  pipelineRuns: PipelineRun[];
  podcastEpisodes: PodcastEpisode[];
  domainRouterRules: DomainRouterRule[];
  conversations: ConversationMeta[];
  tabGroups: TabGroup[];
}, token: string): Promise<void> {
  await saveAllSnippets(data.snippets, token);

  // Write consolidated files directly to avoid partial overwrites from individual save helpers.
  const coreFile: DriveAppSettingsFile = {
    schemaVersion: DRIVE_SCHEMA_VERSION,
    updatedAt: Date.now(),
    folders: data.folders,
    tags: data.tags,
    settings: data.settings,
    domainRouterRules: data.domainRouterRules,
  };
  writeAppSettings(coreFile, token);

  const historyFile: DriveActivityDataFile = {
    schemaVersion: DRIVE_SCHEMA_VERSION,
    updatedAt: Date.now(),
    exportHistory: data.exportHistory.slice(0, MAX_EXPORT_HISTORY),
    pipelineRuns: data.pipelineRuns.slice(0, MAX_PIPELINE_RUNS),
    podcastEpisodes: data.podcastEpisodes.map(toDriveSafeEpisode),
  };
  writeActivityData(historyFile, token);

  saveAnnotations(data.annotations, data.notebookFolders, data.notebooks, token);
  savePipelines(data.pipelines, token);
  saveChatConversationsMeta(data.conversations, token);
  saveTabGroups(data.tabGroups, token);
}

export const driveSyncService = {
  getSnippetsMeta,
  saveSnippetsMeta,
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
  saveExportHistory,
  saveHistoryData,
  getAnnotations,
  saveAnnotations,
  getPipelines,
  savePipelines,
  getPipelineRuns,
  appendPipelineRun,
  savePipelineRuns,
  getPodcastEpisodes,
  savePodcastEpisodes,
  getDomainRouterRules,
  saveDomainRouterRules,
  getChatConversationsMeta,
  saveChatConversationsMeta,
  getChatConversationContent,
  saveChatConversationContent,
  getCustomAudioIndex,
  saveCustomAudioIndex,
  getTabGroups,
  saveTabGroups,
  writeAllFromLocal,
};
