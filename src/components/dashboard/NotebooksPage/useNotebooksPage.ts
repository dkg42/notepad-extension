/**
 * @module useNotebooksPage
 * @description Hook for the Notebooks dashboard page managing notebook list, annotations, folders, row selection, and CRUD operations. Listens to chrome.storage.sync for live updates and auto-fetches source counts after the initial load.
 * @dependencies @/types, @/services/notebook-sync-service, @/services/notebook-annotation-service, @/services/notebook-folder-service, @/export/source-export-registry, @/utils/folder-utils
 * @public useNotebooksPage, UNFILED_FILTER_ID
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Folder, NotebookAnnotation, NotebookMeta, SourceRecord } from '@/types';
import { notebookSyncService, type SyncMeta } from '@/services/notebook-sync-service';
import { notebookAnnotationService } from '@/services/notebook-annotation-service';
import { notebookFolderService } from '@/services/notebook-folder-service';
import { sourceCountCacheService, type SourceCountsCache } from '@/services/source-count-cache-service';
import { sourceExportStrategies } from '@/export/source-export-registry';
import { getFolderSubtreeIds } from '@/utils/folder-utils';

interface DeleteResult {
  ok: boolean;
  error?: string;
}

interface FetchSourcesResult {
  ok: boolean;
  sources?: SourceRecord[];
  count?: number;
  error?: string;
}

/** Sentinel used in activeFolderId to show notebooks with no folder assigned. */
export const UNFILED_FILTER_ID = '__unfiled__';

