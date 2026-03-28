import { useMemo } from 'react';
import type { NotebookAnnotation, Snippet, TagMeta } from '@/types';

export function useTagManager(
  snippets: Snippet[],
  tagsMeta: TagMeta[],
  notebookAnnotations: NotebookAnnotation[],
) {
  const usageCounts = useMemo(() => {
    const counts = new Map<string, number>();
    snippets.forEach((s) => {
      s.tags?.forEach((t) => counts.set(t, (counts.get(t) ?? 0) + 1));
    });
    notebookAnnotations.forEach((a) => {
      a.tags.forEach((t) => counts.set(t, (counts.get(t) ?? 0) + 1));
    });
    return counts;
  }, [snippets, notebookAnnotations]);

  /** All unique tag names from snippets, notebook annotations, and meta */
  const allTagNames = useMemo(() => {
    const fromSnippets = new Set(snippets.flatMap((s) => s.tags ?? []));
    const fromAnnotations = new Set(notebookAnnotations.flatMap((a) => a.tags));
    const fromMeta = new Set(tagsMeta.map((t) => t.name));
    return Array.from(new Set([...fromSnippets, ...fromAnnotations, ...fromMeta])).sort();
  }, [snippets, notebookAnnotations, tagsMeta]);

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
