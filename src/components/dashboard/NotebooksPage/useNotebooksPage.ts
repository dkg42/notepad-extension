import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { NotebookAnnotation, NotebookCollection, NotebookMeta, SourceRecord } from '@/types';
import { notebookSyncService, type SyncMeta } from '@/services/notebook-sync-service';
import { notebookAnnotationService } from '@/services/notebook-annotation-service';
import { sourceExportStrategies } from '@/export/source-export-registry';

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

/** Sentinel used in activeCollectionId to show notebooks with no collection. */
export const UNCOLLECTED_FILTER_ID = '__uncollected__';

export function useNotebooksPage() {
  const [notebooks, setNotebooks] = useState<NotebookMeta[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMeta, setSyncMeta] = useState<SyncMeta | null>(null);
  const [annotations, setAnnotations] = useState<NotebookAnnotation[]>([]);
  const [collections, setCollections] = useState<NotebookCollection[]>([]);
  const [activeCollectionId, setActiveCollectionId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [sourceCounts, setSourceCounts] = useState<Record<string, number>>({});
  const [fetchingSourcesId, setFetchingSourcesId] = useState<string | null>(null);
  const [sourceExportError, setSourceExportError] = useState<string | null>(null);

  // ── Initial load ────────────────────────────────────────────────────────────

  useEffect(() => {
    Promise.all([
      notebookSyncService.getAll(),
      notebookSyncService.getSyncMeta(),
      notebookAnnotationService.getAllAnnotations(),
      notebookAnnotationService.getAllCollections(),
    ])
      .then(([loaded, meta, loadedAnnotations, loadedCollections]) => {
        setNotebooks(loaded);
        setSyncMeta(meta);
        setAnnotations(loadedAnnotations);
        setCollections(loadedCollections);
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
      if ('notebookCollections' in changes) {
        setCollections((changes.notebookCollections.newValue as NotebookCollection[]) ?? []);
      }
    };
    chrome.storage.sync.onChanged.addListener(listener);
    return () => chrome.storage.sync.onChanged.removeListener(listener);
  }, []);

  // ── Auto-fetch source counts once notebooks are loaded ────────────────────

  const hasFetchedCounts = useRef(false);

  useEffect(() => {
    if (isLoading || notebooks.length === 0 || hasFetchedCounts.current) return;
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
  }, [isLoading, notebooks]);

  // ── Derived state ───────────────────────────────────────────────────────────

  const getAnnotation = useCallback(
    (notebookId: string): NotebookAnnotation =>
      annotations.find((a) => a.notebookId === notebookId) ?? { notebookId, tags: [] },
    [annotations],
  );

  const filteredNotebooks = useMemo(() => {
    if (activeCollectionId === null) return notebooks;
    if (activeCollectionId === UNCOLLECTED_FILTER_ID) {
      return notebooks.filter((n) => !getAnnotation(n.id).collectionId);
    }
    return notebooks.filter((n) => getAnnotation(n.id).collectionId === activeCollectionId);
  }, [notebooks, annotations, activeCollectionId, getAnnotation]);

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

      // Background already removed the notebook from notebooksMeta storage;
      // clean up the local annotation as well.
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

  // ── Collection handlers ─────────────────────────────────────────────────────

  const handleCreateCollection = useCallback(
    async (name: string): Promise<string> => {
      const collection: NotebookCollection = {
        id: crypto.randomUUID(),
        name: name.trim(),
        createdAt: Date.now(),
      };
      await notebookAnnotationService.upsertCollection(collection);
      setCollections((prev) => [...prev, collection]);
      return collection.id;
    },
    [],
  );

  const handleDeleteCollection = useCallback(
    async (collectionId: string) => {
      await notebookAnnotationService.removeCollection(collectionId);
      setCollections((prev) => prev.filter((c) => c.id !== collectionId));
      setAnnotations((prev) =>
        prev.map((a) =>
          a.collectionId === collectionId ? { ...a, collectionId: undefined } : a,
        ),
      );
      if (activeCollectionId === collectionId) {
        setActiveCollectionId(null);
      }
    },
    [activeCollectionId],
  );

  const handleAssignCollection = useCallback(
    async (notebookId: string, collectionId: string | undefined) => {
      const annotation = getAnnotation(notebookId);
      const updated = { ...annotation, collectionId };
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

  const handleBulkAssignCollection = useCallback(
    async (ids: string[], collectionId: string | undefined) => {
      await Promise.all(
        ids.map((notebookId) => {
          const annotation = annotations.find((a) => a.notebookId === notebookId) ?? { notebookId, tags: [] };
          return notebookAnnotationService.setAnnotation({ ...annotation, collectionId });
        }),
      );
      setAnnotations((prev) => {
        const idSet = new Set(ids);
        const updated = prev.map((a) =>
          idSet.has(a.notebookId) ? { ...a, collectionId } : a,
        );
        // Add annotations for notebooks that didn't have one yet
        const existing = new Set(updated.map((a) => a.notebookId));
        const fresh = ids
          .filter((id) => !existing.has(id))
          .map((notebookId) => ({ notebookId, tags: [], collectionId }));
        return [...updated, ...fresh];
      });
      setSelectedIds(new Set());
    },
    [annotations],
  );

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
    collections,
    activeCollectionId,
    setActiveCollectionId,
    selectedIds,
    toggleSelectNotebook,
    toggleSelectAll,
    clearSelection,
    getAnnotation,
    handleRefresh,
    handleDelete,
    handleAddTag,
    handleRemoveTag,
    handleCreateCollection,
    handleDeleteCollection,
    handleAssignCollection,
    handleBulkAssignCollection,
  };
}
