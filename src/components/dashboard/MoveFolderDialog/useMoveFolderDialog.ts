/**
 * @module useMoveFolderDialog
 * @description React hook that tracks the destination selection for the MoveFolderDialog. Computes the set of disabled destination IDs (the folder being moved and all its descendants) to prevent invalid circular moves.
 * @dependencies @/types, @/utils/folder-utils
 * @public useMoveFolderDialog
 */
import { useMemo, useState } from 'react';
import type { Folder } from '@/types';
import { getFolderSubtreeIds } from '@/utils/folder-utils';

export function useMoveFolderDialog(folderId: string, folders: Folder[]) {
  // undefined = move to root, string = move to that folder ID
  const [selectedDestId, setSelectedDestId] = useState<string | undefined>(undefined);

  /** IDs that cannot be chosen as a destination (the folder itself + all descendants). */
  const disabledIds = useMemo(
    () => getFolderSubtreeIds(folderId, folders),
    [folderId, folders],
  );

  return { selectedDestId, setSelectedDestId, disabledIds };
}
