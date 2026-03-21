import { useMemo } from 'react';
import type { Snippet, TagMeta } from '@/types';

export function useTagManager(snippets: Snippet[], tagsMeta: TagMeta[]) {
  const usageCounts = useMemo(() => {
    const counts = new Map<string, number>();
    snippets.forEach((s) => {
      s.tags?.forEach((t) => counts.set(t, (counts.get(t) ?? 0) + 1));
    });
    return counts;
  }, [snippets]);

  /** All unique tag names from snippets, merged with meta that has no snippets yet */
  const allTagNames = useMemo(() => {
    const fromSnippets = new Set(snippets.flatMap((s) => s.tags ?? []));
    const fromMeta = new Set(tagsMeta.map((t) => t.name));
    return Array.from(new Set([...fromSnippets, ...fromMeta])).sort();
  }, [snippets, tagsMeta]);

  const tagMetaMap = useMemo(
    () => new Map(tagsMeta.map((t) => [t.name, t])),
    [tagsMeta],
  );

  const enrichedTags: TagMeta[] = useMemo(
    () =>
      allTagNames.map((name) => tagMetaMap.get(name) ?? { name }),
    [allTagNames, tagMetaMap],
  );

  return { enrichedTags, usageCounts };
}
