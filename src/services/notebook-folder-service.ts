/**
 * @module notebook-folder-service
 * @description Persists user-defined notebook folders (nested tree structure) in chrome.storage.local. On folder deletion, cascade-unassigns notebooks in the subtree rather than deleting them. Includes Drive sync tail-calls.
 * @dependencies @/types, @/utils/folder-utils, token-lifecycle-service, drive/drive-sync-service
 * @public notebookFolderService
 */
import type { Folder, NotebookAnnotation } from '@/types';
import { getFolderSubtreeIds } from '@/utils/folder-utils';
import { notebookSyncService } from './notebook-sync-service';
import { driveSyncService } from './drive/drive-sync-service';
import { getValidToken } from './token-lifecycle-service';
import { scopedStorage } from './storage/scoped-storage';

const NOTEBOOK_FOLDERS_KEY = 'notebookFolders';
const ANNOTATIONS_KEY = 'notebookAnnotations';

async function getDriveToken(): Promise<string | null> {
  const result = await getValidToken();
  if (!result.ok || !result.hasDriveScope) return null;
  return result.accessToken;
}

function syncToDrive(callback: (token: string) => void | Promise<void>): void {
  void getDriveToken().then((t) => { if (t) void callback(t); });
}

export const notebookFolderService = {
  async getFolders(): Promise<Folder[]> {
    const result = await scopedStorage.get<Folder[]>(NOTEBOOK_FOLDERS_KEY);
    return result[NOTEBOOK_FOLDERS_KEY] ?? [];
  },

  async createFolder(name: string, parentId?: string): Promise<Folder> {
    const trimmed = name.trim();
    const existing = await notebookFolderService.getFolders();
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
    await scopedStorage.set({ [NOTEBOOK_FOLDERS_KEY]: updated });
    syncToDrive(async (t) => {
      const annotationsResult = await scopedStorage.get<NotebookAnnotation[]>(ANNOTATIONS_KEY);
      const annotations = annotationsResult[ANNOTATIONS_KEY] ?? [];
      const notebooks = await notebookSyncService.getRefs();
      driveSyncService.saveAnnotations(annotations, updated, notebooks, t);
    });
    return folder;
  },

  async renameFolder(id: string, name: string): Promise<void> {
    const trimmed = name.trim();
    const existing = await notebookFolderService.getFolders();
    const target = existing.find((f) => f.id === id);
    if (existing.some((f) => f.id !== id && f.parentId === target?.parentId && f.name.toLowerCase() === trimmed.toLowerCase())) {
      throw new Error(`A folder named "${trimmed}" already exists here.`);
    }
    const updated = existing.map((f) => (f.id === id ? { ...f, name: trimmed } : f));
    await scopedStorage.set({ [NOTEBOOK_FOLDERS_KEY]: updated });
    syncToDrive(async (t) => {
      const annotationsResult = await scopedStorage.get<NotebookAnnotation[]>(ANNOTATIONS_KEY);
      const annotations = annotationsResult[ANNOTATIONS_KEY] ?? [];
      const notebooks = await notebookSyncService.getRefs();
      driveSyncService.saveAnnotations(annotations, updated, notebooks, t);
    });
  },

  /**
   * Deletes a folder and all its descendants. Notebooks in the subtree have their folderId cleared (unassigned) rather than being deleted.
   */
  async deleteFolder(id: string): Promise<void> {
    const [folders, annotationsResult] = await Promise.all([
      notebookFolderService.getFolders(),
      scopedStorage.get<NotebookAnnotation[]>(ANNOTATIONS_KEY),
    ]);
    const annotations = annotationsResult[ANNOTATIONS_KEY] ?? [];
    const subtreeIds = getFolderSubtreeIds(id, folders);

    const updatedFolders = folders.filter((f) => !subtreeIds.has(f.id));
    const updatedAnnotations = annotations.map((a) =>
      a.folderId && subtreeIds.has(a.folderId) ? { ...a, folderId: undefined } : a,
    );

    await scopedStorage.set({
      [NOTEBOOK_FOLDERS_KEY]: updatedFolders,
      [ANNOTATIONS_KEY]: updatedAnnotations,
    });
    syncToDrive(async (t) => {
      const notebooks = await notebookSyncService.getRefs();
      driveSyncService.saveAnnotations(updatedAnnotations, updatedFolders, notebooks, t);
    });
  },

  async moveFolder(id: string, newParentId: string | undefined): Promise<void> {
    const existing = await notebookFolderService.getFolders();
    if (newParentId) {
      const subtreeIds = getFolderSubtreeIds(id, existing);
      if (subtreeIds.has(newParentId)) {
        throw new Error('Cannot move a folder into one of its own subfolders.');
      }
    }
    const updated = existing.map((f) => (f.id === id ? { ...f, parentId: newParentId } : f));
    await scopedStorage.set({ [NOTEBOOK_FOLDERS_KEY]: updated });
    syncToDrive(async (t) => {
      const annotationsResult = await scopedStorage.get<NotebookAnnotation[]>(ANNOTATIONS_KEY);
      const annotations = annotationsResult[ANNOTATIONS_KEY] ?? [];
      const notebooks = await notebookSyncService.getRefs();
      driveSyncService.saveAnnotations(annotations, updated, notebooks, t);
    });
  },

  async bulkUpdateFolderSortOrders(updates: Array<{ id: string; sortOrder: number }>): Promise<void> {
    const orderMap = new Map(updates.map((u) => [u.id, u.sortOrder]));
    const existing = await notebookFolderService.getFolders();
    const updated = existing.map((f) =>
      orderMap.has(f.id) ? { ...f, sortOrder: orderMap.get(f.id)! } : f,
    );
    await scopedStorage.set({ [NOTEBOOK_FOLDERS_KEY]: updated });
    syncToDrive(async (t) => {
      const annotationsResult = await scopedStorage.get<NotebookAnnotation[]>(ANNOTATIONS_KEY);
      const annotations = annotationsResult[ANNOTATIONS_KEY] ?? [];
      const notebooks = await notebookSyncService.getRefs();
      driveSyncService.saveAnnotations(annotations, updated, notebooks, t);
    });
  },
};
