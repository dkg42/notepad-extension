import type { NotebookAnnotation, NotebookCollection } from '@/types';

const ANNOTATIONS_KEY = 'notebookAnnotations';
const COLLECTIONS_KEY = 'notebookCollections';

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
  },

  async removeAnnotation(notebookId: string): Promise<void> {
    const all = await this.getAllAnnotations();
    const filtered = all.filter((a) => a.notebookId !== notebookId);
    await chrome.storage.sync.set({ [ANNOTATIONS_KEY]: filtered });
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
  },

  async clearAllData(): Promise<void> {
    await chrome.storage.sync.remove([ANNOTATIONS_KEY, COLLECTIONS_KEY]);
  },
};
