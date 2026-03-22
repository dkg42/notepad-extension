import type { NotebookMeta } from '@/types';

const NOTEBOOKS_KEY = 'notebooksMeta';
const SYNC_META_KEY = 'notebooksSyncMeta';
const MAX_NOTEBOOKS = 150;

export interface SyncMeta {
  lastSyncedAt: number;
  error?: string;
}

/**
 * Service for persisting NotebookLM notebook metadata in chrome.storage.sync.
 *
 * Uses chrome.storage.sync (not local) so data propagates across all Chrome
 * sign-in devices automatically. Enforces a cap of MAX_NOTEBOOKS entries to
 * stay within the 100 KB sync quota.
 */
export const notebookSyncService = {
  async getAll(): Promise<NotebookMeta[]> {
    const result = await chrome.storage.sync.get(NOTEBOOKS_KEY);
    const notebooks: NotebookMeta[] = result[NOTEBOOKS_KEY] ?? [];
    return notebooks.sort((a, b) => b.lastSyncedAt - a.lastSyncedAt);
  },

  async upsertMany(incoming: NotebookMeta[]): Promise<void> {
    const existing = await this.getAll();
    const map = new Map(existing.map((n) => [n.id, n]));

    for (const notebook of incoming) {
      map.set(notebook.id, notebook);
    }

    let sorted = Array.from(map.values()).sort((a, b) => b.lastSyncedAt - a.lastSyncedAt);
    sorted = sorted.slice(0, MAX_NOTEBOOKS);

    // Quota guard: trim from oldest until payload fits
    while (sorted.length > 0) {
      const payload = JSON.stringify(sorted);
      if (payload.length < 90_000) break;
      sorted.pop();
    }

    await chrome.storage.sync.set({ [NOTEBOOKS_KEY]: sorted });
  },

  async remove(id: string): Promise<void> {
    const notebooks = await this.getAll();
    const filtered = notebooks.filter((n) => n.id !== id);
    await chrome.storage.sync.set({ [NOTEBOOKS_KEY]: filtered });
  },

  async clear(): Promise<void> {
    await chrome.storage.sync.remove([NOTEBOOKS_KEY, SYNC_META_KEY]);
  },

  async getSyncMeta(): Promise<SyncMeta | null> {
    const result = await chrome.storage.sync.get(SYNC_META_KEY);
    return (result[SYNC_META_KEY] as SyncMeta) ?? null;
  },

  async setSyncMeta(meta: SyncMeta): Promise<void> {
    await chrome.storage.sync.set({ [SYNC_META_KEY]: meta });
  },
};
