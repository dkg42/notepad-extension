/**
 * @module notebook-annotation-service
 * @description Persists user-defined notebook annotations (tags, folder assignments, archived flag) in chrome.storage.sync. Kept intentionally separate from notebookSyncService so that periodic background API syncs which overwrite NotebookMeta can never clobber user-authored metadata. Each mutation also fires a best-effort Drive sync tail-call if the user has granted Drive scope.
 * @dependencies token-lifecycle-service, drive/drive-sync-service
 * @public notebookAnnotationService
 */
import type { NotebookAnnotation } from '@/types';
import { notebookFolderService } from './notebook-folder-service';
import { driveSyncService } from './drive/drive-sync-service';
import { getValidToken } from './token-lifecycle-service';

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
    const result = await chrome.storage.sync.get(ANNOTATIONS_KEY);
    return (result[ANNOTATIONS_KEY] as NotebookAnnotation[]) ?? [];
  },

  async setAnnotation(annotation: NotebookAnnotation): Promise<void> {
    const all = await this.getAllAnnotations();
    const idx = all.findIndex((a) => a.notebookId === annotation.notebookId);
    if (idx >= 0) {
      all[idx] = annotation;
    } else {
      all.push(annotation);
    }
    await chrome.storage.sync.set({ [ANNOTATIONS_KEY]: all });
    syncToDrive(async (t) => {
      const folders = await notebookFolderService.getFolders();
      driveSyncService.saveAnnotations(all, folders, t);
    });
  },

  async removeAnnotation(notebookId: string): Promise<void> {
    const all = await this.getAllAnnotations();
    const filtered = all.filter((a) => a.notebookId !== notebookId);
    await chrome.storage.sync.set({ [ANNOTATIONS_KEY]: filtered });
    syncToDrive(async (t) => {
      const folders = await notebookFolderService.getFolders();
      driveSyncService.saveAnnotations(filtered, folders, t);
    });
  },

  async clearAllData(): Promise<void> {
    await chrome.storage.sync.remove([ANNOTATIONS_KEY]);
  },
};
