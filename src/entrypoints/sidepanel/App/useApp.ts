/**
 * @module useApp
 * @description Root React hook for the sidepanel entrypoint that loads snippets and folders from local storage on mount and keeps them in sync via chrome.storage.onChanged. Exposes search, folder, and tag filter state alongside handlers for all snippet and folder CRUD operations.
 * @dependencies @/types, @/services/storage-service, @/utils/filter-snippets, @/utils/folder-utils
 * @public useApp
 */
import { useEffect, useMemo, useState } from 'react';
import type { Folder, Snippet } from '@/types';
import { storageService } from '@/services/storage-service';
import { usageLimitService } from '@/services/usage-limit-service';
import { filterSnippets } from '@/utils/filter-snippets';
import { getFolderSubtreeIds } from '@/utils/folder-utils';
import { scopedStorage } from '@/services/storage/scoped-storage';

export function useApp(isPro: boolean) {
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

    return scopedStorage.onChanged<Snippet[]>('snippets', (changes) => {
      setSnippets(changes.snippets?.newValue ?? []);
    });
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

  const handleMoveToFolder = async (id: string, folderId: string | undefined) => {
    await storageService.moveToFolder(id, folderId);
    setSnippets((prev) => prev.map((s) => s.id === id ? { ...s, folderId } : s));
  };

  const handleAddSnippet = async (
    title: string,
    text: string,
    tags: string[],
    folderId?: string,
  ) => {
    if (!(await usageLimitService.canCreate('prompt_hub', isPro))) return;
    await storageService.saveWithMeta({ title, text, tags, folderId });
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
    handleMoveToFolder,
  };
}