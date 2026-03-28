import { useCallback, useEffect, useMemo, useState } from 'react';
import type { AggregatedArtifact } from '@/types';

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

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

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
