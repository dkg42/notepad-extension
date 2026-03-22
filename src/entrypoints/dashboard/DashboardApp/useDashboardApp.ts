import { useEffect, useMemo, useState } from 'react';
import type { Folder, NotebookMeta, Snippet, TagMeta } from '@/types';
import type { DashboardSettings, DashboardView } from '@/types/dashboard';
import { storageService } from '@/services/storage-service';
import { notebookSyncService } from '@/services/notebook-sync-service';

const DEFAULT_SETTINGS: DashboardSettings = {
  theme: 'light',
  rowsPerPage: 25,
  defaultSortColumn: 'savedAt',
  defaultSortDirection: 'desc',
};

export function useDashboardApp() {
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [tagsMeta, setTagsMeta] = useState<TagMeta[]>([]);
  const [settings, setSettings] = useState<DashboardSettings>(DEFAULT_SETTINGS);
  const [currentView, setCurrentView] = useState<DashboardView>('home');
  const [isLoading, setIsLoading] = useState(true);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [notebooksCount, setNotebooksCount] = useState(0);

  useEffect(() => {
    Promise.all([
      storageService.getAll(),
      storageService.getFolders(),
      storageService.getTagsMeta(),
      storageService.getSettings(),
      notebookSyncService.getAll(),
    ])
      .then(([loadedSnippets, loadedFolders, loadedTagsMeta, loadedSettings, loadedNotebooks]) => {
        setSnippets(loadedSnippets);
        setFolders(loadedFolders);
        setTagsMeta(loadedTagsMeta);
        setSettings(loadedSettings);
        setNotebooksCount(loadedNotebooks.length);
      })
      .finally(() => setIsLoading(false));
  }, []);

  // Update notebooks count when sync storage changes
  useEffect(() => {
    const listener = (changes: Record<string, chrome.storage.StorageChange>) => {
      if ('notebooksMeta' in changes) {
        const updated = (changes.notebooksMeta.newValue as NotebookMeta[]) ?? [];
        setNotebooksCount(updated.length);
      }
    };
    chrome.storage.sync.onChanged.addListener(listener);
    return () => chrome.storage.sync.onChanged.removeListener(listener);
  }, []);

  const favoritesCount = useMemo(
    () => snippets.filter((s) => s.isFavorite).length,
    [snippets],
  );

  // ── Single snippet operations ─────────────────────────────────────────────

  const handleDelete = async (id: string) => {
    await storageService.remove(id);
    setSnippets((prev) => prev.filter((s) => s.id !== id));
  };

  const handleUpdateTags = async (snippetId: string, tags: string[]) => {
    await storageService.updateTags(snippetId, tags);
    setSnippets((prev) => prev.map((s) => (s.id === snippetId ? { ...s, tags } : s)));
  };

  const handleToggleFavorite = async (id: string) => {
    await storageService.toggleFavorite(id);
    setSnippets((prev) =>
      prev.map((s) => (s.id === id ? { ...s, isFavorite: !s.isFavorite } : s)),
    );
  };

  // ── Bulk operations ───────────────────────────────────────────────────────

  const handleBulkDelete = async (ids: string[]) => {
    await storageService.bulkDelete(ids);
    const idSet = new Set(ids);
    setSnippets((prev) => prev.filter((s) => !idSet.has(s.id)));
  };

  const handleBulkMoveToFolder = async (ids: string[], folderId: string | undefined) => {
    await storageService.bulkMoveToFolder(ids, folderId);
    const idSet = new Set(ids);
    setSnippets((prev) =>
      prev.map((s) => (idSet.has(s.id) ? { ...s, folderId } : s)),
    );
  };

  const handleBulkAddTags = async (ids: string[], tags: string[]) => {
    await storageService.bulkAddTags(ids, tags);
    const idSet = new Set(ids);
    setSnippets((prev) =>
      prev.map((s) => {
        if (!idSet.has(s.id)) return s;
        const merged = Array.from(new Set([...(s.tags ?? []), ...tags]));
        return { ...s, tags: merged };
      }),
    );
  };

  // ── Folder operations ─────────────────────────────────────────────────────

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
    setSnippets((prev) => prev.map((s) => (s.folderId === id ? { ...s, folderId: undefined } : s)));
  };

  const handleFolderColorChange = async (id: string, color: string | undefined) => {
    await storageService.updateFolderColor(id, color);
    setFolders((prev) => prev.map((f) => (f.id === id ? { ...f, color } : f)));
  };

  const handleFolderReorder = async (
    updates: Array<{ id: string; sortOrder: number }>,
  ) => {
    await storageService.bulkUpdateFolderSortOrders(updates);
    const orderMap = new Map(updates.map((u) => [u.id, u.sortOrder]));
    setFolders((prev) =>
      prev.map((f) =>
        orderMap.has(f.id) ? { ...f, sortOrder: orderMap.get(f.id)! } : f,
      ),
    );
  };

  const handleViewFolderPrompts = (folderId: string) => {
    setCurrentView('prompts');
    // The PromptsTable manages its own filter state; navigation is sufficient
    void folderId; // acknowledgement param
  };

  // ── Tag operations ────────────────────────────────────────────────────────

  const handleRenameTag = async (oldName: string, newName: string) => {
    await storageService.renameTag(oldName, newName);
    setSnippets((prev) =>
      prev.map((s) => ({
        ...s,
        tags: s.tags?.map((t) => (t === oldName ? newName : t)),
      })),
    );
    setTagsMeta((prev) =>
      prev.map((t) => (t.name === oldName ? { ...t, name: newName } : t)),
    );
  };

  const handleDeleteTag = async (name: string) => {
    await storageService.deleteTagMeta(name);
    setSnippets((prev) =>
      prev.map((s) => ({ ...s, tags: s.tags?.filter((t) => t !== name) })),
    );
    setTagsMeta((prev) => prev.filter((t) => t.name !== name));
  };

  const handleTagColorChange = async (name: string, color: string | undefined) => {
    const meta = tagsMeta.find((t) => t.name === name) ?? { name };
    await storageService.saveTagMeta({ ...meta, color });
    setTagsMeta((prev) => {
      const exists = prev.some((t) => t.name === name);
      return exists
        ? prev.map((t) => (t.name === name ? { ...t, color } : t))
        : [...prev, { name, color }];
    });
  };

  // ── Settings ──────────────────────────────────────────────────────────────

  const handleSettingsChange = async (partial: Partial<DashboardSettings>) => {
    await storageService.saveSettings(partial);
    setSettings((prev) => ({ ...prev, ...partial }));
  };

  return {
    snippets,
    folders,
    tagsMeta,
    settings,
    currentView,
    isLoading,
    favoritesCount,
    notebooksCount,
    showShortcuts,
    setShowShortcuts,
    showCommandPalette,
    setShowCommandPalette,
    setCurrentView,
    handleDelete,
    handleUpdateTags,
    handleToggleFavorite,
    handleBulkDelete,
    handleBulkMoveToFolder,
    handleBulkAddTags,
    handleCreateFolder,
    handleRenameFolder,
    handleDeleteFolder,
    handleFolderColorChange,
    handleFolderReorder,
    handleViewFolderPrompts,
    handleRenameTag,
    handleDeleteTag,
    handleTagColorChange,
    handleSettingsChange,
  };
}
