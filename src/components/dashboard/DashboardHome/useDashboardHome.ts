/**
 * @module useDashboardHome
 * @description Pure-computation hook for the Dashboard Home page that derives summary statistics: total unique tag count, the five most recent snippets, a folder id-to-name map, and per-folder snippet counts.
 * @dependencies @/types
 * @public useDashboardHome
 */
import { useMemo } from 'react';
import type { Folder, Snippet } from '@/types';

export function useDashboardHome(snippets: Snippet[], folders: Folder[]) {
  const totalTags = useMemo(() => {
    const tagSet = new Set<string>();
    snippets.forEach((s) => s.tags?.forEach((t) => tagSet.add(t)));
    return tagSet.size;
  }, [snippets]);

  const recentSnippets = useMemo(() => snippets.slice(0, 5), [snippets]);

  const folderMap = useMemo(
    () => new Map(folders.map((f) => [f.id, f.name])),
    [folders],
  );

  const snippetsPerFolder = useMemo(() => {
    const counts = new Map<string, number>();
    snippets.forEach((s) => {
      const key = s.folderId ?? '__uncategorized__';
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });
    return counts;
  }, [snippets]);

  const formattedDate = useMemo(
    () =>
      new Intl.DateTimeFormat('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      }).format(new Date()),
    [],
  );

  return {
    totalTags,
    recentSnippets,
    folderMap,
    snippetsPerFolder,
    formattedDate,
  };
}
