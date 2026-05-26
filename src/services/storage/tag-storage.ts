/**
 * @module tag-storage
 * @description Domain storage module for tag metadata CRUD operations and atomic cross-collection tag renaming. All writes fire a best-effort Drive sync tail-call.
 * @dependencies storage/shared, @/types, drive/drive-sync-service
 * @public tagStorage
 */
import type { TagMeta } from '@/types';
import { SNIPPETS_KEY, TAGS_META_KEY, syncToDrive, driveSyncService } from './shared';
import { snippetStorage } from './snippet-storage';
import { scopedStorage } from './scoped-storage';

export const tagStorage = {
  // ── Tags Metadata ─────────────────────────────────────────────────────────

  /**
   * Returns all stored tag metadata records.
   * @returns Array of TagMeta objects; empty array if none saved.
   */
  async getTagsMeta(): Promise<TagMeta[]> {
    const result = await scopedStorage.get<TagMeta[]>(TAGS_META_KEY);
    return result[TAGS_META_KEY] ?? [];
  },

  /**
   * Upserts a tag metadata record (inserts if new, replaces if the tag name already exists) and syncs to Drive.
   * @param meta The TagMeta object to save; matched by `meta.name`.
   * @sideEffect Drive sync
   */
  async saveTagMeta(meta: TagMeta): Promise<void> {
    const existing = await tagStorage.getTagsMeta();
    const updated = existing.some((t) => t.name === meta.name)
      ? existing.map((t) => (t.name === meta.name ? meta : t))
      : [...existing, meta];
    await scopedStorage.set({ [TAGS_META_KEY]: updated });
    syncToDrive((t) => driveSyncService.saveTags(updated, t));
  },

  /**
   * Removes a tag metadata record by name and syncs the updated list to Drive.
   * @param name Exact tag name to delete.
   * @sideEffect Drive sync
   */
  async deleteTagMeta(name: string): Promise<void> {
    const existing = await tagStorage.getTagsMeta();
    const updated = existing.filter((t) => t.name !== name);
    await scopedStorage.set({ [TAGS_META_KEY]: updated });
    syncToDrive((t) => driveSyncService.saveTags(updated, t));
  },

  /**
   * Renames a tag across all snippets and tag metadata in a single atomic write, then syncs both to Drive.
   * @param oldName Current tag name to replace.
   * @param newName Replacement tag name (trimmed before saving).
   * @sideEffect Drive sync
   */
  async renameTag(oldName: string, newName: string): Promise<void> {
    const trimmedNew = newName.trim();
    const [snippets, tagsMeta] = await Promise.all([snippetStorage.getAll(), tagStorage.getTagsMeta()]);
    const updatedSnippets = snippets.map((s) => ({
      ...s,
      tags: s.tags?.map((t) => (t === oldName ? trimmedNew : t)),
    }));
    const updatedMeta = tagsMeta.map((t) =>
      t.name === oldName ? { ...t, name: trimmedNew } : t,
    );
    await scopedStorage.set({
      [SNIPPETS_KEY]: updatedSnippets,
      [TAGS_META_KEY]: updatedMeta,
    });
    syncToDrive((token) => {
      driveSyncService.saveTags(updatedMeta, token);
      driveSyncService.saveSnippetsMeta(updatedSnippets, token);
    });
  },
};
