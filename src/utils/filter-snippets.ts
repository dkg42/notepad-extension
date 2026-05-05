/**
 * @module filter-snippets
 * @description Provides the single shared snippet-filtering function used by both the popup and the dashboard to ensure consistent search, folder, and tag filtering behaviour. Selecting a folder automatically expands the filter to include all descendant folders via getFolderDescendantIds.
 * @dependencies @/types, @/utils/folder-utils
 * @public filterSnippets
 */
import type { Folder, Snippet } from '@/types';
import { UNCATEGORIZED_ID } from '@/types';
import { getFolderDescendantIds } from '@/utils/folder-utils';

/**
 * Filters snippets by full-text search (against `snippet.text`), selected folder IDs, and selected tags.
 * Folder selection is automatically expanded to include all descendant folders via BFS.
 * Shared by both the popup and the dashboard to ensure consistent filtering behaviour.
 * @param snippets - The full list of snippets to filter.
 * @param searchQuery - Case-insensitive substring matched against each snippet's text.
 * @param selectedFolderIds - Set of folder IDs to include; pass an empty Set to skip folder filtering.
 * @param selectedTags - Set of tag strings; a snippet matches if it has at least one of these tags.
 * @param folders - The full flat folder list, required for descendant expansion (defaults to `[]`).
 * @returns The filtered subset of `snippets` matching all active criteria.
 */
export function filterSnippets(
  snippets: Snippet[],
  searchQuery: string,
  selectedFolderIds: Set<string>,
  selectedTags: Set<string>,
  folders: Folder[] = [],
): Snippet[] {
  let result = snippets;

  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase();
    result = result.filter(
      (s) =>
        s.text.toLowerCase().includes(q) ||
        (s.title?.toLowerCase().includes(q) ?? false),
    );
  }

  if (selectedFolderIds.size > 0) {
    // Expand each selected folder to include all its descendants
    const expandedIds = new Set(selectedFolderIds);
    for (const fid of selectedFolderIds) {
      if (fid !== UNCATEGORIZED_ID) {
        getFolderDescendantIds(fid, folders).forEach((id) => expandedIds.add(id));
      }
    }
    result = result.filter((s) => {
      const id = s.folderId ?? UNCATEGORIZED_ID;
      return expandedIds.has(id);
    });
  }

  if (selectedTags.size > 0) {
    result = result.filter((s) => s.tags?.some((t) => selectedTags.has(t)));
  }

  return result;
}
