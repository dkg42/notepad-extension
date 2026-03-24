import { useCallback, useEffect, useMemo, useState } from 'react';
import type { AggregatedSource, NotebookMeta } from '@/types';
import { notebookSyncService } from '@/services/notebook-sync-service';
import { sourceExportStrategies } from '@/export/source-export-registry';

type SortField = 'title' | 'type' | 'notebookTitle';
type SortDir = 'asc' | 'desc';

interface FetchAllSourcesResult {
  ok: boolean;
  sources?: AggregatedSource[];
  error?: string;
}

export function useAllSourcesPage() {
  const [sources, setSources] = useState<AggregatedSource[]>([]);
  const [notebooks, setNotebooks] = useState<NotebookMeta[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Sort
  const [sortField, setSortField] = useState<SortField>('title');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  // Filter
  const [filterType, setFilterType] = useState<string>('all');
  const [filterNotebook, setFilterNotebook] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Add-to-notebook
  const [isAddingToNotebook, setIsAddingToNotebook] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // ── Load data ──────────────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [result, loadedNotebooks] = await Promise.all([
        chrome.runtime.sendMessage({ type: 'FETCH_ALL_SOURCES' }) as Promise<FetchAllSourcesResult>,
        notebookSyncService.getAll(),
      ]);

      if (!result?.ok) {
        setError(result?.error ?? 'Failed to fetch sources');
        return;
      }

      setSources(result.sources ?? []);
      setNotebooks(loadedNotebooks);
    } catch {
      setError('Failed to reach the extension background. Try reloading.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  // ── Derived values ─────────────────────────────────────────────────────────

  const sourceTypes = useMemo(() => {
    const types = new Set(sources.map((s) => s.type));
    return Array.from(types).sort();
  }, [sources]);

  const notebookOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of sources) {
      map.set(s.notebookId, s.notebookTitle);
    }
    return Array.from(map.entries()).map(([id, title]) => ({ id, title }));
  }, [sources]);

  const filteredAndSorted = useMemo(() => {
    let result = sources;

    if (filterType !== 'all') {
      result = result.filter((s) => s.type === filterType);
    }
    if (filterNotebook !== 'all') {
      result = result.filter((s) => s.notebookId === filterNotebook);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (s) =>
          s.title.toLowerCase().includes(q) ||
          s.notebookTitle.toLowerCase().includes(q),
      );
    }

    result = [...result].sort((a, b) => {
      const aVal = a[sortField] ?? '';
      const bVal = b[sortField] ?? '';
      const cmp = aVal.localeCompare(bVal);
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [sources, filterType, filterNotebook, searchQuery, sortField, sortDir]);

  // ── Sort handler ───────────────────────────────────────────────────────────

  const handleSort = useCallback(
    (field: SortField) => {
      if (sortField === field) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortField(field);
        setSortDir('asc');
      }
    },
    [sortField],
  );

  // ── Selection ──────────────────────────────────────────────────────────────

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    const visibleIds = filteredAndSorted.map((s) => s.id);
    setSelectedIds((prev) => {
      const allSelected = visibleIds.every((id) => prev.has(id));
      if (allSelected) return new Set();
      return new Set(visibleIds);
    });
  }, [filteredAndSorted]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  // ── Add to notebook ────────────────────────────────────────────────────────

  const handleAddToNotebook = useCallback(
    async (targetNotebookId: string) => {
      const selected = sources.filter((s) => selectedIds.has(s.id));
      if (selected.length === 0) return;

      // We can only add URL-based sources (website/youtube).
      // For other types we'd need the source URL which isn't available in detail records.
      // For now, skip non-URL sources with a warning.
      const urlSources = selected.filter(
        (s) => s.sourceUrl && s.sourceUrl.startsWith('http'),
      );

      if (urlSources.length === 0) {
        setAddError(
          'Selected sources have no URLs available. Only website and YouTube sources can be added to another notebook.',
        );
        return;
      }

      setIsAddingToNotebook(true);
      setAddError(null);

      try {
        const urls = urlSources.map((s) => s.sourceUrl!);
        const result = await chrome.runtime.sendMessage({
          type: 'BULK_ADD_SOURCES',
          notebookId: targetNotebookId,
          urls,
        }) as { ok: boolean; jobId?: string; error?: string };

        if (!result?.ok) {
          setAddError(result?.error ?? 'Failed to start import');
        }

        clearSelection();
      } catch {
        setAddError('Failed to reach the extension background.');
      } finally {
        setIsAddingToNotebook(false);
      }
    },
    [sources, selectedIds, clearSelection],
  );

  // ── Export ─────────────────────────────────────────────────────────────────

  const handleExport = useCallback(
    async (strategyType: string) => {
      const toExport = selectedIds.size > 0
        ? filteredAndSorted.filter((s) => selectedIds.has(s.id))
        : filteredAndSorted;

      const strategy = sourceExportStrategies.find((s) => s.type === strategyType);
      if (!strategy) return;

      const asSourceRecords = toExport.map((s) => ({
        title: `${s.title} [${s.notebookTitle}]`,
        type: s.type,
      }));

      await strategy.export(asSourceRecords, 'all-sources');
    },
    [filteredAndSorted, selectedIds],
  );

  return {
    sources: filteredAndSorted,
    totalCount: sources.length,
    notebooks,
    isLoading,
    error,
    setError,
    sourceTypes,
    notebookOptions,
    sortField,
    sortDir,
    handleSort,
    filterType,
    setFilterType,
    filterNotebook,
    setFilterNotebook,
    searchQuery,
    setSearchQuery,
    selectedIds,
    toggleSelect,
    toggleSelectAll,
    clearSelection,
    isAddingToNotebook,
    addError,
    setAddError,
    handleAddToNotebook,
    handleExport,
    handleRefresh: fetchData,
  };
}
