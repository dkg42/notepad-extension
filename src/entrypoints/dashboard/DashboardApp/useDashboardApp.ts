import { useEffect, useMemo, useState } from 'react';
import type { ChatPlatform, Folder, NotebookAnnotation, NotebookMeta, Snippet, TagMeta } from '@/types';
import type { DashboardSettings, DashboardView } from '@/types/dashboard';
import { storageService } from '@/services/storage-service';
import { notebookSyncService } from '@/services/notebook-sync-service';
import { notebookAnnotationService } from '@/services/notebook-annotation-service';
import { useGlobalAudio } from '@/hooks/useGlobalAudio';

const DEFAULT_SETTINGS: DashboardSettings = {
  theme: 'light',
  rowsPerPage: 25,
  defaultSortColumn: 'savedAt',
  defaultSortDirection: 'desc',
};

export function useDashboardApp() {
  const globalAudio = useGlobalAudio();

  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [tagsMeta, setTagsMeta] = useState<TagMeta[]>([]);
  const [notebookAnnotations, setNotebookAnnotations] = useState<NotebookAnnotation[]>([]);
  const [settings, setSettings] = useState<DashboardSettings>(DEFAULT_SETTINGS);
  const [currentView, setCurrentView] = useState<DashboardView>('home');
  const [isLoading, setIsLoading] = useState(true);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [notebooksCount, setNotebooksCount] = useState(0);
  const [selectedNotebookId, setSelectedNotebookId] = useState<string | null>(null);
  const [chatHistoryCount, setChatHistoryCount] = useState(0);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [selectedChatPlatform, setSelectedChatPlatform] = useState<ChatPlatform | null>(null);
  const [podcastsCount, setPodcastsCount] = useState(0);
  const [selectedEpisodeId, setSelectedEpisodeId] = useState<string | null>(null);
  const [pipelinesCount, setPipelinesCount] = useState(0);

  useEffect(() => {
    Promise.all([
      storageService.getAll(),
      storageService.getFolders(),
      storageService.getTagsMeta(),
      storageService.getSettings(),
      notebookSyncService.getAll(),
      notebookAnnotationService.getAllAnnotations(),
    ])
      .then(([loadedSnippets, loadedFolders, loadedTagsMeta, loadedSettings, loadedNotebooks, loadedAnnotations]) => {
        setSnippets(loadedSnippets);
        setFolders(loadedFolders);
        setTagsMeta(loadedTagsMeta);
        setNotebookAnnotations(loadedAnnotations);
        setSettings(loadedSettings);
        setNotebooksCount(loadedNotebooks.length);
        return storageService.getPodcastEpisodes();
      })
      .then((episodes) => setPodcastsCount(episodes.length))
      .finally(() => setIsLoading(false));
  }, []);

  // Update notebooks count and annotations when sync storage changes
  useEffect(() => {
    const listener = (changes: Record<string, chrome.storage.StorageChange>) => {
      if ('notebooksMeta' in changes) {
        const updated = (changes.notebooksMeta.newValue as NotebookMeta[]) ?? [];
        setNotebooksCount(updated.length);
      }
      if ('notebookAnnotations' in changes) {
        const updated = (changes.notebookAnnotations.newValue as NotebookAnnotation[]) ?? [];
        setNotebookAnnotations(updated);
      }
    };
    chrome.storage.sync.onChanged.addListener(listener);
    return () => chrome.storage.sync.onChanged.removeListener(listener);
  }, []);

  // Load initial chat history count
  useEffect(() => {
    chrome.runtime.sendMessage({ type: 'GET_CHAT_CONVERSATIONS' })
      .then((res: { ok: boolean; conversations?: Array<unknown> }) => {
        if (res?.ok && res.conversations) {
          setChatHistoryCount(res.conversations.length);
        }
      })
      .catch(() => {});
  }, []);

  // Update chat history count when local storage changes
  useEffect(() => {
    const listener = (changes: Record<string, chrome.storage.StorageChange>) => {
      if ('chatConversations' in changes) {
        const updated = (changes.chatConversations.newValue as Array<unknown>) ?? [];
        setChatHistoryCount(updated.length);
      }
      if ('podcastEpisodes' in changes) {
        const updated = (changes.podcastEpisodes.newValue as Array<unknown>) ?? [];
        setPodcastsCount(updated.length);
      }
      if ('pipelines' in changes) {
        const updated = (changes.pipelines.newValue as Array<{ enabled: boolean }>) ?? [];
        setPipelinesCount(updated.filter((p) => p.enabled).length);
      }
    };
    chrome.storage.local.onChanged.addListener(listener);
    return () => chrome.storage.local.onChanged.removeListener(listener);
  }, []);

  // Load initial pipelines count
  useEffect(() => {
    chrome.storage.local.get('pipelines')
      .then((result) => {
        const loaded = (result.pipelines as Array<{ enabled: boolean }>) ?? [];
        setPipelinesCount(loaded.filter((p) => p.enabled).length);
      })
      .catch(() => {});
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
    const affectedAnnotations = notebookAnnotations.filter((a) => a.tags.includes(oldName));
    await Promise.all([
      storageService.renameTag(oldName, newName),
      ...affectedAnnotations.map((a) =>
        notebookAnnotationService.setAnnotation({
          ...a,
          tags: a.tags.map((t) => (t === oldName ? newName : t)),
        }),
      ),
    ]);
    setSnippets((prev) =>
      prev.map((s) => ({
        ...s,
        tags: s.tags?.map((t) => (t === oldName ? newName : t)),
      })),
    );
    setTagsMeta((prev) =>
      prev.map((t) => (t.name === oldName ? { ...t, name: newName } : t)),
    );
    setNotebookAnnotations((prev) =>
      prev.map((a) => ({
        ...a,
        tags: a.tags.map((t) => (t === oldName ? newName : t)),
      })),
    );
  };

  const handleDeleteTag = async (name: string) => {
    const affectedAnnotations = notebookAnnotations.filter((a) => a.tags.includes(name));
    await Promise.all([
      storageService.deleteTagMeta(name),
      ...affectedAnnotations.map((a) =>
        notebookAnnotationService.setAnnotation({
          ...a,
          tags: a.tags.filter((t) => t !== name),
        }),
      ),
    ]);
    setSnippets((prev) =>
      prev.map((s) => ({ ...s, tags: s.tags?.filter((t) => t !== name) })),
    );
    setTagsMeta((prev) => prev.filter((t) => t.name !== name));
    setNotebookAnnotations((prev) =>
      prev.map((a) => ({ ...a, tags: a.tags.filter((t) => t !== name) })),
    );
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

  // ── Notebook detail navigation ───────────────────────────────────────────

  const handleOpenNotebookDetail = (notebookId: string) => {
    setSelectedNotebookId(notebookId);
    setCurrentView('notebook-detail');
  };

  const handleBackToNotebooks = () => {
    setCurrentView('notebooks');
    setSelectedNotebookId(null);
  };

  // ── Podcast navigation ────────────────────────────────────────────────────

  const handleOpenPodcastDetail = (episodeId: string) => {
    setSelectedEpisodeId(episodeId);
    setCurrentView('podcast-detail');
  };

  const handleBackToPodcasts = () => {
    setCurrentView('podcasts');
    setSelectedEpisodeId(null);
  };

  // ── Chat history navigation ───────────────────────────────────────────────

  const handleOpenChatDetail = (platform: ChatPlatform, id: string) => {
    setSelectedChatPlatform(platform);
    setSelectedChatId(id);
    setCurrentView('chat-history-detail');
  };

  const handleBackToChatHistory = () => {
    setCurrentView('chat-history');
    setSelectedChatId(null);
    setSelectedChatPlatform(null);
  };

  // ── Settings ──────────────────────────────────────────────────────────────

  const handleSettingsChange = async (partial: Partial<DashboardSettings>) => {
    await storageService.saveSettings(partial);
    setSettings((prev) => ({ ...prev, ...partial }));
  };

  return {
    ...globalAudio,
    snippets,
    folders,
    tagsMeta,
    notebookAnnotations,
    settings,
    currentView,
    isLoading,
    favoritesCount,
    notebooksCount,
    chatHistoryCount,
    podcastsCount,
    pipelinesCount,
    selectedEpisodeId,
    selectedChatId,
    selectedChatPlatform,
    showShortcuts,
    setShowShortcuts,
    showCommandPalette,
    setShowCommandPalette,
    setCurrentView,
    selectedNotebookId,
    handleOpenNotebookDetail,
    handleBackToNotebooks,
    handleOpenPodcastDetail,
    handleBackToPodcasts,
    handleOpenChatDetail,
    handleBackToChatHistory,
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
