import { useCallback, useEffect, useState } from 'react';
import type { NotebookMeta } from '@/types';
import { notebookSyncService, type SyncMeta } from '@/services/notebook-sync-service';

export function useNotebooksPage() {
  const [notebooks, setNotebooks] = useState<NotebookMeta[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMeta, setSyncMeta] = useState<SyncMeta | null>(null);

  // Initial load
  useEffect(() => {
    Promise.all([notebookSyncService.getAll(), notebookSyncService.getSyncMeta()])
      .then(([loaded, meta]) => {
        setNotebooks(loaded);
        setSyncMeta(meta);
      })
      .finally(() => setIsLoading(false));
  }, []);

  // Listen for sync storage changes (background sync or cross-device)
  useEffect(() => {
    const listener = (changes: Record<string, chrome.storage.StorageChange>) => {
      if ('notebooksMeta' in changes) {
        const updated = (changes.notebooksMeta.newValue as NotebookMeta[]) ?? [];
        setNotebooks(updated.sort((a, b) => b.lastSyncedAt - a.lastSyncedAt));
      }
      if ('notebooksSyncMeta' in changes) {
        setSyncMeta((changes.notebooksSyncMeta.newValue as SyncMeta) ?? null);
        setIsSyncing(false);
      }
    };
    chrome.storage.sync.onChanged.addListener(listener);
    return () => chrome.storage.sync.onChanged.removeListener(listener);
  }, []);

  const handleRefresh = useCallback(async () => {
    setIsSyncing(true);
    try {
      await chrome.runtime.sendMessage({ type: 'SYNC_NOTEBOOKS' });
    } catch {
      setIsSyncing(false);
    }
  }, []);

  const handleRemove = useCallback(async (id: string) => {
    await notebookSyncService.remove(id);
    setNotebooks((prev) => prev.filter((n) => n.id !== id));
  }, []);

  return {
    notebooks,
    isLoading,
    isSyncing,
    lastSyncedAt: syncMeta?.lastSyncedAt ?? null,
    syncError: syncMeta?.error ?? null,
    handleRefresh,
    handleRemove,
  };
}
