/**
 * @module folder-utils
 * @description Pure utility functions for traversing and displaying the nested folder hierarchy. All functions are side-effect-free and operate solely on the Folder[] array from storage, making them safe to use in both the popup and dashboard without coupling to any React or storage context.
 * @dependencies @/types
 * @public getFolderDescendantIds, getFolderSubtreeIds, getFolderPath, getFolderTreeItems
 */
import type { Folder } from '@/types';

/**
 * Returns all descendant folder IDs for the given folder via BFS, excluding the folder itself.
 * @param folderId - The root folder whose descendants are collected.
 * @param folders - The full flat list of all folders.
 * @returns A Set of descendant folder IDs (does not include `folderId`).
 */
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

/**
 * Returns all descendant folder IDs for the given folder, including the folder itself.
 * @param folderId - The root folder whose subtree is collected.
 * @param folders - The full flat list of all folders.
 * @returns A Set containing `folderId` and all its descendant IDs.
 */
export function getFolderSubtreeIds(folderId: string, folders: Folder[]): Set<string> {
  const result = getFolderDescendantIds(folderId, folders);
  result.add(folderId);
  return result;
}

/**
 * Builds the full display path for a folder by walking up through ancestors, e.g. `"Work / Projects / AI"`.
 * @param folderId - The ID of the folder whose path is resolved.
 * @param folders - The full flat list of all folders.
 * @returns A slash-separated string of ancestor and folder names, or an empty string if not found.
 */
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
 * Returns all folders in depth-first tree order with their nesting depth, sorted by `sortOrder` then name.
 * Useful for rendering indented flat lists such as folder filter dropdowns.
 * @param folders - The full flat list of all folders.
 * @returns An array of `{ folder, depth }` objects in DFS order, where `depth` starts at 0 for root folders.
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