export function useNotebooksPage() {
  const [notebooks, setNotebooks] = useState<NotebookMeta[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMeta, setSyncMeta] = useState<SyncMeta | null>(null);
  const [annotations, setAnnotations] = useState<NotebookAnnotation[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [sourceCounts, setSourceCounts] = useState<Record<string, number>>({});
  const [fetchingSourcesId, setFetchingSourcesId] = useState<string | null>(null);
  const [sourceExportError, setSourceExportError] = useState<string | null>(null);
  const [hasFreshCache, setHasFreshCache] = useState(false);

  // ── Initial load ────────────────────────────────────────────────────────────

  useEffect(() => {
    Promise.all([
      notebookSyncService.getAll(),
      notebookSyncService.getSyncMeta(),
      notebookAnnotationService.getAllAnnotations(),
      notebookFolderService.getFolders(),
      sourceCountCacheService.get(),
    ])
      .then(([loaded, meta, loadedAnnotations, loadedFolders, cachedCounts]) => {
        setNotebooks(loaded);
        setSyncMeta(meta);
        setAnnotations(loadedAnnotations);
        setFolders(loadedFolders);
        if (cachedCounts) {
          setSourceCounts(cachedCounts.counts);
          setHasFreshCache(!cachedCounts.isStale);
        }
      })
      .finally(() => setIsLoading(false));
  }, []);

  // ── Storage change listener (background sync + cross-device) ───────────────

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
      if ('notebookAnnotations' in changes) {
        setAnnotations((changes.notebookAnnotations.newValue as NotebookAnnotation[]) ?? []);
      }
      if ('notebookFolders' in changes) {
        setFolders((changes.notebookFolders.newValue as Folder[]) ?? []);
      }
    };
    chrome.storage.sync.onChanged.addListener(listener);
    return () => chrome.storage.sync.onChanged.removeListener(listener);
  }, []);

  // ── Auto-fetch source counts once notebooks are loaded ────────────────────

  const hasFetchedCounts = useRef(false);

  useEffect(() => {
    if (isLoading || notebooks.length === 0 || hasFetchedCounts.current || hasFreshCache) return;
    hasFetchedCounts.current = true;

    setFetchingSourcesId('__all__');
    chrome.runtime
      .sendMessage({
        type: 'FETCH_SOURCE_COUNTS',
        notebookIds: notebooks.map((n) => n.id),
      })
      .then((result: { ok: boolean; counts?: Record<string, number> } | undefined) => {
        if (result?.ok && result.counts) {
          setSourceCounts(result.counts);
        }
      })
      .catch(() => {
        // Silent — cells will keep showing "—"
      })
      .finally(() => setFetchingSourcesId(null));
  }, [isLoading, notebooks, hasFreshCache]);

  // ── Listen for source count cache updates from background sync ────────────

  useEffect(() => {
    const listener = (changes: Record<string, chrome.storage.StorageChange>) => {
      if ('sourceCountsCache' in changes) {
        const cache = changes.sourceCountsCache.newValue as SourceCountsCache | undefined;
        if (cache?.counts) setSourceCounts(cache.counts);
      }
    };
    chrome.storage.local.onChanged.addListener(listener);
    return () => chrome.storage.local.onChanged.removeListener(listener);
  }, []);

  // ── Derived state ───────────────────────────────────────────────────────────

  const getAnnotation = useCallback(
    (notebookId: string): NotebookAnnotation =>
      annotations.find((a) => a.notebookId === notebookId) ?? { notebookId, tags: [] },
    [annotations],
  );

  const notebookCountByFolder = useMemo(() => {
    const map = new Map<string, number>();
    for (const folder of folders) {
      const subtree = getFolderSubtreeIds(folder.id, folders);
      const count = notebooks.filter((n) => {
        const fid = getAnnotation(n.id).folderId;
        return fid !== undefined && subtree.has(fid);
      }).length;
      map.set(folder.id, count);
    }
    return map;
  }, [notebooks, annotations, folders, getAnnotation]);

  const filteredNotebooks = useMemo(() => {
    if (activeFolderId === null) return notebooks;
    if (activeFolderId === UNFILED_FILTER_ID) {
      return notebooks.filter((n) => !getAnnotation(n.id).folderId);
    }
    const subtree = getFolderSubtreeIds(activeFolderId, folders);
    return notebooks.filter((n) => {
      const fid = getAnnotation(n.id).folderId;
      return fid !== undefined && subtree.has(fid);
    });
  }, [notebooks, annotations, activeFolderId, folders, getAnnotation]);

  // ── Notebook handlers ───────────────────────────────────────────────────────

  const handleRefresh = useCallback(async () => {
    setIsSyncing(true);
    try {
      await chrome.runtime.sendMessage({ type: 'SYNC_NOTEBOOKS' });
    } catch {
      setIsSyncing(false);
    }
  }, []);

  const handleDelete = useCallback(async (id: string): Promise<boolean> => {
    setDeletingId(id);
    setDeleteError(null);
    try {
      const result = await chrome.runtime.sendMessage({
        type: 'DELETE_NOTEBOOK',
        notebookId: id,
      }) as DeleteResult;

      if (!result?.ok) {
        setDeleteError(result?.error ?? 'Failed to delete notebook');
        return false;
      }

      await notebookAnnotationService.removeAnnotation(id);
      setNotebooks((prev) => prev.filter((n) => n.id !== id));
      setAnnotations((prev) => prev.filter((a) => a.notebookId !== id));
      return true;
    } catch {
      setDeleteError('Failed to reach the extension background. Try reloading.');
      return false;
    } finally {
      setDeletingId(null);
    }
  }, []);

  // ── Tag handlers ────────────────────────────────────────────────────────────

  const handleAddTag = useCallback(
    async (notebookId: string, tag: string) => {
      if (!tag) return;
      const annotation = getAnnotation(notebookId);
      if (annotation.tags.includes(tag)) return;
      const updated = { ...annotation, tags: [...annotation.tags, tag] };
      await notebookAnnotationService.setAnnotation(updated);
      setAnnotations((prev) => {
        const idx = prev.findIndex((a) => a.notebookId === notebookId);
        return idx >= 0
          ? prev.map((a, i) => (i === idx ? updated : a))
          : [...prev, updated];
      });
    },
    [getAnnotation],
  );

  const handleRemoveTag = useCallback(
    async (notebookId: string, tag: string) => {
      const annotation = getAnnotation(notebookId);
      const updated = { ...annotation, tags: annotation.tags.filter((t) => t !== tag) };
      await notebookAnnotationService.setAnnotation(updated);
      setAnnotations((prev) =>
        prev.map((a) => (a.notebookId === notebookId ? updated : a)),
      );
    },
    [getAnnotation],
  );

  // ── Folder handlers ─────────────────────────────────────────────────────────

  const handleCreateFolder = useCallback(
    async (name: string, parentId?: string): Promise<string> => {
      const folder = await notebookFolderService.createFolder(name, parentId);
      return folder.id;
    },
    [],
  );

  const handleRenameFolder = useCallback(
    async (id: string, name: string) => {
      await notebookFolderService.renameFolder(id, name);
      setFolders((prev) => prev.map((f) => (f.id === id ? { ...f, name } : f)));
    },
    [],
  );

  const handleDeleteFolder = useCallback(
    async (id: string) => {
      const subtree = getFolderSubtreeIds(id, folders);
      await notebookFolderService.deleteFolder(id);
      setFolders((prev) => prev.filter((f) => !subtree.has(f.id)));
      setAnnotations((prev) =>
        prev.map((a) =>
          a.folderId && subtree.has(a.folderId) ? { ...a, folderId: undefined } : a,
        ),
      );
      if (activeFolderId && subtree.has(activeFolderId)) {
        setActiveFolderId(null);
      }
    },
    [folders, activeFolderId],
  );

  const handleMoveFolder = useCallback(
    async (id: string, newParentId: string | undefined) => {
      await notebookFolderService.moveFolder(id, newParentId);
      setFolders((prev) =>
        prev.map((f) => (f.id === id ? { ...f, parentId: newParentId } : f)),
      );
    },
    [],
  );

  const handleFolderReorder = useCallback(
    async (updates: Array<{ id: string; sortOrder: number }>) => {
      await notebookFolderService.bulkUpdateFolderSortOrders(updates);
      const orderMap = new Map(updates.map((u) => [u.id, u.sortOrder]));
      setFolders((prev) =>
        prev.map((f) => (orderMap.has(f.id) ? { ...f, sortOrder: orderMap.get(f.id)! } : f)),
      );
    },
    [],
  );

  const handleAssignFolder = useCallback(
    async (notebookId: string, folderId: string | undefined) => {
      const annotation = getAnnotation(notebookId);
      const updated = { ...annotation, folderId };
      await notebookAnnotationService.setAnnotation(updated);
      setAnnotations((prev) => {
        const idx = prev.findIndex((a) => a.notebookId === notebookId);
        return idx >= 0
          ? prev.map((a, i) => (i === idx ? updated : a))
          : [...prev, updated];
      });
    },
    [getAnnotation],
  );

  const handleBulkAssignFolder = useCallback(
    async (ids: string[], folderId: string | undefined) => {
      await Promise.all(
        ids.map((notebookId) => {
          const annotation = annotations.find((a) => a.notebookId === notebookId) ?? { notebookId, tags: [] };
          return notebookAnnotationService.setAnnotation({ ...annotation, folderId });
        }),
      );
      setAnnotations((prev) => {
        const idSet = new Set(ids);
        const updated = prev.map((a) =>
          idSet.has(a.notebookId) ? { ...a, folderId } : a,
        );
        const existing = new Set(updated.map((a) => a.notebookId));
        const fresh = ids
          .filter((id) => !existing.has(id))
          .map((notebookId) => ({ notebookId, tags: [], folderId }));
        return [...updated, ...fresh];
      });
      setSelectedIds(new Set());
    },
    [annotations],
  );

  // ── Selection helpers ───────────────────────────────────────────────────────

  const toggleSelectNotebook = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(
    (visibleIds: string[]) => {
      setSelectedIds((prev) => {
        const allSelected = visibleIds.every((id) => prev.has(id));
        if (allSelected) return new Set();
        return new Set(visibleIds);
      });
    },
    [],
  );

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  const handleExportSources = useCallback(
    async (notebookId: string, notebookTitle: string, strategyType: string) => {
      setFetchingSourcesId(notebookId);
      setSourceExportError(null);
      try {
        const result = await chrome.runtime.sendMessage({
          type: 'FETCH_NOTEBOOK_SOURCES',
          notebookId,
        }) as FetchSourcesResult;

        if (!result?.ok) {
          setSourceExportError(result?.error ?? 'Failed to fetch sources');
          return;
        }

        const sources = result.sources ?? [];
        setSourceCounts((prev) => ({ ...prev, [notebookId]: result.count ?? sources.length }));

        const strategy = sourceExportStrategies.find((s) => s.type === strategyType);
        if (strategy) {
          const filename = `${notebookTitle.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-').toLowerCase()}-sources`;
          await strategy.export(sources, filename);
        }
      } catch {
        setSourceExportError('Failed to reach the extension background. Try reloading.');
      } finally {
        setFetchingSourcesId(null);
      }
    },
    [],
  );

  return {
    notebooks,
    filteredNotebooks,
    notebookCountByFolder,
    isLoading,
    isSyncing,
    lastSyncedAt: syncMeta?.lastSyncedAt ?? null,
    syncError: syncMeta?.error ?? null,
    deletingId,
    deleteError,
    setDeleteError,
    sourceCounts,
    fetchingSourcesId,
    sourceExportError,
    setSourceExportError,
    handleExportSources,
    annotations,
    folders,
    activeFolderId,
    setActiveFolderId,
    selectedIds,
    toggleSelectNotebook,
    toggleSelectAll,
    clearSelection,
    getAnnotation,
    handleRefresh,
    handleDelete,
    handleAddTag,
    handleRemoveTag,
    handleCreateFolder,
    handleRenameFolder,
    handleDeleteFolder,
    handleMoveFolder,
    handleFolderReorder,
    handleAssignFolder,
    handleBulkAssignFolder,
  };
}
