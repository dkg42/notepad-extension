import type { NotebookAnnotation, NotebookCollection } from '@/types';
import { driveSyncService } from './drive/drive-sync-service';
import { getValidToken } from './token-lifecycle-service';

const ANNOTATIONS_KEY = 'notebookAnnotations';
const COLLECTIONS_KEY = 'notebookCollections';

async function getDriveToken(): Promise<string | null> {
  const result = await getValidToken();
  if (!result.ok || !result.hasDriveScope) return null;
  return result.accessToken;
}

/**
 * Service for persisting user-defined notebook annotations (tags, collection
 * assignments) and collections in chrome.storage.sync.
 *
 * Kept separate from notebookSyncService so that background API syncs
 * (which overwrite NotebookMeta) never clobber user-authored data.
 */
export const notebookAnnotationService = {
  // ── Annotations ────────────────────────────────────────────────────────────

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
    void getDriveToken().then(async (t) => {
      if (!t) return;
      const collections = await this.getAllCollections();
      driveSyncService.saveAnnotations(all, collections, t);
    });
  },

  async removeAnnotation(notebookId: string): Promise<void> {
    const all = await this.getAllAnnotations();
    const filtered = all.filter((a) => a.notebookId !== notebookId);
    await chrome.storage.sync.set({ [ANNOTATIONS_KEY]: filtered });
    void getDriveToken().then(async (t) => {
      if (!t) return;
      const collections = await this.getAllCollections();
      driveSyncService.saveAnnotations(filtered, collections, t);
    });
  },

  // ── Collections ─────────────────────────────────────────────────────────────

  async getAllCollections(): Promise<NotebookCollection[]> {
    const result = await chrome.storage.sync.get(COLLECTIONS_KEY);
    return (result[COLLECTIONS_KEY] as NotebookCollection[]) ?? [];
  },

  async upsertCollection(collection: NotebookCollection): Promise<void> {
    const all = await this.getAllCollections();
    const idx = all.findIndex((c) => c.id === collection.id);
    if (idx >= 0) {
      all[idx] = collection;
    } else {
      all.push(collection);
    }
    await chrome.storage.sync.set({ [COLLECTIONS_KEY]: all });
    void getDriveToken().then(async (t) => {
      if (!t) return;
      const annotations = await this.getAllAnnotations();
      driveSyncService.saveAnnotations(annotations, all, t);
    });
  },

  /**
   * Removes a collection and unassigns any notebooks that belonged to it.
   * Both writes are batched into a single chrome.storage.sync.set call.
   */
  async removeCollection(collectionId: string): Promise<void> {
    const [collections, annotations] = await Promise.all([
      this.getAllCollections(),
      this.getAllAnnotations(),
    ]);
    const updatedCollections = collections.filter((c) => c.id !== collectionId);
    const updatedAnnotations = annotations.map((a) =>
      a.collectionId === collectionId ? { ...a, collectionId: undefined } : a,
    );
    await chrome.storage.sync.set({
      [COLLECTIONS_KEY]: updatedCollections,
      [ANNOTATIONS_KEY]: updatedAnnotations,
    });
    void getDriveToken().then((t) => {
      if (t) driveSyncService.saveAnnotations(updatedAnnotations, updatedCollections, t);
    });
  },

  async clearAllData(): Promise<void> {
    await chrome.storage.sync.remove([ANNOTATIONS_KEY, COLLECTIONS_KEY]);
  },
};
