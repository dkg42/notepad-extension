/**
 * @module useDashboardApp
 * @description Root React hook for the dashboard entrypoint that loads and synchronises all application state (snippets, folders, tags, notebooks, podcasts, pipelines, chat history). Triggers a background Drive sync on mount and listens to both local and sync storage change events to keep the UI up to date. Also exposes handlers for every CRUD operation across all entity types.
 * @dependencies @/types, @/types/dashboard, @/utils/folder-utils, @/services/storage-service, @/services/notebook-sync-service, @/services/notebook-annotation-service, @/hooks/useGlobalAudio, @/services/drive/drive-init-service
 * @public useDashboardApp
 */
import { useEffect, useMemo, useState } from 'react';
import type { ChatPlatform, Folder, NotebookAnnotation, NotebookMeta, PodcastEpisode, Snippet, TagMeta } from '@/types';
import type { ConversationMeta } from '@/types/chat-history';
import type { Pipeline } from '@/types/pipeline';
import { getFolderSubtreeIds } from '@/utils/folder-utils';
import type { DashboardSettings, DashboardView } from '@/types/dashboard';
import type { ConflictSummary } from '@/services/drive/drive-init-service';
import { storageService, snippetStorage } from '@/services/storage-service';
import { usageLimitService } from '@/services/usage-limit-service';
import { notebookSyncService } from '@/services/notebook-sync-service';
import { notebookAnnotationService } from '@/services/notebook-annotation-service';
import { useGlobalAudio } from '@/hooks/useGlobalAudio';
import { scopedStorage } from '@/services/storage/scoped-storage';

const DEFAULT_SETTINGS: DashboardSettings = {
  theme: 'light',
  rowsPerPage: 25,
  defaultSortColumn: 'savedAt',
  defaultSortDirection: 'desc',
};

