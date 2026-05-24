/**
 * @module useFolderNav
 * @description Shared state + handlers for folder create / rename / subfolder UX. Used by every surface that manages folders (NotebooksPage, FolderExplorer, PromptsPage, PromptHubView).
 * @public useFolderNav
 */
import { useCallback, useState } from 'react';

interface Handlers {
  onCreateFolder?: (name: string, parentId?: string) => Promise<unknown> | unknown;
  onRenameFolder?: (id: string, name: string) => Promise<unknown> | unknown;
}

export function useFolderNav({ onCreateFolder, onRenameFolder }: Handlers) {
  const [isCreatingRoot, setIsCreatingRoot] = useState(false);
  const [newRootName, setNewRootName] = useState('');
  const [rootError, setRootError] = useState('');

  const [creatingSubParentId, setCreatingSubParentId] = useState<string | null>(null);
  const [newSubName, setNewSubName] = useState('');
  const [subError, setSubError] = useState('');

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [renameError, setRenameError] = useState('');

  const cancelAll = useCallback(() => {
    setIsCreatingRoot(false);
    setNewRootName('');
    setRootError('');
    setCreatingSubParentId(null);
    setNewSubName('');
    setSubError('');
    setRenamingId(null);
    setRenameValue('');
    setRenameError('');
  }, []);

  const startCreatingRoot = useCallback(() => {
    setIsCreatingRoot(true);
    setNewRootName('');
    setRootError('');
    setCreatingSubParentId(null);
    setRenamingId(null);
  }, []);

  const cancelCreatingRoot = useCallback(() => {
    setIsCreatingRoot(false);
    setNewRootName('');
    setRootError('');
  }, []);

  const confirmCreateRoot = useCallback(async () => {
    if (!onCreateFolder) return;
    const name = newRootName.trim();
    if (!name) return;
    try {
      await onCreateFolder(name);
      setIsCreatingRoot(false);
      setNewRootName('');
      setRootError('');
    } catch (err) {
      setRootError(err instanceof Error ? err.message : 'Failed to create folder.');
    }
  }, [onCreateFolder, newRootName]);

  const startCreatingSubfolder = useCallback((parentId: string) => {
    setCreatingSubParentId(parentId);
    setNewSubName('');
    setSubError('');
    setIsCreatingRoot(false);
    setRenamingId(null);
  }, []);

  const cancelCreatingSubfolder = useCallback(() => {
    setCreatingSubParentId(null);
    setNewSubName('');
    setSubError('');
  }, []);

  const confirmCreateSubfolder = useCallback(async () => {
    if (!onCreateFolder || !creatingSubParentId) return;
    const name = newSubName.trim();
    if (!name) return;
    try {
      await onCreateFolder(name, creatingSubParentId);
      setCreatingSubParentId(null);
      setNewSubName('');
      setSubError('');
    } catch (err) {
      setSubError(err instanceof Error ? err.message : 'Failed to create subfolder.');
    }
  }, [onCreateFolder, creatingSubParentId, newSubName]);

  const startRenaming = useCallback((id: string, currentName: string) => {
    setRenamingId(id);
    setRenameValue(currentName);
    setRenameError('');
    setCreatingSubParentId(null);
    setIsCreatingRoot(false);
  }, []);

  const cancelRenaming = useCallback(() => {
    setRenamingId(null);
    setRenameValue('');
    setRenameError('');
  }, []);

  const confirmRename = useCallback(async () => {
    if (!onRenameFolder || !renamingId) return;
    const name = renameValue.trim();
    if (!name) return;
    try {
      await onRenameFolder(renamingId, name);
      setRenamingId(null);
      setRenameValue('');
      setRenameError('');
    } catch (err) {
      setRenameError(err instanceof Error ? err.message : 'Failed to rename folder.');
    }
  }, [onRenameFolder, renamingId, renameValue]);

  return {
    // root creation
    isCreatingRoot,
    newRootName,
    setNewRootName,
    rootError,
    setRootError,
    startCreatingRoot,
    cancelCreatingRoot,
    confirmCreateRoot,
    // subfolder creation
    creatingSubParentId,
    newSubName,
    setNewSubName,
    subError,
    setSubError,
    startCreatingSubfolder,
    cancelCreatingSubfolder,
    confirmCreateSubfolder,
    // rename
    renamingId,
    renameValue,
    setRenameValue,
    renameError,
    setRenameError,
    startRenaming,
    cancelRenaming,
    confirmRename,
    cancelAll,
  };
}
