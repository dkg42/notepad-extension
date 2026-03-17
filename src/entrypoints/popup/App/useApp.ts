import { useEffect, useMemo, useState } from 'react';
import type { Folder, Snippet } from '@/types';
import { UNCATEGORIZED_ID } from '@/types';
import { storageService } from '@/services/storage-service';

export function useApp() {
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFolderIds, setSelectedFolderIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    Promise.all([storageService.getAll(), storageService.getFolders()]).then(
      ([loadedSnippets, loadedFolders]) => {
        setSnippets(loadedSnippets);
        setFolders(loadedFolders);
      },
    );
  }, []);

  const hasUncategorized = useMemo(() => snippets.some((s) => !s.folderId), [snippets]);

  const filteredSnippets = useMemo(() => {
    let result = snippets;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((s) => s.text.toLowerCase().includes(q));
    }

    if (selectedFolderIds.size > 0) {
      result = result.filter((s) => {
        const id = s.folderId ?? UNCATEGORIZED_ID;
        return selectedFolderIds.has(id);
      });
    }

    return result;
  }, [snippets, searchQuery, selectedFolderIds]);

  const handleDelete = async (id: string) => {
    await storageService.remove(id);
    setSnippets((prev) => prev.filter((s) => s.id !== id));
  };

  const handleClear = async () => {
    await storageService.clear();
    setSnippets([]);
  };

  const handleCreateFolder = async (name: string) => {
    const folder = await storageService.createFolder(name);
    setFolders((prev) => [...prev, folder]);
  };

  const handleRenameFolder = async (id: string, name: string) => {
    await storageService.renameFolder(id, name);
    setFolders((prev) => prev.map((f) => (f.id === id ? { ...f, name } : f)));
  };

  const handleDeleteFolder = async (id: string) => {
    await storageService.deleteFolder(id);
    setFolders((prev) => prev.filter((f) => f.id !== id));
    setSnippets((prev) =>
      prev.map((s) => (s.folderId === id ? { ...s, folderId: undefined } : s)),
    );
    setSelectedFolderIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  return {
    snippets,
    folders,
    searchQuery,
    setSearchQuery,
    selectedFolderIds,
    setSelectedFolderIds,
    hasUncategorized,
    filteredSnippets,
    handleDelete,
    handleClear,
    handleCreateFolder,
    handleRenameFolder,
    handleDeleteFolder,
  };
}
