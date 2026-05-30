/**
 * @module useAllAudioPage
 * @description Hook for the All Audio dashboard page that fetches artifacts and filters to audio-only entries (typeCode === 1). Supports notebook filter, text search, and multi-field sorting.
 * @dependencies @/types
 * @public useAllAudioPage
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

export function useAllAudioPage() {
  const [allArtifacts, setAllArtifacts] = useState<AggregatedArtifact[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Sort
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  // Filter
  const [filterNotebook, setFilterNotebook] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const [isCacheLoaded, setIsCacheLoaded] = useState(false);
  const [hasFreshCache, setHasFreshCache] = useState(false);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await chrome.runtime.sendMessage({
        type: 'FETCH_ALL_ARTIFACTS',
      }) as FetchAllArtifactsResult;

      if (!result?.ok) {
        setError(result?.error ?? 'Failed to fetch audio artifacts');
        return;
      }

      // Only show audio artifacts (typeCode === 1)
      setAllArtifacts((result.artifacts ?? []).filter((a) => a.typeCode === 1));
    } catch {
      setError('Failed to reach the extension background. Try reloading.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // On mount: read cache immediately so the page renders with audio rows before any API call.
  useEffect(() => {
    allArtifactsCacheService.get().then((cached) => {
      if (cached) {
        setAllArtifacts(cached.artifacts.filter((a) => a.typeCode === 1));
        setHasFreshCache(!cached.isStale);
        setIsLoading(false);
      }
    }).finally(() => setIsCacheLoaded(true));
  }, []);

  // Fetch from API only after the cache check completes and only when cache is absent or stale.
  useEffect(() => {
    if (!isCacheLoaded || hasFreshCache) return;
    void fetchData();
  }, [isCacheLoaded, hasFreshCache, fetchData]);

  // Listen for cache updates written by the background sync.
  useEffect(() => {
    return scopedStorage.onChanged<AllArtifactsCache>('allArtifactsCache', (changes) => {
      const cache = changes.allArtifactsCache?.newValue;
      if (cache?.artifacts) {
        setAllArtifacts(cache.artifacts.filter((a) => a.typeCode === 1));
      }
    });
  }, []);

  const notebookOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of allArtifacts) {
      map.set(a.notebookId, a.notebookTitle);
    }
    return Array.from(map.entries()).map(([id, title]) => ({ id, title }));
  }, [allArtifacts]);

  const artifacts = useMemo(() => {
    let result = allArtifacts;

    if (filterNotebook !== 'all') {
      result = result.filter((a) => a.notebookId === filterNotebook);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (a) => a.title.toLowerCase().includes(q) || a.notebookTitle.toLowerCase().includes(q),
      );
    }

    return [...result].sort((a, b) => {
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
  }, [allArtifacts, filterNotebook, searchQuery, sortField, sortDir]);

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
    artifacts,
    totalCount: allArtifacts.length,
    isLoading,
    error,
    setError,
    notebookOptions,
    sortField,
    sortDir,
    handleSort,
    filterNotebook,
    setFilterNotebook,
    searchQuery,
    setSearchQuery,
    handleRefresh: fetchData,
  };
}
