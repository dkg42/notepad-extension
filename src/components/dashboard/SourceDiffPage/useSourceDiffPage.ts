/**
 * @module useSourceDiffPage
 * @description Hook for the Source Diff dashboard page. Loads aggregated sources (via the
 *   shared all-sources cache) plus the notebook list, then computes a URL-and-title-based
 *   set diff between the sources of two user-picked notebooks.
 * @dependencies @/types, @/services/notebook-sync-service, @/services/all-sources-cache-service
 * @public useSourceDiffPage
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { AggregatedSource, NotebookMeta } from '@/types';
import { notebookSyncService } from '@/services/notebook-sync-service';
import {
  allSourcesCacheService,
  type AllSourcesCache,
} from '@/services/all-sources-cache-service';
import { scopedStorage } from '@/services/storage/scoped-storage';

interface FetchAllSourcesResult {
  ok: boolean;
  sources?: AggregatedSource[];
  error?: string;
}

function normalizeUrl(url: string): string {
  let u = url.trim().toLowerCase();
  u = u.replace(/^https?:\/\//, '');
  u = u.replace(/^www\./, '');
  u = u.replace(/#.*$/, '');
  u = u.replace(/\/+$/, '');
  return u;
}

function sourceKey(s: AggregatedSource): string {
  if (s.sourceUrl) return `u:${normalizeUrl(s.sourceUrl)}`;
  return `t:${s.title.trim().toLowerCase()}`;
}

export function useSourceDiffPage() {
  const [sources, setSources] = useState<AggregatedSource[]>([]);
  const [notebooks, setNotebooks] = useState<NotebookMeta[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCacheLoaded, setIsCacheLoaded] = useState(false);
  const [hasFreshCache, setHasFreshCache] = useState(false);

  const [notebookAId, setNotebookAId] = useState<string>('');
  const [notebookBId, setNotebookBId] = useState<string>('');

  useEffect(() => {
    Promise.all([
      allSourcesCacheService.get(),
      notebookSyncService.getAll(),
    ]).then(([cached, loadedNotebooks]) => {
      setNotebooks(loadedNotebooks);
      if (cached) {
        setSources(cached.sources);
        setHasFreshCache(!cached.isStale);
        setIsLoading(false);
      }
    }).finally(() => setIsCacheLoaded(true));
  }, []);

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
    if (!isCacheLoaded || hasFreshCache) return;
    void fetchData();
  }, [isCacheLoaded, hasFreshCache, fetchData]);

  useEffect(() => {
    return scopedStorage.onChanged<AllSourcesCache>('allSourcesCache', (changes) => {
      const cache = changes.allSourcesCache?.newValue;
      if (cache?.sources) setSources(cache.sources);
    });
  }, []);

  // Notebook options: only those that actually contributed sources to the
  // aggregated cache (so picking an empty notebook is impossible).
  const notebookOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const s of sources) {
      if (!seen.has(s.notebookId)) seen.set(s.notebookId, s.notebookTitle);
    }
    // Prefer NotebookMeta titles where available (they may be more current).
    const titleById = new Map(notebooks.map((n) => [n.id, n.title]));
    return Array.from(seen.entries())
      .map(([id, fallbackTitle]) => ({ id, title: titleById.get(id) ?? fallbackTitle }))
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [sources, notebooks]);

  const { sourcesA, sourcesB, onlyInA, onlyInB, inBoth } = useMemo(() => {
    if (!notebookAId || !notebookBId || notebookAId === notebookBId) {
      return { sourcesA: [], sourcesB: [], onlyInA: [], onlyInB: [], inBoth: [] };
    }
    const aList = sources.filter((s) => s.notebookId === notebookAId);
    const bList = sources.filter((s) => s.notebookId === notebookBId);
    const keysA = new Set(aList.map(sourceKey));
    const keysB = new Set(bList.map(sourceKey));
    return {
      sourcesA: aList,
      sourcesB: bList,
      onlyInA: aList.filter((s) => !keysB.has(sourceKey(s))),
      onlyInB: bList.filter((s) => !keysA.has(sourceKey(s))),
      inBoth: aList.filter((s) => keysB.has(sourceKey(s))),
    };
  }, [sources, notebookAId, notebookBId]);

  const handleSwap = useCallback(() => {
    setNotebookAId(notebookBId);
    setNotebookBId(notebookAId);
  }, [notebookAId, notebookBId]);

  return {
    isLoading,
    error,
    setError,
    notebookOptions,
    notebookAId,
    notebookBId,
    setNotebookAId,
    setNotebookBId,
    handleSwap,
    sourcesA,
    sourcesB,
    onlyInA,
    onlyInB,
    inBoth,
    handleRefresh: fetchData,
  };
}
