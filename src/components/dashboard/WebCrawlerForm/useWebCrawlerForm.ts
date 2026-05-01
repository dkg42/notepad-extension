/**
 * @module useWebCrawlerForm
 * @description React hook that manages web crawler configuration state (seed URL, depth, same-domain constraint, max URLs) and triggers a crawl via the CRAWL_URL background message. Tracks discovered URLs with per-URL selection state and exposes getSelectedUrls for form submission.
 * @dependencies @/types
 * @public useWebCrawlerForm
 */
import { useCallback, useState } from 'react';
import type { CrawlConfig } from '@/types';

export function useWebCrawlerForm() {
  const [seedUrl, setSeedUrl] = useState('');
  const [depth, setDepth] = useState(1);
  const [sameDomainOnly, setSameDomainOnly] = useState(true);
  const [maxUrls, setMaxUrls] = useState(50);
  const [discoveredUrls, setDiscoveredUrls] = useState<string[]>([]);
  const [selectedUrls, setSelectedUrls] = useState<Set<string>>(new Set());
  const [isCrawling, setIsCrawling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startCrawl = useCallback(async () => {
    if (!seedUrl.trim()) return;
    setIsCrawling(true);
    setError(null);
    setDiscoveredUrls([]);
    setSelectedUrls(new Set());

    try {
      const config: CrawlConfig = {
        seedUrl: seedUrl.trim(),
        depth,
        sameDomainOnly,
        maxUrls,
      };
      const result = await chrome.runtime.sendMessage({
        type: 'CRAWL_URL',
        config,
      }) as { ok: boolean; urls?: string[]; error?: string };

      if (!result?.ok || !result.urls) {
        setError(result?.error ?? 'Crawl failed');
        return;
      }

      setDiscoveredUrls(result.urls);
      setSelectedUrls(new Set(result.urls));
    } catch {
      setError('Failed to reach the extension background.');
    } finally {
      setIsCrawling(false);
    }
  }, [seedUrl, depth, sameDomainOnly, maxUrls]);

  const toggleUrl = useCallback((url: string) => {
    setSelectedUrls((prev) => {
      const next = new Set(prev);
      if (next.has(url)) next.delete(url);
      else next.add(url);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    const allSelected = discoveredUrls.every((u) => selectedUrls.has(u));
    if (allSelected) {
      setSelectedUrls(new Set());
    } else {
      setSelectedUrls(new Set(discoveredUrls));
    }
  }, [discoveredUrls, selectedUrls]);

  const getSelectedUrls = useCallback((): string[] => {
    return discoveredUrls.filter((u) => selectedUrls.has(u));
  }, [discoveredUrls, selectedUrls]);

  const reset = useCallback(() => {
    setSeedUrl('');
    setDepth(1);
    setSameDomainOnly(true);
    setMaxUrls(50);
    setDiscoveredUrls([]);
    setSelectedUrls(new Set());
    setError(null);
  }, []);

  return {
    seedUrl,
    setSeedUrl,
    depth,
    setDepth,
    sameDomainOnly,
    setSameDomainOnly,
    maxUrls,
    setMaxUrls,
    discoveredUrls,
    selectedUrls,
    isCrawling,
    error,
    startCrawl,
    toggleUrl,
    toggleAll,
    getSelectedUrls,
    reset,
  };
}
