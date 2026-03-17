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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const handleCreate = async () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    await onCreateFolder(trimmed);
    setNewName('');
  };

  const handleRename = async (id: string) => {
    const trimmed = editName.trim();
    if (!trimmed) return;
    await onRenameFolder(id, trimmed);
    setEditingId(null);
    setEditName('');
  };

  const startEdit = (folder: Folder) => {
    setEditingId(folder.id);
    setEditName(folder.name);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName('');
  };

  return {
    isOpen,
    setIsOpen,
    newName,
    setNewName,
    editingId,
    editName,
    setEditName,
    handleCreate,
    handleRename,
    startEdit,
    cancelEdit,
  };
}
