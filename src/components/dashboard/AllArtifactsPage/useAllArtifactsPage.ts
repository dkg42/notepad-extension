/**
 * @module useAllArtifactsPage
 * @description Hook for the All Artifacts dashboard page that fetches every artifact across all notebooks via the extension background, applies notebook/status filters and text search, sorts the result, and exposes CSV and JSON export handlers.
 * @dependencies @/types
 * @public useAllArtifactsPage
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { AggregatedArtifact } from '@/types';
import { allArtifactsCacheService, type AllArtifactsCache } from '@/services/all-artifacts-cache-service';

type SortField = 'title' | 'notebookTitle' | 'createdAt';
type SortDir = 'asc' | 'desc';

const ARTIFACT_TYPE_LABELS: Record<number, string> = {
  1: 'Audio Overview',
};

interface FetchAllArtifactsResult {
  ok: boolean;
  artifacts?: AggregatedArtifact[];
  error?: string;
}

export function useAllArtifactsPage() {
  const [artifacts, setArtifacts] = useState<AggregatedArtifact[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Sort
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  // Filter
  const [filterNotebook, setFilterNotebook] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const [isCacheLoaded, setIsCacheLoaded] = useState(false);
  const [hasFreshCache, setHasFreshCache] = useState(false);

  // ── Load data ──────────────────────────────────────────────────────────────

  // On mount: read cache immediately so the page renders with data before any API call.
  // isCacheLoaded gates the API fetch so it never fires before we know the cache state.
  useEffect(() => {
    allArtifactsCacheService.get().then((cached) => {
      if (cached) {
        setArtifacts(cached.artifacts);
        setHasFreshCache(!cached.isStale);
        setIsLoading(false);
      }
    }).finally(() => setIsCacheLoaded(true));
  }, []);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await chrome.runtime.sendMessage({
        type: 'FETCH_ALL_ARTIFACTS',
      }) as FetchAllArtifactsResult;

      if (!result?.ok) {
        setError(result?.error ?? 'Failed to fetch artifacts');
        return;
      }

      setArtifacts(result.artifacts ?? []);
    } catch {
      setError('Failed to reach the extension background. Try reloading.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch from API only after the cache check completes and only when cache is absent or stale.
  useEffect(() => {
    if (!isCacheLoaded || hasFreshCache) return;
    void fetchData();
  }, [isCacheLoaded, hasFreshCache, fetchData]);

  // Listen for cache updates written by the background sync or a manual refresh.
  useEffect(() => {
    const listener = (changes: Record<string, chrome.storage.StorageChange>) => {
      if ('allArtifactsCache' in changes) {
        const cache = changes.allArtifactsCache.newValue as AllArtifactsCache | undefined;
        if (cache?.artifacts) setArtifacts(cache.artifacts);
      }
    };
    chrome.storage.local.onChanged.addListener(listener);
    return () => chrome.storage.local.onChanged.removeListener(listener);
  }, []);

  // ── Derived values ─────────────────────────────────────────────────────────

  const notebookOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of artifacts) {
      map.set(a.notebookId, a.notebookTitle);
    }
    return Array.from(map.entries()).map(([id, title]) => ({ id, title }));
  }, [artifacts]);

  const filteredAndSorted = useMemo(() => {
    let result = artifacts;

    if (filterNotebook !== 'all') {
      result = result.filter((a) => a.notebookId === filterNotebook);
    }
    if (filterStatus !== 'all') {
      const statusCode = Number(filterStatus);
      result = result.filter((a) => a.status === statusCode);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (a) =>
          a.title.toLowerCase().includes(q) ||
          a.notebookTitle.toLowerCase().includes(q),
      );
    }

    result = [...result].sort((a, b) => {
      if (sortField === 'createdAt') {
        const aVal = a.createdAt ?? 0;
        const bVal = b.createdAt ?? 0;
        return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
      }
      const aVal = a[sortField] ?? '';
      const bVal = b[sortField] ?? '';
      const cmp = String(aVal).localeCompare(String(bVal));
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [artifacts, filterNotebook, filterStatus, searchQuery, sortField, sortDir]);

  // ── Sort handler ───────────────────────────────────────────────────────────

  const handleSort = useCallback(
    (field: SortField) => {
      if (sortField === field) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortField(field);
        setSortDir(field === 'createdAt' ? 'desc' : 'asc');
      }
    },
    [sortField],
  );

  // ── Export ─────────────────────────────────────────────────────────────────

  const handleExportCsv = useCallback(() => {
    const rows = filteredAndSorted.map((a) => ({
      title: a.title,
      type: ARTIFACT_TYPE_LABELS[a.typeCode] ?? `Type ${a.typeCode}`,
      notebook: a.notebookTitle,
      status: a.status === 3 ? 'Completed' : a.status === 1 ? 'Processing' : a.status === 2 ? 'Pending' : 'Unknown',
      createdAt: a.createdAt ? new Date(a.createdAt).toISOString() : '',
    }));

    const header = 'Title,Type,Notebook,Status,Created At\n';
    const csv = header + rows.map((r) =>
      `"${r.title.replace(/"/g, '""')}","${r.type}","${r.notebook.replace(/"/g, '""')}","${r.status}","${r.createdAt}"`,
    ).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'all-artifacts.csv';
    a.click();
    URL.revokeObjectURL(url);
  }, [filteredAndSorted]);

  const handleExportJson = useCallback(() => {
    const data = filteredAndSorted.map((a) => ({
      id: a.id,
      title: a.title,
      typeCode: a.typeCode,
      notebook: a.notebookTitle,
      notebookId: a.notebookId,
      status: a.status,
      createdAt: a.createdAt,
      mediaUrl: a.mediaUrl,
    }));

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'all-artifacts.json';
    a.click();
    URL.revokeObjectURL(url);
  }, [filteredAndSorted]);

  return {
    artifacts: filteredAndSorted,
    totalCount: artifacts.length,
    isLoading,
    error,
    setError,
    notebookOptions,
    sortField,
    sortDir,
    handleSort,
    filterNotebook,
    setFilterNotebook,
    filterStatus,
    setFilterStatus,
    searchQuery,
    setSearchQuery,
    handleExportCsv,
    handleExportJson,
    handleRefresh: fetchData,
  };
}
