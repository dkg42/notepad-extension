/**
 * @module notebook-annotation-service
 * @description Persists user-defined notebook annotations (tags, folder assignments, archived flag) in chrome.storage.local. Kept intentionally separate from notebookSyncService so that periodic background API syncs which overwrite NotebookMeta can never clobber user-authored metadata. Each mutation also fires a best-effort Drive sync tail-call if the user has granted Drive scope.
 * @dependencies token-lifecycle-service, drive/drive-sync-service
 * @public notebookAnnotationService
 */
import type { NotebookAnnotation } from '@/types';
import { notebookFolderService } from './notebook-folder-service';
import { notebookSyncService } from './notebook-sync-service';
import { driveSyncService } from './drive/drive-sync-service';
import { getValidToken } from './token-lifecycle-service';
import { scopedStorage } from './storage/scoped-storage';

const ANNOTATIONS_KEY = 'notebookAnnotations';

async function getDriveToken(): Promise<string | null> {
  const result = await getValidToken();
  if (!result.ok || !result.hasDriveScope) return null;
  return result.accessToken;
}

function syncToDrive(callback: (token: string) => void | Promise<void>): void {
  void getDriveToken().then((t) => { if (t) void callback(t); });
}

export const notebookAnnotationService = {
  async getAllAnnotations(): Promise<NotebookAnnotation[]> {
    const result = await scopedStorage.get<NotebookAnnotation[]>(ANNOTATIONS_KEY);
    return result[ANNOTATIONS_KEY] ?? [];
  },

  async setAnnotation(annotation: NotebookAnnotation): Promise<void> {
    const all = await this.getAllAnnotations();
    const idx = all.findIndex((a) => a.notebookId === annotation.notebookId);
    if (idx >= 0) {
      all[idx] = annotation;
    } else {
      all.push(annotation);
    }
    await scopedStorage.set({ [ANNOTATIONS_KEY]:all });
    syncToDrive(async (t) => {
      const [folders, notebooks] = await Promise.all([
        notebookFolderService.getFolders(),
        notebookSyncService.getRefs(),
      ]);
      driveSyncService.saveAnnotations(all, folders, notebooks, t);
    });
  },

  async removeAnnotation(notebookId: string): Promise<void> {
    const all = await this.getAllAnnotations();
    const filtered = all.filter((a) => a.notebookId !== notebookId);
    await scopedStorage.set({ [ANNOTATIONS_KEY]:filtered });
    syncToDrive(async (t) => {
      const [folders, notebooks] = await Promise.all([
        notebookFolderService.getFolders(),
        notebookSyncService.getRefs(),
      ]);
      driveSyncService.saveAnnotations(filtered, folders, notebooks, t);
    });
  },

  async clearAllData(): Promise<void> {
    await scopedStorage.remove([ANNOTATIONS_KEY]);
  },
};
