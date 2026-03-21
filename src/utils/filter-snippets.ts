import type { Snippet } from '@/types';
import { UNCATEGORIZED_ID } from '@/types';

/**
 * Filters snippets by search query, selected folder IDs, and selected tags.
 * Shared by both the popup and the dashboard.
 */
export function filterSnippets(
  snippets: Snippet[],
  searchQuery: string,
  selectedFolderIds: Set<string>,
  selectedTags: Set<string>,
): Snippet[] {
  let result = snippets;

  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase();
    result = result.filter((s) => s.text.toLowerCase().includes(q));
  }

  if (selectedFolderIds.size > 0) {
    result = result.filter((s) => {
      const id = s.folderId ?? UNCATEGORIZED_ID;
      return selectedFolderIds.has(id);
    });
  }

  if (selectedTags.size > 0) {
    result = result.filter((s) => s.tags?.some((t) => selectedTags.has(t)));
  }

  return result;
}
