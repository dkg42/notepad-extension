/**
 * @module useFolderManager
 * @description Hook that manages UI state for creating, renaming, and creating subfolders — exposes form values, error messages, and action handlers consumed by FolderManager.
 * @dependencies (none beyond React useState)
 * @public useFolderManager
 */
import { useState } from 'react';
import type { Folder } from '@/types';

interface Handlers {
  onCreateFolder: (name: string, parentId?: string) => Promise<void>;
  onRenameFolder: (id: string, name: string) => Promise<void>;
  onDeleteFolder: (id: string) => Promise<void>;
}

export function useFolderManager({ onCreateFolder, onRenameFolder }: Handlers) {
  const [isOpen, setIsOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editError, setEditError] = useState<string | null>(null);

  // Subfolder creation: tracks which folder is getting a child
  const [subfolderParentId, setSubfolderParentId] = useState<string | null>(null);
  const [subfolderName, setSubfolderName] = useState('');
  const [subfolderError, setSubfolderError] = useState<string | null>(null);

  const handleNewNameChange = (name: string) => {
    setNewName(name);
    setCreateError(null);
  };

  const handleEditNameChange = (name: string) => {
    setEditName(name);
    setEditError(null);
  };

  const handleCreate = async () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    try {
      await onCreateFolder(trimmed);
      setNewName('');
      setCreateError(null);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create folder.');
    }
  };

  const handleRename = async (id: string) => {
    const trimmed = editName.trim();
    if (!trimmed) return;
    try {
      await onRenameFolder(id, trimmed);
      setEditingId(null);
      setEditName('');
      setEditError(null);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Failed to rename folder.');
    }
  };

  const startEdit = (folder: Folder) => {
    setEditingId(folder.id);
    setEditName(folder.name);
    setEditError(null);
    // Cancel any open subfolder form
    setSubfolderParentId(null);
    setSubfolderName('');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName('');
    setEditError(null);
  };

  const startCreatingSubfolder = (parentId: string) => {
    setSubfolderParentId(parentId);
    setSubfolderName('');
    setSubfolderError(null);
    // Cancel any open rename form
    setEditingId(null);
    setEditName('');
  };

  const cancelSubfolder = () => {
    setSubfolderParentId(null);
    setSubfolderName('');
    setSubfolderError(null);
  };

  const handleCreateSubfolder = async () => {
    if (!subfolderParentId) return;
    const trimmed = subfolderName.trim();
    if (!trimmed) return;
    try {
      await onCreateFolder(trimmed, subfolderParentId);
      setSubfolderParentId(null);
      setSubfolderName('');
      setSubfolderError(null);
    } catch (err) {
      setSubfolderError(err instanceof Error ? err.message : 'Failed to create subfolder.');
    }
  };

  return {
    isOpen,
    setIsOpen,
    newName,
    createError,
    editingId,
    editName,
    editError,
    subfolderParentId,
    subfolderName,
    subfolderError,
    handleNewNameChange,
    handleEditNameChange,
    handleCreate,
    handleRename,
    startEdit,
    cancelEdit,
    startCreatingSubfolder,
    cancelSubfolder,
    setSubfolderName,
    setSubfolderError,
    handleCreateSubfolder,
  };
}
