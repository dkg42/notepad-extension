import { useState } from 'react';
import type { Folder } from '@/types';

interface Handlers {
  onCreateFolder: (name: string) => Promise<void>;
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
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName('');
    setEditError(null);
  };

  return {
    isOpen,
    setIsOpen,
    newName,
    createError,
    editingId,
    editName,
    editError,
    handleNewNameChange,
    handleEditNameChange,
    handleCreate,
    handleRename,
    startEdit,
    cancelEdit,
  };
}
