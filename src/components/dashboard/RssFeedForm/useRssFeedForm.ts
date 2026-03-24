import { useCallback, useState } from 'react';
import type { RssFeedEntry } from '@/types';

type DateFilter = '7d' | '30d' | 'all';

export function useRssFeedForm() {
  const [feedUrl, setFeedUrl] = useState('');
  const [entries, setEntries] = useState<RssFeedEntry[]>([]);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [selectedUrls, setSelectedUrls] = useState<Set<string>>(new Set());

  const fetchFeed = useCallback(async () => {
    if (!feedUrl.trim()) return;
    setIsFetching(true);
    setError(null);
    setEntries([]);
    setSelectedUrls(new Set());

    try {
      const result = await chrome.runtime.sendMessage({
        type: 'FETCH_RSS_FEED',
        feedUrl: feedUrl.trim(),
      }) as { ok: boolean; entries?: RssFeedEntry[]; error?: string };

      if (!result?.ok || !result.entries) {
        setError(result?.error ?? 'Failed to fetch feed');
        return;
      }

      setEntries(result.entries);
      // Select all by default
      setSelectedUrls(new Set(result.entries.map((e) => e.url)));
    } catch {
      setError('Failed to reach the extension background.');
    } finally {
      setIsFetching(false);
    }
  }, [feedUrl]);

  const filteredEntries = entries.filter((entry) => {
    if (dateFilter === 'all' || !entry.publishedAt) return true;
    const now = Date.now();
    const days = dateFilter === '7d' ? 7 : 30;
    return entry.publishedAt >= now - days * 24 * 60 * 60 * 1000;
  });

  const toggleEntry = useCallback((url: string) => {
    setSelectedUrls((prev) => {
      const next = new Set(prev);
      if (next.has(url)) next.delete(url);
      else next.add(url);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    const allFilteredUrls = filteredEntries.map((e) => e.url);
    const allSelected = allFilteredUrls.every((u) => selectedUrls.has(u));
    if (allSelected) {
      setSelectedUrls((prev) => {
        const next = new Set(prev);
        allFilteredUrls.forEach((u) => next.delete(u));
        return next;
      });
    } else {
      setSelectedUrls((prev) => new Set([...prev, ...allFilteredUrls]));
    }
  }, [filteredEntries, selectedUrls]);

  const getSelectedUrls = useCallback((): string[] => {
    return filteredEntries.filter((e) => selectedUrls.has(e.url)).map((e) => e.url);
  }, [filteredEntries, selectedUrls]);

  const reset = useCallback(() => {
    setFeedUrl('');
    setEntries([]);
    setError(null);
    setSelectedUrls(new Set());
    setDateFilter('all');
  }, []);

  return {
    feedUrl,
    setFeedUrl,
    entries,
    filteredEntries,
    isFetching,
    error,
    dateFilter,
    setDateFilter,
    selectedUrls,
    toggleEntry,
    toggleAll,
    getSelectedUrls,
    fetchFeed,
    reset,
  };
}
