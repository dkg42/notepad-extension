import { useCallback, useMemo, useState } from 'react';
import type { Folder, Snippet } from '@/types';

export type FolderViewMode = 'grid' | 'tree';

export function useFolderExplorer(folders: Folder[], snippets: Snippet[]) {
  const [newFolderName, setNewFolderName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [viewMode, setViewMode] = useState<FolderViewMode>('grid');
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [selectedTreeId, setSelectedTreeId] = useState<string | undefined>(undefined);

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

  const clearError = () => setErrorMessage('');

  // ── Drag-to-reorder ────────────────────────────────────────────────────────

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

  /**
   * Computes the new sortOrder assignments after dragging `draggedId` to
   * drop on top of `targetId` (insert after target in the sorted list).
   */
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
    newFolderName,
    setNewFolderName,
    isCreating,
    setIsCreating,
    errorMessage,
    setErrorMessage,
    clearError,
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
  };
}
