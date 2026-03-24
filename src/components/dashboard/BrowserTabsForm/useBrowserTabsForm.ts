import { useCallback, useEffect, useState } from 'react';
import type { BrowserTab } from '@/types';

export function useBrowserTabsForm() {
  const [tabs, setTabs] = useState<BrowserTab[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedUrls, setSelectedUrls] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    void loadTabs();
  }, []);

  const loadTabs = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await chrome.runtime.sendMessage({
        type: 'GET_BROWSER_TABS',
      }) as { ok: boolean; tabs?: BrowserTab[]; error?: string };

      if (!result?.ok || !result.tabs) {
        setError(result?.error ?? 'Failed to get browser tabs');
        return;
      }

      setTabs(result.tabs);
      setSelectedUrls(new Set(result.tabs.map((t) => t.url)));
    } catch {
      setError('Failed to reach the extension background.');
    } finally {
      setIsLoading(false);
    }
  };

  const filteredTabs = tabs.filter((tab) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      tab.title.toLowerCase().includes(query) ||
      tab.url.toLowerCase().includes(query)
    );
  });

  const toggleTab = useCallback((url: string) => {
    setSelectedUrls((prev) => {
      const next = new Set(prev);
      if (next.has(url)) next.delete(url);
      else next.add(url);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    const allFilteredUrls = filteredTabs.map((t) => t.url);
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
  }, [filteredTabs, selectedUrls]);

  const getSelectedUrls = useCallback((): string[] => {
    return filteredTabs.filter((t) => selectedUrls.has(t.url)).map((t) => t.url);
  }, [filteredTabs, selectedUrls]);

  return {
    tabs,
    filteredTabs,
    isLoading,
    error,
    selectedUrls,
    searchQuery,
    setSearchQuery,
    toggleTab,
    toggleAll,
    getSelectedUrls,
    refresh: loadTabs,
  };
}
