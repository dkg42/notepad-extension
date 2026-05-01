/**
 * @module useFolderExplorer
 * @description React hook that manages all UI interaction state for the FolderExplorer component, including grid/tree view mode, drag-to-reorder, inline subfolder creation, inline renaming, and the move-folder dialog. Derives sorted folders and per-folder snippet counts via memoization.
 * @dependencies @/types
 * @public useFolderExplorer, FolderViewMode
 */
import { useCallback, useMemo, useState } from 'react';
import type { Folder, Snippet } from '@/types';

export type FolderViewMode = 'grid' | 'tree';

export function useFolderExplorer(folders: Folder[], snippets: Snippet[]) {
  const [newFolderName, setNewFolderName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [viewMode, setViewMode] = useState<FolderViewMode>('tree');
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [selectedTreeId, setSelectedTreeId] = useState<string | undefined>(undefined);

  // State for inline subfolder creation in tree view
  const [creatingSubfolderParentId, setCreatingSubfolderParentId] = useState<string | null>(null);
  const [newSubfolderName, setNewSubfolderName] = useState('');
  const [subfolderError, setSubfolderError] = useState('');

  // State for inline rename in tree view
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  // State for move dialog
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

  const clearError = () => setErrorMessage('');

  // ── Subfolder creation ─────────────────────────────────────────────────────

  const startCreatingSubfolder = useCallback((parentId: string) => {
    setCreatingSubfolderParentId(parentId);
    setNewSubfolderName('');
    setSubfolderError('');
  }, []);

  const cancelCreatingSubfolder = useCallback(() => {
    setCreatingSubfolderParentId(null);
    setNewSubfolderName('');
    setSubfolderError('');
  }, []);

  // ── Rename (tree view inline) ──────────────────────────────────────────────

  const startRenaming = useCallback((id: string, currentName: string) => {
    setRenamingFolderId(id);
    setRenameValue(currentName);
  }, []);

  const cancelRenaming = useCallback(() => {
    setRenamingFolderId(null);
    setRenameValue('');
  }, []);

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
    // Subfolder creation
    creatingSubfolderParentId,
    newSubfolderName,
    setNewSubfolderName,
    subfolderError,
    setSubfolderError,
    startCreatingSubfolder,
    cancelCreatingSubfolder,
    // Rename
    renamingFolderId,
    renameValue,
    setRenameValue,
    startRenaming,
    cancelRenaming,
    // Move dialog
    movingFolderId,
    openMoveDialog,
    closeMoveDialog,
  };
}
