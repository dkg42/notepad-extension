/**
 * @module storage-service
 * @description Central persistence layer for all extension user data (snippets, folders, tags, settings, export history, podcast episodes). Every chrome.storage.local read/write for user-authored content is channelled through this module so storage concerns stay isolated from UI code. Each mutating operation also fires a best-effort Drive sync tail-call if the user has granted Drive scope.
 * @dependencies token-lifecycle-service, drive/drive-sync-service, utils/folder-utils
 * @public storageService
 */
import type { Folder, PodcastEpisode, EpisodeTrack, Snippet, TagMeta } from '@/types';
import type { DashboardSettings, ExportRecord } from '@/types/dashboard';
import { getFolderSubtreeIds } from '@/utils/folder-utils';
import { driveSyncService } from './drive/drive-sync-service';
import { getValidToken } from './token-lifecycle-service';

const SNIPPETS_KEY = 'snippets';
const FOLDERS_KEY = 'folders';
const SETTINGS_KEY = 'dashboardSettings';
const TAGS_META_KEY = 'tagsMeta';
const EXPORT_HISTORY_KEY = 'exportHistory';
const PODCAST_EPISODES_KEY = 'podcastEpisodes';

const DEFAULT_SETTINGS: DashboardSettings = {
  theme: 'light',
  rowsPerPage: 25,
  defaultSortColumn: 'savedAt',
  defaultSortDirection: 'desc',
};

/**
 * Returns the current OAuth access token if Drive scope is granted.
 * Returns null if the user is not signed in or Drive scope is missing.
 * Used for fire-and-forget Drive sync tail calls — failures are silent.
 */
async function getDriveToken(): Promise<string | null> {
  const result = await getValidToken();
  if (!result.ok || !result.hasDriveScope) return null;
  return result.accessToken;
}

/**
 * Single-responsibility service for persisting all extension data via chrome.storage.local.
 * All reads and writes go through this module so storage concerns stay isolated.
 */
