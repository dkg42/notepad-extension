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

  return {
    totalTags,
    recentSnippets,
    folderMap,
    snippetsPerFolder,
  };
}
