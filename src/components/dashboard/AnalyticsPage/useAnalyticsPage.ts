/**
 * @module useAnalyticsPage
 * @description Pure-computation hook that derives chart datasets from snippet and folder data: saves by source hostname, by folder, by tag, and by calendar month (last 8 months). All data is memoized; no side effects or network calls are made.
 * @dependencies @/types, @/components/dashboard/StatChart/StatChart
 * @public useAnalyticsPage
 */
import { useMemo } from 'react';
import type { Folder, Snippet } from '@/types';
import type { StatChartEntry } from '@/components/dashboard/StatChart/StatChart';

function extractHostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function getMonthLabel(ts: number): string {
  return new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric' }).format(
    new Date(ts),
  );
}

export function useAnalyticsPage(snippets: Snippet[], folders: Folder[]) {
  const folderMap = useMemo(
    () => new Map(folders.map((f) => [f.id, f.name])),
    [folders],
  );

  const bySource: StatChartEntry[] = useMemo(() => {
    const counts = new Map<string, number>();
    snippets.forEach((s) => {
      const host = extractHostname(s.source);
      counts.set(host, (counts.get(host) ?? 0) + 1);
    });
    return Array.from(counts.entries())
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);
  }, [snippets]);

  const byFolder: StatChartEntry[] = useMemo(() => {
    const counts = new Map<string, number>();
    snippets.forEach((s) => {
      const key = s.folderId ? (folderMap.get(s.folderId) ?? s.folderId) : 'Uncategorised';
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });
    return Array.from(counts.entries())
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);
  }, [snippets, folderMap]);

  const byTag: StatChartEntry[] = useMemo(() => {
    const counts = new Map<string, number>();
    snippets.forEach((s) => {
      s.tags?.forEach((t) => counts.set(t, (counts.get(t) ?? 0) + 1));
    });
    return Array.from(counts.entries())
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);
  }, [snippets]);

  const byMonth: StatChartEntry[] = useMemo(() => {
    const counts = new Map<string, number>();
    snippets.forEach((s) => {
      const label = getMonthLabel(s.savedAt);
      counts.set(label, (counts.get(label) ?? 0) + 1);
    });
    // Sort chronologically
    return Array.from(counts.entries())
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => {
        const dateA = new Date(a.label);
        const dateB = new Date(b.label);
        return dateA.getTime() - dateB.getTime();
      })
      .slice(-8);
  }, [snippets]);

  return { bySource, byFolder, byTag, byMonth };
}
