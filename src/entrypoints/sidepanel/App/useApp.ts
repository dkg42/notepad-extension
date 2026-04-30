import { useEffect, useMemo, useState } from 'react';
import type { Folder, Snippet } from '@/types';
import { storageService } from '@/services/storage-service';
import { filterSnippets } from '@/utils/filter-snippets';
import { getFolderSubtreeIds } from '@/utils/folder-utils';

export function useApp() {
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFolderIds, setSelectedFolderIds] = useState<Set<string>>(new Set());
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());

  useEffect(() => {
    Promise.all([storageService.getAll(), storageService.getFolders()]).then(
      ([loadedSnippets, loadedFolders]) => {
        setSnippets(loadedSnippets);
        setFolders(loadedFolders);
      },
    );
  }, []);

  const hasUncategorized = useMemo(() => snippets.some((s) => !s.folderId), [snippets]);

  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    snippets.forEach((s) => s.tags?.forEach((t) => tagSet.add(t)));
    return Array.from(tagSet).sort();
  }, [snippets]);

  const filteredSnippets = useMemo(
    () => filterSnippets(snippets, searchQuery, selectedFolderIds, selectedTags, folders),
    [snippets, searchQuery, selectedFolderIds, selectedTags, folders],
  );

  const handleDelete = async (id: string) => {
    await storageService.remove(id);
    setSnippets((prev) => prev.filter((s) => s.id !== id));
  };

  const handleClear = async () => {
    await storageService.clear();
    setSnippets([]);
  };

  const handleUpdateTags = async (snippetId: string, tags: string[]) => {
    await storageService.updateTags(snippetId, tags);
    setSnippets((prev) =>
      prev.map((s) => (s.id === snippetId ? { ...s, tags } : s)),
    );
  };

  const handleCreateFolder = async (name: string, parentId?: string) => {
    const folder = await storageService.createFolder(name, parentId);
    setFolders((prev) => [...prev, folder]);
  };

  const handleRenameFolder = async (id: string, name: string) => {
    await storageService.renameFolder(id, name);
    setFolders((prev) => prev.map((f) => (f.id === id ? { ...f, name } : f)));
  };

  const handleDeleteFolder = async (id: string) => {
    const subtreeIds = getFolderSubtreeIds(id, folders);
    await storageService.deleteFolder(id);
    setFolders((prev) => prev.filter((f) => !subtreeIds.has(f.id)));
    setSnippets((prev) => prev.filter((s) => !s.folderId || !subtreeIds.has(s.folderId)));
    setSelectedFolderIds((prev) => {
      const next = new Set(prev);
      subtreeIds.forEach((sid) => next.delete(sid));
      return next;
    });
  };

  const handleToggleFavorite = async (id: string) => {
    await storageService.toggleFavorite(id);
    setSnippets((prev) =>
      prev.map((s) => (s.id === id ? { ...s, isFavorite: !s.isFavorite } : s)),
    );
  };

  const handleAddSnippet = async (
    title: string,
    text: string,
    tags: string[],
    folderId?: string,
  ) => {
    const snippet = await storageService.saveWithMeta({ title, text, tags, folderId });
    setSnippets((prev) => [snippet, ...prev]);
  };

  return {
    snippets,
    folders,
    allTags,
    searchQuery,
    setSearchQuery,
    selectedFolderIds,
    setSelectedFolderIds,
    selectedTags,
    setSelectedTags,
    hasUncategorized,
    filteredSnippets,
    handleDelete,
    handleClear,
    handleUpdateTags,
    handleCreateFolder,
    handleRenameFolder,
    handleDeleteFolder,
    handleToggleFavorite,
    handleAddSnippet,
  };
}