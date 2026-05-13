/**
 * @module notebook-sync-service
 * @description Persists NotebookLM notebook metadata (titles, URLs, sync timestamps) in chrome.storage.local. Multi-device sync is handled exclusively through Google Drive. Notebook metadata is stored separately from user annotations so that background API syncs cannot overwrite user-authored tags or collection assignments.
 * @dependencies (none — uses only chrome.storage.local)
 * @public notebookSyncService, SyncMeta
 */
import type { NotebookMeta } from '@/types';

const NOTEBOOKS_KEY = 'notebooksMeta';
const SYNC_META_KEY = 'notebooksSyncMeta';

export interface SyncMeta {
  lastSyncedAt: number;
  ownerUid?: string;
  error?: string;
}

/**
 * Service for persisting NotebookLM notebook metadata in chrome.storage.local.
 * Multi-device sync is handled through Google Drive, not chrome.storage.sync.
 */
export const notebookSyncService = {
  async getAll(): Promise<NotebookMeta[]> {
    const result = await chrome.storage.local.get(NOTEBOOKS_KEY);
    const notebooks: NotebookMeta[] = result[NOTEBOOKS_KEY] ?? [];
    return notebooks.sort((a, b) => b.lastSyncedAt - a.lastSyncedAt);
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
