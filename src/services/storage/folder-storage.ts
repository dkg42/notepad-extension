/**
 * @module folder-storage
 * @description Domain storage module for folder CRUD operations, re-parenting, color customization, and sort-order management. Cascade-deletes descendant folders and their snippets on folder deletion.
 * @dependencies storage/shared, @/types, @/utils/folder-utils, drive/drive-sync-service
 * @public folderStorage
 */
import type { Folder } from '@/types';
import { getFolderSubtreeIds } from '@/utils/folder-utils';
import { FOLDERS_KEY, SNIPPETS_KEY, syncToDrive, driveSyncService } from './shared';
import { snippetStorage } from './snippet-storage';

export const folderStorage = {
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
    const existing = await folderStorage.getFolders();
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
    syncToDrive((t) => driveSyncService.saveFolders(updated, t));
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
    const existing = await folderStorage.getFolders();
    const target = existing.find((f) => f.id === id);
    if (existing.some((f) => f.id !== id && f.parentId === target?.parentId && f.name.toLowerCase() === trimmed.toLowerCase())) {
      throw new Error(`A folder named "${trimmed}" already exists here.`);
    }
    const updated = existing.map((f) => (f.id === id ? { ...f, name: trimmed } : f));
    await chrome.storage.local.set({ [FOLDERS_KEY]: updated });
    syncToDrive((t) => driveSyncService.saveFolders(updated, t));
  },

  /**
   * Deletes a folder and cascade-deletes all descendant folders and their snippets, then syncs both lists to Drive.
   * @param id UUID of the root folder to delete.
   * @sideEffect Drive sync
   */
  async deleteFolder(id: string): Promise<void> {
    const [folders, snippets] = await Promise.all([folderStorage.getFolders(), snippetStorage.getAll()]);
    const subtreeIds = getFolderSubtreeIds(id, folders);
    // Cascade-delete all snippets in the subtree
    const updatedSnippets = snippets.filter((s) => !s.folderId || !subtreeIds.has(s.folderId));
    // Delete all folders in the subtree
    const updatedFolders = folders.filter((f) => !subtreeIds.has(f.id));
    await chrome.storage.local.set({
      [FOLDERS_KEY]: updatedFolders,
      [SNIPPETS_KEY]: updatedSnippets,
    });
    syncToDrive((t) => {
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
    const existing = await folderStorage.getFolders();
    if (newParentId) {
      const subtreeIds = getFolderSubtreeIds(id, existing);
      if (subtreeIds.has(newParentId)) {
        throw new Error('Cannot move a folder into one of its own subfolders.');
      }
    }
    const updated = existing.map((f) => (f.id === id ? { ...f, parentId: newParentId } : f));
    await chrome.storage.local.set({ [FOLDERS_KEY]: updated });
    syncToDrive((t) => driveSyncService.saveFolders(updated, t));
  },

  /**
   * Sets or clears the accent color on a folder and syncs the folder list to Drive.
   * @param id UUID of the folder to update.
   * @param color CSS color string, or `undefined` to remove the custom color.
   * @sideEffect Drive sync
   */
  async updateFolderColor(id: string, color: string | undefined): Promise<void> {
    const existing = await folderStorage.getFolders();
    const updated = existing.map((f) => (f.id === id ? { ...f, color } : f));
    await chrome.storage.local.set({ [FOLDERS_KEY]: updated });
    syncToDrive((t) => driveSyncService.saveFolders(updated, t));
  },

  /**
   * Updates the sort-order index of a single folder and syncs to Drive.
   * @param id UUID of the folder to reorder.
   * @param sortOrder New numeric sort position within its sibling group.
   * @sideEffect Drive sync
   */
  async updateFolderOrder(id: string, sortOrder: number): Promise<void> {
    const existing = await folderStorage.getFolders();
    const updated = existing.map((f) => (f.id === id ? { ...f, sortOrder } : f));
    await chrome.storage.local.set({ [FOLDERS_KEY]: updated });
    syncToDrive((t) => driveSyncService.saveFolders(updated, t));
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
    const existing = await folderStorage.getFolders();
    const updated = existing.map((f) =>
      orderMap.has(f.id) ? { ...f, sortOrder: orderMap.get(f.id)! } : f,
    );
    await chrome.storage.local.set({ [FOLDERS_KEY]: updated });
    syncToDrive((t) => driveSyncService.saveFolders(updated, t));
  },
};