export function useDashboardApp(isPro: boolean) {
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
  const [notebooks, setNotebooks] = useState<NotebookMeta[]>([]);
  const [notebooksCount, setNotebooksCount] = useState(0);
  const [selectedNotebookId, setSelectedNotebookId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<ConversationMeta[]>([]);
  const [chatHistoryCount, setChatHistoryCount] = useState(0);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [selectedChatPlatform, setSelectedChatPlatform] = useState<ChatPlatform | null>(null);
  const [podcastEpisodes, setPodcastEpisodes] = useState<PodcastEpisode[]>([]);
  const [podcastsCount, setPodcastsCount] = useState(0);
  const [selectedEpisodeId, setSelectedEpisodeId] = useState<string | null>(null);
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [pipelinesCount, setPipelinesCount] = useState(0);
  const [driveConflict, setDriveConflict] = useState<ConflictSummary | null>(null);
  const [selectedCaptureId, setSelectedCaptureId] = useState<string | null>(null);

  useEffect(() => {
    // Trigger Drive sync in the background. Responses land via the local storage
    // change listener below — the dashboard renders immediately from local storage
    // and updates automatically when Drive init writes fresher data.
    chrome.runtime.sendMessage({ type: 'DRIVE_INITIALIZE' })
      .then((res: { ok: boolean; needsMergeDecision?: boolean; conflictSummary?: ConflictSummary }) => {
        if (res?.ok && res.needsMergeDecision && res.conflictSummary) {
          setDriveConflict(res.conflictSummary);
        }
      })
      .catch(() => {}); // non-fatal: offline or not signed in

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
        setNotebooks(loadedNotebooks);
        setNotebooksCount(loadedNotebooks.length);
        return storageService.getPodcastEpisodes();
      })
      .then((episodes) => {
        setPodcastEpisodes(episodes);
        setPodcastsCount(episodes.length);
      })
      .finally(() => setIsLoading(false));
  }, []);

  // Update notebooks count and annotations when local storage changes
  useEffect(() => {
    return scopedStorage.onChanged(
      ['notebooksMeta', 'notebookAnnotations'],
      (changes) => {
        if ('notebooksMeta' in changes) {
          const updated = (changes.notebooksMeta.newValue as NotebookMeta[]) ?? [];
          setNotebooks(updated);
          setNotebooksCount(updated.length);
        }
        if ('notebookAnnotations' in changes) {
          const updated = (changes.notebookAnnotations.newValue as NotebookAnnotation[]) ?? [];
          setNotebookAnnotations(updated);
        }
      },
    );
  }, []);

  // Load initial chat history count
  useEffect(() => {
    chrome.runtime.sendMessage({ type: 'GET_CHAT_CONVERSATIONS' })
      .then((res: { ok: boolean; conversations?: ConversationMeta[] }) => {
        if (res?.ok && res.conversations) {
          setConversations(res.conversations);
          setChatHistoryCount(res.conversations.length);
        }
      })
      .catch(() => {});
  }, []);

  // React to local storage changes — covers both user edits and Drive sync writes.
  useEffect(() => {
    return scopedStorage.onChanged(
      ['snippets', 'folders', 'tagsMeta', 'dashboardSettings', 'chatConversations', 'podcastEpisodes', 'pipelines'],
      (changes) => {
        if ('snippets' in changes) {
          setSnippets((changes.snippets.newValue as Snippet[]) ?? []);
        }
        if ('folders' in changes) {
          setFolders((changes.folders.newValue as Folder[]) ?? []);
        }
        if ('tagsMeta' in changes) {
          setTagsMeta((changes.tagsMeta.newValue as TagMeta[]) ?? []);
        }
        if ('dashboardSettings' in changes && changes.dashboardSettings.newValue) {
          setSettings(changes.dashboardSettings.newValue as DashboardSettings);
        }
        if ('chatConversations' in changes) {
          const updated = (changes.chatConversations.newValue as ConversationMeta[]) ?? [];
          setConversations(updated);
          setChatHistoryCount(updated.length);
        }
        if ('podcastEpisodes' in changes) {
          const updated = (changes.podcastEpisodes.newValue as PodcastEpisode[]) ?? [];
          setPodcastEpisodes(updated);
          setPodcastsCount(updated.length);
        }
        if ('pipelines' in changes) {
          const updated = (changes.pipelines.newValue as Pipeline[]) ?? [];
          setPipelines(updated);
          setPipelinesCount(updated.filter((p) => p.enabled).length);
        }
      },
    );
  }, []);

  // Load initial pipelines count
  useEffect(() => {
    void scopedStorage.get<Pipeline[]>('pipelines')
      .then((result) => {
        const loaded = result.pipelines ?? [];
        setPipelines(loaded);
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

  const handleSaveSnippet = async (title: string, text: string, tags: string[], folderId?: string) => {
    if (!(await usageLimitService.canCreate('prompt_hub', isPro))) return;
    await storageService.saveWithMeta({
      text, source: 'dashboard', title: title || undefined, folderId, tags,
    });
  };

  const handleUpdateSnippet = async (id: string, title: string, text: string) => {
    await snippetStorage.updateSnippet(id, { title: title || undefined, text });
    setSnippets((prev) =>
      prev.map((s) => s.id === id ? { ...s, title: title || undefined, text } : s),
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

  const handleCreateFolder = async (name: string, parentId?: string) => {
    const folder = await storageService.createFolder(name, parentId);
    setFolders((prev) =>
      prev.some((f) => f.id === folder.id) ? prev : [...prev, folder],
    );
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
  };

  const handleMoveFolder = async (id: string, newParentId: string | undefined) => {
    await storageService.moveFolder(id, newParentId);
    setFolders((prev) =>
      prev.map((f) => (f.id === id ? { ...f, parentId: newParentId } : f)),
    );
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

  // ── Screenshot editor navigation ─────────────────────────────────────────

  const handleOpenScreenshotEditor = (captureId: string) => {
    setSelectedCaptureId(captureId);
    setCurrentView('screenshot-editor');
  };

  const handleBackToScreenshots = () => {
    setCurrentView('screenshots');
    setSelectedCaptureId(null);
  };

  // Cross-context navigation from side panel: consume pendingDashboardNav
  // both on mount (newly opened dashboard) and via storage change events
  // (already-open dashboard tab focused by openOptionsPage).
  useEffect(() => {
    const consume = (nav: unknown) => {
      if (!nav || typeof nav !== 'object') return;
      const { view, captureId } = nav as { view?: string; captureId?: string };
      if (view === 'screenshot-editor' && typeof captureId === 'string') {
        setSelectedCaptureId(captureId);
        setCurrentView('screenshot-editor');
        void chrome.storage.local.remove('pendingDashboardNav');
      } else if (view === 'settings') {
        setCurrentView('settings');
        void chrome.storage.local.remove('pendingDashboardNav');
      }
    };

    chrome.storage.local.get('pendingDashboardNav').then((res) => {
      consume(res.pendingDashboardNav);
    }).catch(() => {});

    const listener = (changes: Record<string, chrome.storage.StorageChange>) => {
      if ('pendingDashboardNav' in changes) {
        consume(changes.pendingDashboardNav.newValue);
      }
    };
    chrome.storage.local.onChanged.addListener(listener);
    return () => chrome.storage.local.onChanged.removeListener(listener);
  }, []);

  // ── Settings ──────────────────────────────────────────────────────────────

  const handleSettingsChange = async (partial: Partial<DashboardSettings>) => {
    await storageService.saveSettings(partial);
    setSettings((prev) => ({ ...prev, ...partial }));
  };

  const handleConflictResolution = async (decision: 'merge' | 'overwrite') => {
    setDriveConflict(null);
    await chrome.runtime.sendMessage({ type: 'DRIVE_RESOLVE_CONFLICT', decision }).catch(() => {});
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
    notebooks,
    notebooksCount,
    conversations,
    chatHistoryCount,
    podcastEpisodes,
    podcastsCount,
    pipelines,
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
    selectedCaptureId,
    handleOpenScreenshotEditor,
    handleBackToScreenshots,
    handleDelete,
    handleUpdateTags,
    handleToggleFavorite,
    handleSaveSnippet,
    handleUpdateSnippet,
    handleBulkDelete,
    handleBulkMoveToFolder,
    handleBulkAddTags,
    handleCreateFolder,
    handleRenameFolder,
    handleDeleteFolder,
    handleMoveFolder,
    handleFolderColorChange,
    handleFolderReorder,
    handleViewFolderPrompts,
    handleRenameTag,
    handleDeleteTag,
    handleTagColorChange,
    handleSettingsChange,
    driveConflict,
    handleConflictResolution,
  };
}
