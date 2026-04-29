import type { Folder, Snippet } from '@/types';
import { UNCATEGORIZED_ID } from '@/types';
import { getFolderDescendantIds } from '@/utils/folder-utils';

/**
 * Filters snippets by search query, selected folder IDs, and selected tags.
 * When folders are provided, selecting a folder also includes snippets from
 * all its descendant folders. Shared by both the popup and the dashboard.
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
    result = result.filter((s) => s.text.toLowerCase().includes(q));
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
