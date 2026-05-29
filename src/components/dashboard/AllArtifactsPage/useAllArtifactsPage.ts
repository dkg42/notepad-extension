/**
 * @module useAllArtifactsPage
 * @description Hook for the All Artifacts dashboard page that fetches every artifact across all notebooks via the extension background, applies notebook/status filters and text search, and sorts the result.
 * @dependencies @/types
 * @public useAllArtifactsPage
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { AggregatedArtifact } from '@/types';
import { allArtifactsCacheService, type AllArtifactsCache } from '@/services/all-artifacts-cache-service';
import { scopedStorage } from '@/services/storage/scoped-storage';

type SortField = 'title' | 'notebookTitle' | 'createdAt';
type SortDir = 'asc' | 'desc';

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
    return scopedStorage.onChanged<AllArtifactsCache>('allArtifactsCache', (changes) => {
      const cache = changes.allArtifactsCache?.newValue;
      if (cache?.artifacts) setArtifacts(cache.artifacts);
    });
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
    handleRefresh: fetchData,
  };
}
