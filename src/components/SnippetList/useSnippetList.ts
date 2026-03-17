import type { Folder } from '@/types';

export function buildFolderMap(folders: Folder[]): Map<string, string> {
  return new Map(folders.map((f) => [f.id, f.name]));
}