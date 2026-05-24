/**
 * @module useFolderExplorer
 * @description React hook that manages view-mode, drag-to-reorder selection, tree-selection, and the move-folder dialog for the FolderExplorer page. Folder create/rename/subfolder UX is owned by FolderNav.
 * @dependencies @/types
 * @public useFolderExplorer, FolderViewMode
 */
import { useCallback, useMemo, useState } from 'react';
import type { Folder, Snippet } from '@/types';

export type FolderViewMode = 'grid' | 'tree';

export function useFolderExplorer(folders: Folder[], snippets: Snippet[]) {
  const [viewMode, setViewMode] = useState<FolderViewMode>('tree');
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [selectedTreeId, setSelectedTreeId] = useState<string | undefined>(undefined);
  const [movingFolderId, setMovingFolderId] = useState<string | null>(null);

  const snippetCountByFolder = useMemo(() => {
    const counts = new Map<string, number>();
    snippets.forEach((s) => {
      if (s.folderId) {
        counts.set(s.folderId, (counts.get(s.folderId) ?? 0) + 1);
      }
    });
    return counts;
  }, [snippets]);

  const sortedFolders = useMemo(
    () =>
      [...folders].sort((a, b) => {
        const orderA = a.sortOrder ?? Infinity;
        const orderB = b.sortOrder ?? Infinity;
        if (orderA !== orderB) return orderA - orderB;
        return a.name.localeCompare(b.name);
      }),
    [folders],
  );

  // ── Move dialog ────────────────────────────────────────────────────────────

  const openMoveDialog = useCallback((id: string) => {
    setMovingFolderId(id);
  }, []);

  const closeMoveDialog = useCallback(() => {
    setMovingFolderId(null);
  }, []);

  // ── Drag-to-reorder (grid view) ────────────────────────────────────────────

  const handleDragStart = useCallback((id: string) => {
    setDraggedId(id);
  }, []);

  const handleDragOver = useCallback((id: string) => {
    setDragOverId(id);
  }, []);

  const handleDragEnd = useCallback(() => {
    setDraggedId(null);
    setDragOverId(null);
  }, []);

  const computeReorder = useCallback(
    (targetId: string): Array<{ id: string; sortOrder: number }> | null => {
      if (!draggedId || draggedId === targetId) return null;
      const dragged = sortedFolders.find((f) => f.id === draggedId);
      if (!dragged) return null;
      const rest = sortedFolders.filter((f) => f.id !== draggedId);
      const targetIdx = rest.findIndex((f) => f.id === targetId);
      rest.splice(targetIdx + 1, 0, dragged);
      return rest.map((f, i) => ({ id: f.id, sortOrder: i }));
    },
    [draggedId, sortedFolders],
  );

  return {
    snippetCountByFolder,
    sortedFolders,
    viewMode,
    setViewMode,
    draggedId,
    dragOverId,
    selectedTreeId,
    setSelectedTreeId,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    computeReorder,
    movingFolderId,
    openMoveDialog,
    closeMoveDialog,
  };
}
