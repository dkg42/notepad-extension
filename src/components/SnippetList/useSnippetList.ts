/**
 * @module useSnippetList
 * @description Utility that builds a lookup map from folder ID to its full display path for use in snippet list rendering.
 * @dependencies @/types, @/utils/folder-utils
 * @public buildFolderMap
 */
import type { Folder } from '@/types';
import { getFolderPath } from '@/utils/folder-utils';

/** Returns a map from folder ID to its full display path (e.g. "Work / Projects / AI"). */
export function buildFolderMap(folders: Folder[]): Map<string, string> {
  return new Map(folders.map((f) => [f.id, getFolderPath(f.id, folders)]));
}
