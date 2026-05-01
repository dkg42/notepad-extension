/**
 * @module snippet-storage
 * @description Domain storage module for snippet CRUD operations, bulk mutations, tag and folder assignment, and favorites. All writes fire a best-effort Drive sync tail-call.
 * @dependencies storage/shared, @/types, drive/drive-sync-service
 * @public snippetStorage
 */
import type { Snippet } from '@/types';
import { SNIPPETS_KEY, syncToDrive, driveSyncService } from './shared';

export const snippetStorage = {
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
    const existing = await snippetStorage.getAll();
    await chrome.storage.local.set({ [SNIPPETS_KEY]: [snippet, ...existing] });
    syncToDrive((t) => driveSyncService.saveSnippet(snippet, t));
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
    const existing = await snippetStorage.getAll();
    await chrome.storage.local.set({ [SNIPPETS_KEY]: [snippet, ...existing] });
    syncToDrive((t) => driveSyncService.saveSnippet(snippet, t));
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
    const existing = await snippetStorage.getAll();
    await chrome.storage.local.set({ [SNIPPETS_KEY]: [...newSnippets, ...existing] });
    syncToDrive((t) => driveSyncService.saveAllSnippets([...newSnippets, ...existing], t));
    return newSnippets;
  },

  /**
   * Removes a single snippet by id and syncs the deletion to Drive.
   * @param id UUID of the snippet to delete.
   * @sideEffect Drive sync
   */
  async remove(id: string): Promise<void> {
    const existing = await snippetStorage.getAll();
    await chrome.storage.local.set({
      [SNIPPETS_KEY]: existing.filter((s) => s.id !== id),
    });
    syncToDrive((t) => driveSyncService.deleteSnippet(id, t));
  },

  /**
   * Deletes all snippets and syncs the empty list to Drive.
   * @sideEffect Drive sync
   */
  async clear(): Promise<void> {
    await chrome.storage.local.set({ [SNIPPETS_KEY]: [] });
    syncToDrive((t) => driveSyncService.saveSnippetsMeta([], t));
  },

  /**
   * Assigns a snippet to a folder (or removes it from any folder) and syncs metadata to Drive.
   * @param snippetId UUID of the snippet to move.
   * @param folderId Target folder UUID, or `undefined` to place in the root.
   * @sideEffect Drive sync
   */
  async moveToFolder(snippetId: string, folderId: string | undefined): Promise<void> {
    const existing = await snippetStorage.getAll();
    const updated = existing.map((s) => s.id === snippetId ? { ...s, folderId } : s);
    await chrome.storage.local.set({ [SNIPPETS_KEY]: updated });
    syncToDrive((t) => driveSyncService.saveSnippetsMeta(updated.map(({ text: _t, ...m }) => ({ ...m, textFileId: null })), t));
  },

  /**
   * Replaces the tag list on a single snippet and syncs metadata to Drive.
   * @param snippetId UUID of the snippet to update.
   * @param tags New complete list of tag names (replaces existing tags).
   * @sideEffect Drive sync
   */
  async updateTags(snippetId: string, tags: string[]): Promise<void> {
    const existing = await snippetStorage.getAll();
    const updated = existing.map((s) => s.id === snippetId ? { ...s, tags } : s);
    await chrome.storage.local.set({ [SNIPPETS_KEY]: updated });
    syncToDrive((t) => driveSyncService.saveSnippetsMeta(updated.map(({ text: _t, ...m }) => ({ ...m, textFileId: null })), t));
  },

  /**
   * Flips the `isFavorite` flag on a snippet and syncs metadata to Drive.
   * @param id UUID of the snippet whose favorite state should be toggled.
   * @sideEffect Drive sync
   */
  async toggleFavorite(id: string): Promise<void> {
    const existing = await snippetStorage.getAll();
    const updated = existing.map((s) => s.id === id ? { ...s, isFavorite: !s.isFavorite } : s);
    await chrome.storage.local.set({ [SNIPPETS_KEY]: updated });
    syncToDrive((t) => driveSyncService.saveSnippetsMeta(updated.map(({ text: _t, ...m }) => ({ ...m, textFileId: null })), t));
  },

  // ── Bulk Operations ────────────────────────────────────────────────────────

  /**
   * Removes multiple snippets by id in a single write and syncs metadata to Drive.
   * @param ids Array of snippet UUIDs to delete.
   * @sideEffect Drive sync
   */
  async bulkDelete(ids: string[]): Promise<void> {
    const idSet = new Set(ids);
    const existing = await snippetStorage.getAll();
    const updated = existing.filter((s) => !idSet.has(s.id));
    await chrome.storage.local.set({ [SNIPPETS_KEY]: updated });
    syncToDrive((t) => driveSyncService.saveSnippetsMeta(updated.map(({ text: _t, ...m }) => ({ ...m, textFileId: null })), t));
  },

  /**
   * Moves multiple snippets to the given folder (or root) in a single write and syncs metadata to Drive.
   * @param ids Array of snippet UUIDs to move.
   * @param folderId Target folder UUID, or `undefined` to place in the root.
   * @sideEffect Drive sync
   */
  async bulkMoveToFolder(ids: string[], folderId: string | undefined): Promise<void> {
    const idSet = new Set(ids);
    const existing = await snippetStorage.getAll();
    const updated = existing.map((s) => idSet.has(s.id) ? { ...s, folderId } : s);
    await chrome.storage.local.set({ [SNIPPETS_KEY]: updated });
    syncToDrive((t) => driveSyncService.saveSnippetsMeta(updated.map(({ text: _t, ...m }) => ({ ...m, textFileId: null })), t));
  },

  /**
   * Merges the given tags into each targeted snippet (deduplicates) and syncs metadata to Drive.
   * @param ids Array of snippet UUIDs to update.
   * @param tags Tag names to add; duplicates within a snippet are ignored.
   * @sideEffect Drive sync
   */
  async bulkAddTags(ids: string[], tags: string[]): Promise<void> {
    const idSet = new Set(ids);
    const existing = await snippetStorage.getAll();
    const updated = existing.map((s) => {
      if (!idSet.has(s.id)) return s;
      const merged = Array.from(new Set([...(s.tags ?? []), ...tags]));
      return { ...s, tags: merged };
    });
    await chrome.storage.local.set({ [SNIPPETS_KEY]: updated });
    syncToDrive((t) => driveSyncService.saveSnippetsMeta(updated.map(({ text: _t, ...m }) => ({ ...m, textFileId: null })), t));
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
    const existing = await snippetStorage.getAll();
    const updated = existing.map((s) => {
      if (!idSet.has(s.id)) return s;
      return { ...s, tags: (s.tags ?? []).filter((t) => !removeSet.has(t)) };
    });
    await chrome.storage.local.set({ [SNIPPETS_KEY]: updated });
    syncToDrive((t) => driveSyncService.saveSnippetsMeta(updated.map(({ text: _t, ...m }) => ({ ...m, textFileId: null })), t));
  },
};
