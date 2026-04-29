import type { Folder } from '@/types';

/** All descendant folder IDs (NOT including self). BFS traversal. */
export function getFolderDescendantIds(folderId: string, folders: Folder[]): Set<string> {
  const result = new Set<string>();
  const queue = [folderId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const f of folders) {
      if (f.parentId === current) {
        result.add(f.id);
        queue.push(f.id);
      }
    }
  }
  return result;
}

/** All descendant folder IDs INCLUDING self. */
export function getFolderSubtreeIds(folderId: string, folders: Folder[]): Set<string> {
  const result = getFolderDescendantIds(folderId, folders);
  result.add(folderId);
  return result;
}

/** Full display path, e.g. "Work / Projects / AI" */
export function getFolderPath(folderId: string, folders: Folder[]): string {
  const folderMap = new Map(folders.map((f) => [f.id, f]));
  const parts: string[] = [];
  let current = folderMap.get(folderId);
  while (current) {
    parts.unshift(current.name);
    current = current.parentId ? folderMap.get(current.parentId) : undefined;
  }
  return parts.join(' / ');
}

/**
 * Returns all folders in depth-first tree order with their nesting depth.
 * Useful for rendering indented flat lists (e.g. filter dropdowns).
 */
export function getFolderTreeItems(folders: Folder[]): Array<{ folder: Folder; depth: number }> {
  const result: Array<{ folder: Folder; depth: number }> = [];

  function traverse(parentId: string | undefined, depth: number) {
    const children = folders
      .filter((f) => f.parentId === parentId)
      .sort((a, b) => {
        const orderA = a.sortOrder ?? Infinity;
        const orderB = b.sortOrder ?? Infinity;
        if (orderA !== orderB) return orderA - orderB;
        return a.name.localeCompare(b.name);
      });
    for (const folder of children) {
      result.push({ folder, depth });
      traverse(folder.id, depth + 1);
    }
  }

  traverse(undefined, 0);
  return result;
}
