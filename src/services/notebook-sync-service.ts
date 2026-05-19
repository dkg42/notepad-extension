/**
 * @module notebook-sync-service
 * @description Persists NotebookLM notebook metadata (titles, URLs, sync timestamps) in chrome.storage.local. This metadata is NOT synced to Google Drive — it is re-fetched from the NotebookLM API on each device. Only a minimal {id,name} reference is synced (alongside notebook annotations) so annotated/foldered notebooks render with a name before the API sync runs; the stable NotebookLM id is the cross-device link (notebooks can be renamed upstream, so the name is only a cached display label). Notebook metadata is stored separately from user annotations so that background API syncs cannot overwrite user-authored tags or folder assignments.
 * @dependencies @/types, drive/types/drive-schemas
 * @public notebookSyncService, SyncMeta
 */
import type { NotebookMeta } from '@/types';
import type { DriveNotebookRef } from './drive/types/drive-schemas';

const NOTEBOOKS_KEY = 'notebooksMeta';
const SYNC_META_KEY = 'notebooksSyncMeta';

export interface SyncMeta {
  lastSyncedAt: number;
  ownerUid?: string;
  error?: string;
}

/**
 * Service for persisting NotebookLM notebook metadata in chrome.storage.local.
 * The full metadata is device-local and re-fetched from the NotebookLM API; only
 * a minimal {id,name} ref (see getRefs) is synced to Drive with annotations.
 */
export const notebookSyncService = {
  async getAll(): Promise<NotebookMeta[]> {
    const result = await chrome.storage.local.get(NOTEBOOKS_KEY);
    const notebooks: NotebookMeta[] = result[NOTEBOOKS_KEY] ?? [];
    return notebooks.sort((a, b) => b.lastSyncedAt - a.lastSyncedAt);
  },

  /**
   * Minimal {id,name} refs synced alongside notebook annotations. The stable
   * NotebookLM id is the cross-device link; name is a cached display label
   * refreshed from NotebookLM when the API sync runs.
   */
  async getRefs(): Promise<DriveNotebookRef[]> {
    const notebooks = await this.getAll();
    return notebooks.map((n) => ({ id: n.id, name: n.title }));
  },

  async upsertMany(incoming: NotebookMeta[]): Promise<void> {
    const existing = await this.getAll();
    const map = new Map(existing.map((n) => [n.id, n]));

    for (const notebook of incoming) {
      map.set(notebook.id, notebook);
    }

    const sorted = Array.from(map.values()).sort((a, b) => b.lastSyncedAt - a.lastSyncedAt);

    await chrome.storage.local.set({ [NOTEBOOKS_KEY]: sorted });
  },

  async remove(id: string): Promise<void> {
    const notebooks = await this.getAll();
    const filtered = notebooks.filter((n) => n.id !== id);
    await chrome.storage.local.set({ [NOTEBOOKS_KEY]: filtered });
  },

  async clear(): Promise<void> {
    await chrome.storage.local.remove([NOTEBOOKS_KEY, SYNC_META_KEY]);
  },

  async getSyncMeta(): Promise<SyncMeta | null> {
    const result = await chrome.storage.local.get(SYNC_META_KEY);
    return (result[SYNC_META_KEY] as SyncMeta) ?? null;
  },

  async setSyncMeta(meta: SyncMeta): Promise<void> {
    await chrome.storage.local.set({ [SYNC_META_KEY]: meta });
  },
};
