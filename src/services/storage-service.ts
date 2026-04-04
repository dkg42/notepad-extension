import type { Folder, PodcastEpisode, EpisodeTrack, Snippet, TagMeta } from '@/types';
import type { DashboardSettings, ExportRecord } from '@/types/dashboard';

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
 * Single-responsibility service for persisting all extension data via chrome.storage.local.
 * All reads and writes go through this module so storage concerns stay isolated.
 */
export const storageService = {
  // ── Snippets ──────────────────────────────────────────────────────────────

  async getAll(): Promise<Snippet[]> {
    const result = await chrome.storage.local.get(SNIPPETS_KEY);
    return (result[SNIPPETS_KEY] as Snippet[]) ?? [];
  },

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
    return snippet;
  },

  /**
   * Saves multiple texts in a single read-write cycle to avoid race conditions.
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
    return newSnippets;
  },

  async remove(id: string): Promise<void> {
    const existing = await this.getAll();
    await chrome.storage.local.set({
      [SNIPPETS_KEY]: existing.filter((s) => s.id !== id),
    });
  },

  async moveToFolder(snippetId: string, folderId: string | undefined): Promise<void> {
    const existing = await this.getAll();
    await chrome.storage.local.set({
      [SNIPPETS_KEY]: existing.map((s) =>
        s.id === snippetId ? { ...s, folderId } : s,
      ),
    });
  },

  async updateTags(snippetId: string, tags: string[]): Promise<void> {
    const existing = await this.getAll();
    await chrome.storage.local.set({
      [SNIPPETS_KEY]: existing.map((s) =>
        s.id === snippetId ? { ...s, tags } : s,
      ),
    });
  },

  async toggleFavorite(id: string): Promise<void> {
    const existing = await this.getAll();
    await chrome.storage.local.set({
      [SNIPPETS_KEY]: existing.map((s) =>
        s.id === id ? { ...s, isFavorite: !s.isFavorite } : s,
      ),
    });
  },

  async clear(): Promise<void> {
    await chrome.storage.local.set({ [SNIPPETS_KEY]: [] });
  },

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

  async bulkDelete(ids: string[]): Promise<void> {
    const idSet = new Set(ids);
    const existing = await this.getAll();
    await chrome.storage.local.set({
      [SNIPPETS_KEY]: existing.filter((s) => !idSet.has(s.id)),
    });
  },

  async bulkMoveToFolder(ids: string[], folderId: string | undefined): Promise<void> {
    const idSet = new Set(ids);
    const existing = await this.getAll();
    await chrome.storage.local.set({
      [SNIPPETS_KEY]: existing.map((s) =>
        idSet.has(s.id) ? { ...s, folderId } : s,
      ),
    });
  },

  async bulkAddTags(ids: string[], tags: string[]): Promise<void> {
    const idSet = new Set(ids);
    const existing = await this.getAll();
    await chrome.storage.local.set({
      [SNIPPETS_KEY]: existing.map((s) => {
        if (!idSet.has(s.id)) return s;
        const merged = Array.from(new Set([...(s.tags ?? []), ...tags]));
        return { ...s, tags: merged };
      }),
    });
  },

  async bulkRemoveTags(ids: string[], tags: string[]): Promise<void> {
    const idSet = new Set(ids);
    const removeSet = new Set(tags);
    const existing = await this.getAll();
    await chrome.storage.local.set({
      [SNIPPETS_KEY]: existing.map((s) => {
        if (!idSet.has(s.id)) return s;
        return { ...s, tags: (s.tags ?? []).filter((t) => !removeSet.has(t)) };
      }),
    });
  },

  // ── Folders ───────────────────────────────────────────────────────────────

  async getFolders(): Promise<Folder[]> {
    const result = await chrome.storage.local.get(FOLDERS_KEY);
    return (result[FOLDERS_KEY] as Folder[]) ?? [];
  },

  async createFolder(name: string): Promise<Folder> {
    const trimmed = name.trim();
    const existing = await this.getFolders();
    if (existing.some((f) => f.name.toLowerCase() === trimmed.toLowerCase())) {
      throw new Error(`A folder named "${trimmed}" already exists.`);
    }
    const folder: Folder = {
      id: crypto.randomUUID(),
      name: trimmed,
      createdAt: Date.now(),
      sortOrder: existing.length,
    };
    await chrome.storage.local.set({ [FOLDERS_KEY]: [...existing, folder] });
    return folder;
  },

  async renameFolder(id: string, name: string): Promise<void> {
    const trimmed = name.trim();
    const existing = await this.getFolders();
    if (existing.some((f) => f.id !== id && f.name.toLowerCase() === trimmed.toLowerCase())) {
      throw new Error(`A folder named "${trimmed}" already exists.`);
    }
    await chrome.storage.local.set({
      [FOLDERS_KEY]: existing.map((f) => (f.id === id ? { ...f, name: trimmed } : f)),
    });
  },

  async deleteFolder(id: string): Promise<void> {
    const [folders, snippets] = await Promise.all([this.getFolders(), this.getAll()]);
    const updatedSnippets = snippets.map((s) =>
      s.folderId === id ? { ...s, folderId: undefined } : s,
    );
    await chrome.storage.local.set({
      [FOLDERS_KEY]: folders.filter((f) => f.id !== id),
      [SNIPPETS_KEY]: updatedSnippets,
    });
  },

  async updateFolderColor(id: string, color: string | undefined): Promise<void> {
    const existing = await this.getFolders();
    await chrome.storage.local.set({
      [FOLDERS_KEY]: existing.map((f) => (f.id === id ? { ...f, color } : f)),
    });
  },

  async updateFolderOrder(id: string, sortOrder: number): Promise<void> {
    const existing = await this.getFolders();
    await chrome.storage.local.set({
      [FOLDERS_KEY]: existing.map((f) => (f.id === id ? { ...f, sortOrder } : f)),
    });
  },

  async bulkUpdateFolderSortOrders(
    updates: Array<{ id: string; sortOrder: number }>,
  ): Promise<void> {
    const orderMap = new Map(updates.map((u) => [u.id, u.sortOrder]));
    const existing = await this.getFolders();
    await chrome.storage.local.set({
      [FOLDERS_KEY]: existing.map((f) =>
        orderMap.has(f.id) ? { ...f, sortOrder: orderMap.get(f.id)! } : f,
      ),
    });
  },

  // ── Tags Metadata ─────────────────────────────────────────────────────────

  async getTagsMeta(): Promise<TagMeta[]> {
    const result = await chrome.storage.local.get(TAGS_META_KEY);
    return (result[TAGS_META_KEY] as TagMeta[]) ?? [];
  },

  async saveTagMeta(meta: TagMeta): Promise<void> {
    const existing = await this.getTagsMeta();
    const updated = existing.some((t) => t.name === meta.name)
      ? existing.map((t) => (t.name === meta.name ? meta : t))
      : [...existing, meta];
    await chrome.storage.local.set({ [TAGS_META_KEY]: updated });
  },

  async deleteTagMeta(name: string): Promise<void> {
    const existing = await this.getTagsMeta();
    await chrome.storage.local.set({
      [TAGS_META_KEY]: existing.filter((t) => t.name !== name),
    });
  },

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
  },

  // ── Settings ──────────────────────────────────────────────────────────────

  async getSettings(): Promise<DashboardSettings> {
    const result = await chrome.storage.local.get(SETTINGS_KEY);
    return { ...DEFAULT_SETTINGS, ...(result[SETTINGS_KEY] as Partial<DashboardSettings>) };
  },

  async saveSettings(settings: Partial<DashboardSettings>): Promise<void> {
    const current = await this.getSettings();
    await chrome.storage.local.set({ [SETTINGS_KEY]: { ...current, ...settings } });
  },

  // ── Export History ─────────────────────────────────────────────────────────

  async getExportHistory(): Promise<ExportRecord[]> {
    const result = await chrome.storage.local.get(EXPORT_HISTORY_KEY);
    return (result[EXPORT_HISTORY_KEY] as ExportRecord[]) ?? [];
  },

  async addExportRecord(record: Omit<ExportRecord, 'id'>): Promise<void> {
    const existing = await this.getExportHistory();
    const newRecord: ExportRecord = { id: crypto.randomUUID(), ...record };
    // Keep at most 200 records (most recent first)
    await chrome.storage.local.set({
      [EXPORT_HISTORY_KEY]: [newRecord, ...existing].slice(0, 200),
    });
  },

  async clearExportHistory(): Promise<void> {
    await chrome.storage.local.set({ [EXPORT_HISTORY_KEY]: [] });
  },

  // ── Data Import / Export ──────────────────────────────────────────────────

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

  async getPodcastEpisodes(): Promise<PodcastEpisode[]> {
    const result = await chrome.storage.local.get(PODCAST_EPISODES_KEY);
    return (result[PODCAST_EPISODES_KEY] as PodcastEpisode[]) ?? [];
  },

  async savePodcastEpisode(episode: PodcastEpisode): Promise<void> {
    const episodes = await this.getPodcastEpisodes();
    const idx = episodes.findIndex((e) => e.id === episode.id);
    if (idx >= 0) {
      episodes[idx] = episode;
    } else {
      episodes.push(episode);
    }
    await chrome.storage.local.set({ [PODCAST_EPISODES_KEY]: episodes });
  },

  async deletePodcastEpisode(id: string): Promise<void> {
    const episodes = await this.getPodcastEpisodes();
    const filtered = episodes.filter((e) => e.id !== id);
    await chrome.storage.local.set({ [PODCAST_EPISODES_KEY]: filtered });
  },

  async updateEpisodeTracks(id: string, tracks: EpisodeTrack[]): Promise<void> {
    const episodes = await this.getPodcastEpisodes();
    const idx = episodes.findIndex((e) => e.id === id);
    if (idx < 0) return;
    episodes[idx] = { ...episodes[idx], tracks, updatedAt: Date.now() };
    await chrome.storage.local.set({ [PODCAST_EPISODES_KEY]: episodes });
  },

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