export const storageService = {
  // ── Snippets ──────────────────────────────────────────────────────────────

  /**
   * Returns all stored snippets, newest first.
   * @returns Array of Snippet objects; empty array if none saved.
   */
  async getAll(): Promise<Snippet[]> {
    const result = await chrome.storage.local.get(SNIPPETS_KEY);
    return (result[SNIPPETS_KEY] as Snippet[]) ?? [];
  },

  /**
   * Persists a new snippet and syncs to Drive.
   * @param text The raw text content to save.
   * @param source Full URL of the source page.
   * @param folderId Optional folder to place the snippet in.
   * @returns The newly created Snippet with generated id and timestamp.
   * @sideEffect Drive sync
   */
  async save(text: string, source: string, folderId?: string): Promise<Snippet> {
    const snippet: Snippet = {
      id: crypto.randomUUID(),
      text,
      source,
      savedAt: Date.now(),
      folderId,
    };
    const existing = await this.getAll();
    await chrome.storage.local.set({ [SNIPPETS_KEY]: [snippet, ...existing] });
    void getDriveToken().then((t) => { if (t) void driveSyncService.saveSnippet(snippet, t); });
    return snippet;
  },

  /**
   * Persists a new snippet with full metadata and syncs to Drive.
   * @param opts.title Optional display title for the snippet.
   * @param opts.text The raw text content to save.
   * @param opts.source Source URL; defaults to `'notehublm'` if omitted.
   * @param opts.tags Optional array of tag names to attach.
   * @param opts.folderId Optional folder to place the snippet in.
   * @returns The newly created Snippet with generated id and timestamp.
   * @sideEffect Drive sync
   */
  async saveWithMeta(opts: {
    title?: string;
    text: string;
    source?: string;
    tags?: string[];
    folderId?: string;
  }): Promise<Snippet> {
    const snippet: Snippet = {
      id: crypto.randomUUID(),
      title: opts.title,
      text: opts.text,
      source: opts.source ?? 'notehublm',
      savedAt: Date.now(),
      folderId: opts.folderId,
      tags: opts.tags,
    };
    const existing = await this.getAll();
    await chrome.storage.local.set({ [SNIPPETS_KEY]: [snippet, ...existing] });
    void getDriveToken().then((t) => { if (t) void driveSyncService.saveSnippet(snippet, t); });
    return snippet;
  },

  /**
   * Saves multiple texts in a single read-write cycle to avoid race conditions and syncs to Drive.
   * @param texts Array of raw text strings to persist as individual snippets.
   * @param source Full URL of the source page.
   * @param folderId Optional folder to place all new snippets in.
   * @returns Array of newly created Snippet objects.
   * @sideEffect Drive sync
   */
  async saveMany(texts: string[], source: string, folderId?: string): Promise<Snippet[]> {
    const now = Date.now();
    const newSnippets: Snippet[] = texts.map((text) => ({
      id: crypto.randomUUID(),
      text,
      source,
      savedAt: now,
      folderId,
    }));
    const existing = await this.getAll();
    await chrome.storage.local.set({ [SNIPPETS_KEY]: [...newSnippets, ...existing] });
    void getDriveToken().then((t) => { if (t) void driveSyncService.saveAllSnippets([...newSnippets, ...existing], t); });
    return newSnippets;
  },

  /**
   * Removes a single snippet by id and syncs the deletion to Drive.
   * @param id UUID of the snippet to delete.
   * @sideEffect Drive sync
   */
  async remove(id: string): Promise<void> {
    const existing = await this.getAll();
    await chrome.storage.local.set({
      [SNIPPETS_KEY]: existing.filter((s) => s.id !== id),
    });
    void getDriveToken().then((t) => { if (t) void driveSyncService.deleteSnippet(id, t); });
  },

  /**
   * Assigns a snippet to a folder (or removes it from any folder) and syncs metadata to Drive.
   * @param snippetId UUID of the snippet to move.
   * @param folderId Target folder UUID, or `undefined` to place in the root.
   * @sideEffect Drive sync
   */
  async moveToFolder(snippetId: string, folderId: string | undefined): Promise<void> {
    const existing = await this.getAll();
    const updated = existing.map((s) => s.id === snippetId ? { ...s, folderId } : s);
    await chrome.storage.local.set({ [SNIPPETS_KEY]: updated });
    void getDriveToken().then((t) => { if (t) driveSyncService.saveSnippetsMeta(updated.map(({ text: _t, ...m }) => ({ ...m, textFileId: null })), t); });
  },

  /**
   * Replaces the tag list on a single snippet and syncs metadata to Drive.
   * @param snippetId UUID of the snippet to update.
   * @param tags New complete list of tag names (replaces existing tags).
   * @sideEffect Drive sync
   */
  async updateTags(snippetId: string, tags: string[]): Promise<void> {
    const existing = await this.getAll();
    const updated = existing.map((s) => s.id === snippetId ? { ...s, tags } : s);
    await chrome.storage.local.set({ [SNIPPETS_KEY]: updated });
    void getDriveToken().then((t) => { if (t) driveSyncService.saveSnippetsMeta(updated.map(({ text: _t, ...m }) => ({ ...m, textFileId: null })), t); });
  },

  /**
   * Flips the `isFavorite` flag on a snippet and syncs metadata to Drive.
   * @param id UUID of the snippet whose favorite state should be toggled.
   * @sideEffect Drive sync
   */
  async toggleFavorite(id: string): Promise<void> {
    const existing = await this.getAll();
    const updated = existing.map((s) => s.id === id ? { ...s, isFavorite: !s.isFavorite } : s);
    await chrome.storage.local.set({ [SNIPPETS_KEY]: updated });
    void getDriveToken().then((t) => { if (t) driveSyncService.saveSnippetsMeta(updated.map(({ text: _t, ...m }) => ({ ...m, textFileId: null })), t); });
  },

  /**
   * Deletes all snippets and syncs the empty list to Drive.
   * @sideEffect Drive sync
   */
  async clear(): Promise<void> {
    await chrome.storage.local.set({ [SNIPPETS_KEY]: [] });
    void getDriveToken().then((t) => { if (t) driveSyncService.saveSnippetsMeta([], t); });
  },

  /**
   * Removes all user data keys (snippets, folders, tags, export history, podcast episodes) from local storage. Does not touch settings.
   */
  async clearAllData(): Promise<void> {
    await chrome.storage.local.remove([
      SNIPPETS_KEY,
      FOLDERS_KEY,
      TAGS_META_KEY,
      EXPORT_HISTORY_KEY,
      PODCAST_EPISODES_KEY,
    ]);
  },

  // ── Bulk Operations ────────────────────────────────────────────────────────

  /**
   * Removes multiple snippets by id in a single write and syncs metadata to Drive.
   * @param ids Array of snippet UUIDs to delete.
   * @sideEffect Drive sync
   */
  async bulkDelete(ids: string[]): Promise<void> {
    const idSet = new Set(ids);
    const existing = await this.getAll();
    const updated = existing.filter((s) => !idSet.has(s.id));
    await chrome.storage.local.set({ [SNIPPETS_KEY]: updated });
    void getDriveToken().then((t) => { if (t) driveSyncService.saveSnippetsMeta(updated.map(({ text: _t, ...m }) => ({ ...m, textFileId: null })), t); });
  },

  /**
   * Moves multiple snippets to the given folder (or root) in a single write and syncs metadata to Drive.
   * @param ids Array of snippet UUIDs to move.
   * @param folderId Target folder UUID, or `undefined` to place in the root.
   * @sideEffect Drive sync
   */
  async bulkMoveToFolder(ids: string[], folderId: string | undefined): Promise<void> {
    const idSet = new Set(ids);
    const existing = await this.getAll();
    const updated = existing.map((s) => idSet.has(s.id) ? { ...s, folderId } : s);
    await chrome.storage.local.set({ [SNIPPETS_KEY]: updated });
    void getDriveToken().then((t) => { if (t) driveSyncService.saveSnippetsMeta(updated.map(({ text: _t, ...m }) => ({ ...m, textFileId: null })), t); });
  },

  /**
   * Merges the given tags into each targeted snippet (deduplicates) and syncs metadata to Drive.
   * @param ids Array of snippet UUIDs to update.
   * @param tags Tag names to add; duplicates within a snippet are ignored.
   * @sideEffect Drive sync
   */
  async bulkAddTags(ids: string[], tags: string[]): Promise<void> {
    const idSet = new Set(ids);
    const existing = await this.getAll();
    const updated = existing.map((s) => {
      if (!idSet.has(s.id)) return s;
      const merged = Array.from(new Set([...(s.tags ?? []), ...tags]));
      return { ...s, tags: merged };
    });
    await chrome.storage.local.set({ [SNIPPETS_KEY]: updated });
    void getDriveToken().then((t) => { if (t) driveSyncService.saveSnippetsMeta(updated.map(({ text: _t, ...m }) => ({ ...m, textFileId: null })), t); });
  },

  /**
   * Strips the given tags from each targeted snippet and syncs metadata to Drive.
   * @param ids Array of snippet UUIDs to update.
   * @param tags Tag names to remove; tags not present on a snippet are silently skipped.
   * @sideEffect Drive sync
   */
  async bulkRemoveTags(ids: string[], tags: string[]): Promise<void> {
    const idSet = new Set(ids);
    const removeSet = new Set(tags);
    const existing = await this.getAll();
    const updated = existing.map((s) => {
      if (!idSet.has(s.id)) return s;
      return { ...s, tags: (s.tags ?? []).filter((t) => !removeSet.has(t)) };
    });
    await chrome.storage.local.set({ [SNIPPETS_KEY]: updated });
    void getDriveToken().then((t) => { if (t) driveSyncService.saveSnippetsMeta(updated.map(({ text: _t, ...m }) => ({ ...m, textFileId: null })), t); });
  },

  // ── Folders ───────────────────────────────────────────────────────────────

  /**
   * Returns all stored folders in insertion order.
   * @returns Array of Folder objects; empty array if none saved.
   */
  async getFolders(): Promise<Folder[]> {
    const result = await chrome.storage.local.get(FOLDERS_KEY);
    return (result[FOLDERS_KEY] as Folder[]) ?? [];
  },

  /**
   * Creates a new folder and syncs the folder list to Drive; throws if a sibling with the same name exists.
   * @param name Display name for the folder (trimmed before saving).
   * @param parentId UUID of the parent folder, or `undefined` for a root folder.
   * @returns The newly created Folder with generated id and timestamp.
   * @sideEffect Drive sync
   */
  async createFolder(name: string, parentId?: string): Promise<Folder> {
    const trimmed = name.trim();
    const existing = await this.getFolders();
    const siblings = existing.filter((f) => f.parentId === parentId);
    if (siblings.some((f) => f.name.toLowerCase() === trimmed.toLowerCase())) {
      throw new Error(`A folder named "${trimmed}" already exists here.`);
    }
    const folder: Folder = {
      id: crypto.randomUUID(),
      name: trimmed,
      createdAt: Date.now(),
      parentId,
      sortOrder: siblings.length,
    };
    const updated = [...existing, folder];
    await chrome.storage.local.set({ [FOLDERS_KEY]: updated });
    void getDriveToken().then((t) => { if (t) driveSyncService.saveFolders(updated, t); });
    return folder;
  },

  /**
   * Renames a folder and syncs the updated list to Drive; throws if a sibling already has the new name.
   * @param id UUID of the folder to rename.
   * @param name New display name (trimmed before saving).
   * @sideEffect Drive sync
   */
  async renameFolder(id: string, name: string): Promise<void> {
    const trimmed = name.trim();
    const existing = await this.getFolders();
    const target = existing.find((f) => f.id === id);
    if (existing.some((f) => f.id !== id && f.parentId === target?.parentId && f.name.toLowerCase() === trimmed.toLowerCase())) {
      throw new Error(`A folder named "${trimmed}" already exists here.`);
    }
    const updated = existing.map((f) => (f.id === id ? { ...f, name: trimmed } : f));
    await chrome.storage.local.set({ [FOLDERS_KEY]: updated });
    void getDriveToken().then((t) => { if (t) driveSyncService.saveFolders(updated, t); });
  },

  /**
   * Deletes a folder and cascade-deletes all descendant folders and their snippets, then syncs both lists to Drive.
   * @param id UUID of the root folder to delete.
   * @sideEffect Drive sync
   */
  async deleteFolder(id: string): Promise<void> {
    const [folders, snippets] = await Promise.all([this.getFolders(), this.getAll()]);
    const subtreeIds = getFolderSubtreeIds(id, folders);
    // Cascade-delete all snippets in the subtree
    const updatedSnippets = snippets.filter((s) => !s.folderId || !subtreeIds.has(s.folderId));
    // Delete all folders in the subtree
    const updatedFolders = folders.filter((f) => !subtreeIds.has(f.id));
    await chrome.storage.local.set({
      [FOLDERS_KEY]: updatedFolders,
      [SNIPPETS_KEY]: updatedSnippets,
    });
    void getDriveToken().then((t) => {
      if (!t) return;
      driveSyncService.saveFolders(updatedFolders, t);
      driveSyncService.saveSnippetsMeta(updatedSnippets.map(({ text: _t, ...m }) => ({ ...m, textFileId: null })), t);
    });
  },

  /**
   * Re-parents a folder to a new parent and syncs to Drive; throws if the target parent is within the folder's own subtree.
   * @param id UUID of the folder to move.
   * @param newParentId UUID of the destination parent folder, or `undefined` to promote to root.
   * @sideEffect Drive sync
   */
  async moveFolder(id: string, newParentId: string | undefined): Promise<void> {
    const existing = await this.getFolders();
    if (newParentId) {
      const subtreeIds = getFolderSubtreeIds(id, existing);
      if (subtreeIds.has(newParentId)) {
        throw new Error('Cannot move a folder into one of its own subfolders.');
      }
    }
    const updated = existing.map((f) => (f.id === id ? { ...f, parentId: newParentId } : f));
    await chrome.storage.local.set({ [FOLDERS_KEY]: updated });
    void getDriveToken().then((t) => { if (t) driveSyncService.saveFolders(updated, t); });
  },

  /**
   * Sets or clears the accent color on a folder and syncs the folder list to Drive.
   * @param id UUID of the folder to update.
   * @param color CSS color string, or `undefined` to remove the custom color.
   * @sideEffect Drive sync
   */
  async updateFolderColor(id: string, color: string | undefined): Promise<void> {
    const existing = await this.getFolders();
    const updated = existing.map((f) => (f.id === id ? { ...f, color } : f));
    await chrome.storage.local.set({ [FOLDERS_KEY]: updated });
    void getDriveToken().then((t) => { if (t) driveSyncService.saveFolders(updated, t); });
  },

  /**
   * Updates the sort-order index of a single folder and syncs to Drive.
   * @param id UUID of the folder to reorder.
   * @param sortOrder New numeric sort position within its sibling group.
   * @sideEffect Drive sync
   */
  async updateFolderOrder(id: string, sortOrder: number): Promise<void> {
    const existing = await this.getFolders();
    const updated = existing.map((f) => (f.id === id ? { ...f, sortOrder } : f));
    await chrome.storage.local.set({ [FOLDERS_KEY]: updated });
    void getDriveToken().then((t) => { if (t) driveSyncService.saveFolders(updated, t); });
  },

  /**
   * Applies sort-order updates to multiple folders in a single write and syncs to Drive.
   * @param updates Array of `{ id, sortOrder }` pairs; folders not in the array are left unchanged.
   * @sideEffect Drive sync
   */
  async bulkUpdateFolderSortOrders(
    updates: Array<{ id: string; sortOrder: number }>,
  ): Promise<void> {
    const orderMap = new Map(updates.map((u) => [u.id, u.sortOrder]));
    const existing = await this.getFolders();
    const updated = existing.map((f) =>
      orderMap.has(f.id) ? { ...f, sortOrder: orderMap.get(f.id)! } : f,
    );
    await chrome.storage.local.set({ [FOLDERS_KEY]: updated });
    void getDriveToken().then((t) => { if (t) driveSyncService.saveFolders(updated, t); });
  },

  // ── Tags Metadata ─────────────────────────────────────────────────────────

  /**
   * Returns all stored tag metadata records.
   * @returns Array of TagMeta objects; empty array if none saved.
   */
  async getTagsMeta(): Promise<TagMeta[]> {
    const result = await chrome.storage.local.get(TAGS_META_KEY);
    return (result[TAGS_META_KEY] as TagMeta[]) ?? [];
  },

  /**
   * Upserts a tag metadata record (inserts if new, replaces if the tag name already exists) and syncs to Drive.
   * @param meta The TagMeta object to save; matched by `meta.name`.
   * @sideEffect Drive sync
   */
  async saveTagMeta(meta: TagMeta): Promise<void> {
    const existing = await this.getTagsMeta();
    const updated = existing.some((t) => t.name === meta.name)
      ? existing.map((t) => (t.name === meta.name ? meta : t))
      : [...existing, meta];
    await chrome.storage.local.set({ [TAGS_META_KEY]: updated });
    void getDriveToken().then((t) => { if (t) driveSyncService.saveTags(updated, t); });
  },

  /**
   * Removes a tag metadata record by name and syncs the updated list to Drive.
   * @param name Exact tag name to delete.
   * @sideEffect Drive sync
   */
  async deleteTagMeta(name: string): Promise<void> {
    const existing = await this.getTagsMeta();
    const updated = existing.filter((t) => t.name !== name);
    await chrome.storage.local.set({ [TAGS_META_KEY]: updated });
    void getDriveToken().then((t) => { if (t) driveSyncService.saveTags(updated, t); });
  },

  /**
   * Renames a tag across all snippets and tag metadata in a single atomic write, then syncs both to Drive.
   * @param oldName Current tag name to replace.
   * @param newName Replacement tag name (trimmed before saving).
   * @sideEffect Drive sync
   */
  async renameTag(oldName: string, newName: string): Promise<void> {
    const trimmedNew = newName.trim();
    const [snippets, tagsMeta] = await Promise.all([this.getAll(), this.getTagsMeta()]);
    const updatedSnippets = snippets.map((s) => ({
      ...s,
      tags: s.tags?.map((t) => (t === oldName ? trimmedNew : t)),
    }));
    const updatedMeta = tagsMeta.map((t) =>
      t.name === oldName ? { ...t, name: trimmedNew } : t,
    );
    await chrome.storage.local.set({
      [SNIPPETS_KEY]: updatedSnippets,
      [TAGS_META_KEY]: updatedMeta,
    });
    void getDriveToken().then((token) => {
      if (!token) return;
      driveSyncService.saveTags(updatedMeta, token);
      driveSyncService.saveSnippetsMeta(updatedSnippets.map(({ text: _t, ...m }) => ({ ...m, textFileId: null })), token);
    });
  },

  // ── Settings ──────────────────────────────────────────────────────────────

  /**
   * Returns the current dashboard settings, merging stored values with defaults for any missing keys.
   * @returns A complete DashboardSettings object; never returns undefined.
   */
  async getSettings(): Promise<DashboardSettings> {
    const result = await chrome.storage.local.get(SETTINGS_KEY);
    return { ...DEFAULT_SETTINGS, ...(result[SETTINGS_KEY] as Partial<DashboardSettings>) };
  },

  /**
   * Merges partial settings over the current stored values and syncs the result to Drive.
   * @param settings Partial DashboardSettings; only the provided keys are updated.
   * @sideEffect Drive sync
   */
  async saveSettings(settings: Partial<DashboardSettings>): Promise<void> {
    const current = await this.getSettings();
    const merged = { ...current, ...settings };
    await chrome.storage.local.set({ [SETTINGS_KEY]: merged });
    void getDriveToken().then((t) => { if (t) driveSyncService.saveSettings(merged, t); });
  },

  // ── Export History ─────────────────────────────────────────────────────────

  /**
   * Returns all stored export records, newest first.
   * @returns Array of ExportRecord objects; empty array if none saved.
   */
  async getExportHistory(): Promise<ExportRecord[]> {
    const result = await chrome.storage.local.get(EXPORT_HISTORY_KEY);
    return (result[EXPORT_HISTORY_KEY] as ExportRecord[]) ?? [];
  },

  /**
   * Prepends a new export record (auto-assigning an id) and caps the list at 200 entries, then appends it to Drive.
   * @param record ExportRecord fields excluding `id` (generated internally).
   * @sideEffect Drive sync
   */
  async addExportRecord(record: Omit<ExportRecord, 'id'>): Promise<void> {
    const existing = await this.getExportHistory();
    const newRecord: ExportRecord = { id: crypto.randomUUID(), ...record };
    // Keep at most 200 records (most recent first)
    await chrome.storage.local.set({
      [EXPORT_HISTORY_KEY]: [newRecord, ...existing].slice(0, 200),
    });
    void getDriveToken().then((t) => { if (t) void driveSyncService.appendExportRecord(newRecord, t); });
  },

  /**
   * Empties the export history list in local storage. No Drive sync is triggered.
   */
  async clearExportHistory(): Promise<void> {
    await chrome.storage.local.set({ [EXPORT_HISTORY_KEY]: [] });
  },

  // ── Data Import / Export ──────────────────────────────────────────────────

  /**
   * Reads all persisted data stores and returns a versioned snapshot suitable for JSON export.
   * @returns Plain object with `version`, `exportedAt` ISO timestamp, and all data arrays.
   */
  async exportAllData(): Promise<object> {
    const [snippets, folders, tagsMeta, settings, exportHistory] = await Promise.all([
      this.getAll(),
      this.getFolders(),
      this.getTagsMeta(),
      this.getSettings(),
      this.getExportHistory(),
    ]);
    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      snippets,
      folders,
      tagsMeta,
      settings,
      exportHistory,
    };
  },

  // ── Podcast Episodes ────────────────────────────────────────────────────────

  /**
   * Returns all stored podcast episodes.
   * @returns Array of PodcastEpisode objects; empty array if none saved.
   */
  async getPodcastEpisodes(): Promise<PodcastEpisode[]> {
    const result = await chrome.storage.local.get(PODCAST_EPISODES_KEY);
    return (result[PODCAST_EPISODES_KEY] as PodcastEpisode[]) ?? [];
  },

  /**
   * Upserts a podcast episode (replaces by id if it exists, appends if new) and syncs the full list to Drive.
   * @param episode The PodcastEpisode to save or update; matched by `episode.id`.
   * @sideEffect Drive sync
   */
  async savePodcastEpisode(episode: PodcastEpisode): Promise<void> {
    const episodes = await this.getPodcastEpisodes();
    const idx = episodes.findIndex((e) => e.id === episode.id);
    if (idx >= 0) {
      episodes[idx] = episode;
    } else {
      episodes.push(episode);
    }
    await chrome.storage.local.set({ [PODCAST_EPISODES_KEY]: episodes });
    void getDriveToken().then((t) => { if (t) driveSyncService.savePodcastEpisodes(episodes, t); });
  },

  /**
   * Removes a podcast episode by id and syncs the remaining list to Drive.
   * @param id UUID of the episode to delete.
   * @sideEffect Drive sync
   */
  async deletePodcastEpisode(id: string): Promise<void> {
    const episodes = await this.getPodcastEpisodes();
    const filtered = episodes.filter((e) => e.id !== id);
    await chrome.storage.local.set({ [PODCAST_EPISODES_KEY]: filtered });
    void getDriveToken().then((t) => { if (t) driveSyncService.savePodcastEpisodes(filtered, t); });
  },

  /**
   * Replaces the track list on an episode and bumps its `updatedAt` timestamp, then syncs to Drive. No-ops if the episode id is not found.
   * @param id UUID of the episode to update.
   * @param tracks New complete array of EpisodeTracks (replaces existing tracks).
   * @sideEffect Drive sync
   */
  async updateEpisodeTracks(id: string, tracks: EpisodeTrack[]): Promise<void> {
    const episodes = await this.getPodcastEpisodes();
    const idx = episodes.findIndex((e) => e.id === id);
    if (idx < 0) return;
    episodes[idx] = { ...episodes[idx], tracks, updatedAt: Date.now() };
    await chrome.storage.local.set({ [PODCAST_EPISODES_KEY]: episodes });
    void getDriveToken().then((t) => { if (t) driveSyncService.savePodcastEpisodes(episodes, t); });
  },

  /**
   * Writes a validated backup payload into local storage, skipping any keys that are absent or the wrong type. Does not trigger Drive sync.
   * @param data Parsed JSON object from an `exportAllData` snapshot; unknown or malformed keys are ignored.
   */
  async importAllData(data: Record<string, unknown>): Promise<void> {
    const updates: Record<string, unknown> = {};
    if (Array.isArray(data.snippets)) updates[SNIPPETS_KEY] = data.snippets;
    if (Array.isArray(data.folders)) updates[FOLDERS_KEY] = data.folders;
    if (Array.isArray(data.tagsMeta)) updates[TAGS_META_KEY] = data.tagsMeta;
    if (data.settings && typeof data.settings === 'object') {
      updates[SETTINGS_KEY] = { ...DEFAULT_SETTINGS, ...(data.settings as Partial<DashboardSettings>) };
    }
    if (Array.isArray(data.exportHistory)) updates[EXPORT_HISTORY_KEY] = data.exportHistory;
    await chrome.storage.local.set(updates);
  },
};
