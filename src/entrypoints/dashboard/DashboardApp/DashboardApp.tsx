/**
 * @module DashboardApp
 * @description Root component for the full-page dashboard; orchestrates page routing, global audio playback, command palette, keyboard shortcuts, drive conflict dialogs, and theme provisioning.
 * @dependencies useDashboardApp, useCommandPalette, useKeyboardShortcuts, Sidebar, AudioPlayer, CommandPalette, KeyboardShortcutsPanel, ThemeProvider, SnippetsContext, NavigationContext, and all dashboard page components
 * @public DashboardApp
 */
import React, { useEffect, useMemo } from 'react';
import Sidebar from '@/components/dashboard/Sidebar/Sidebar';
import DashboardHome from '@/components/dashboard/DashboardHome/DashboardHome';
import PromptsPage from '@/components/dashboard/PromptsPage/PromptsPage';
import FolderExplorer from '@/components/dashboard/FolderExplorer/FolderExplorer';
import TagManager from '@/components/dashboard/TagManager/TagManager';
import AnalyticsPage from '@/components/dashboard/AnalyticsPage/AnalyticsPage';
import SettingsPage from '@/components/dashboard/SettingsPage/SettingsPage';
import ExportHistoryPage from '@/components/dashboard/ExportHistoryPage/ExportHistoryPage';
import NotebooksPage from '@/components/dashboard/NotebooksPage/NotebooksPage';
import NotebookDetailPage from '@/components/dashboard/NotebookDetailPage/NotebookDetailPage';
import AllSourcesPage from '@/components/dashboard/AllSourcesPage/AllSourcesPage';
import AllArtifactsPage from '@/components/dashboard/AllArtifactsPage/AllArtifactsPage';
import ChatHistoryPage from '@/components/dashboard/ChatHistoryPage/ChatHistoryPage';
import ChatHistoryDetailPage from '@/components/dashboard/ChatHistoryDetailPage/ChatHistoryDetailPage';
import PodcastsPage from '@/components/dashboard/PodcastsPage/PodcastsPage';
import PodcastDetailPage from '@/components/dashboard/PodcastDetailPage/PodcastDetailPage';
import AllAudioPage from '@/components/dashboard/AllAudioPage/AllAudioPage';
import PipelinesPage from '@/components/dashboard/PipelinesPage/PipelinesPage';
import ScreenshotsPage from '@/components/dashboard/ScreenshotsPage/ScreenshotsPage';
import ScreenshotEditor from '@/components/dashboard/ScreenshotEditor/ScreenshotEditor';
import AudioPlayer from '@/components/dashboard/AudioPlayer/AudioPlayer';
import CommandPalette from '@/components/dashboard/CommandPalette/CommandPalette';
import KeyboardShortcutsPanel from '@/components/dashboard/KeyboardShortcutsPanel/KeyboardShortcutsPanel';
import DriveConflictDialog from '@/components/dashboard/DriveConflictDialog/DriveConflictDialog';
import { ThemeProvider } from '@/components/dashboard/ThemeProvider/ThemeProvider';
import { useCommandPalette } from '@/components/dashboard/CommandPalette/useCommandPalette';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { SnippetsProvider } from '@/contexts/SnippetsContext';
import { NavigationProvider } from '@/contexts/NavigationContext';
import { SubscriptionProvider, useSubscriptionState } from '@/contexts/SubscriptionContext';
import { useDashboardApp } from './useDashboardApp';
import './DashboardApp.css';

export default function DashboardApp() {
  const subscriptionValue = useSubscriptionState();

  const {
    // Global audio
    audioUrl,
    audioTitle,
    isLoadingAudio,
    podcastContext,
    playArtifact,
    playTrack,
    playNext,
    stopAudio,
    // Dashboard state
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
  } = useDashboardApp(subscriptionValue.isPro);

  const palette = useCommandPalette(snippets, folders, notebooks, conversations, pipelines, podcastEpisodes, setCurrentView);

  // Bridge: sidebar "Search everything" button sets showCommandPalette via context,
  // but the palette itself tracks its own isOpen state. Sync them here.
  useEffect(() => {
    if (showCommandPalette) {
      palette.open();
      setShowCommandPalette(false);
    }
  }, [showCommandPalette]);

  const shortcuts = useMemo(
    () => [
      {
        key: '?',
        description: 'Show keyboard shortcuts',
        handler: () => setShowShortcuts(true),
      },
      {
        key: 'k',
        ctrlOrMeta: true as const,
        description: 'Open command palette',
        handler: palette.open,
      },
    ],
    [palette.open, setShowShortcuts],
  );

  useKeyboardShortcuts(shortcuts);

  const snippetsValue = useMemo(
    () => ({
      snippets,
      folders,
      tagsMeta,
      notebookAnnotations,
      favoritesCount,
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
    }),
    [
      snippets,
      folders,
      tagsMeta,
      notebookAnnotations,
      favoritesCount,
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
    ],
  );

  const navigationValue = useMemo(
    () => ({
      currentView,
      setCurrentView,
      isLoading,
      settings,
      handleSettingsChange,
      showShortcuts,
      setShowShortcuts,
      showCommandPalette,
      setShowCommandPalette,
      notebooksCount,
      chatHistoryCount,
      podcastsCount,
      pipelinesCount,
      conversations,
      notebooks,
      selectedNotebookId,
      handleOpenNotebookDetail,
      handleBackToNotebooks,
      selectedEpisodeId,
      handleOpenPodcastDetail,
      handleBackToPodcasts,
      selectedChatId,
      selectedChatPlatform,
      handleOpenChatDetail,
      handleBackToChatHistory,
      selectedCaptureId,
      handleOpenScreenshotEditor,
      handleBackToScreenshots,
      driveConflict,
      handleConflictResolution,
      audioUrl,
      audioTitle,
      isLoadingAudio,
      podcastContext,
      playArtifact,
      playTrack,
      playNext,
      stopAudio,
    }),
    [
      currentView,
      setCurrentView,
      isLoading,
      settings,
      handleSettingsChange,
      showShortcuts,
      setShowShortcuts,
      showCommandPalette,
      setShowCommandPalette,
      notebooksCount,
      chatHistoryCount,
      podcastsCount,
      pipelinesCount,
      conversations,
      notebooks,
      selectedNotebookId,
      handleOpenNotebookDetail,
      handleBackToNotebooks,
      selectedEpisodeId,
      handleOpenPodcastDetail,
      handleBackToPodcasts,
      selectedChatId,
      selectedChatPlatform,
      handleOpenChatDetail,
      handleBackToChatHistory,
      selectedCaptureId,
      handleOpenScreenshotEditor,
      handleBackToScreenshots,
      driveConflict,
      handleConflictResolution,
      audioUrl,
      audioTitle,
      isLoadingAudio,
      podcastContext,
      playArtifact,
      playTrack,
      playNext,
      stopAudio,
    ],
  );

  const renderContent = () => {
    if (isLoading) {
      return <div className="dashboard-app__loading">Loading…</div>;
    }

    switch (currentView) {
      case 'home':
        return <DashboardHome />;

      case 'prompts':
        return <PromptsPage />;


      case 'folders':
        return <FolderExplorer />;

      case 'tags':
        return <TagManager />;

      case 'analytics':
        return <AnalyticsPage />;

      case 'export-history':
        return <ExportHistoryPage />;

      case 'notebooks':
        return <NotebooksPage />;

      case 'notebook-detail':
        return selectedNotebookId ? <NotebookDetailPage /> : null;

      case 'all-sources':
        return <AllSourcesPage />;

      case 'all-artifacts':
        return <AllArtifactsPage />;

      case 'podcasts':
        return <PodcastsPage />;

      case 'podcast-detail':
        return selectedEpisodeId ? <PodcastDetailPage /> : null;

      case 'all-audio':
        return <AllAudioPage />;

      case 'chat-history':
        return <ChatHistoryPage />;

      case 'chat-history-detail':
        return selectedChatPlatform && selectedChatId ? <ChatHistoryDetailPage /> : null;

      case 'pipelines':
        return <PipelinesPage />;

      case 'settings':
        return <SettingsPage />;

      case 'screenshots':
        return <ScreenshotsPage />;

      case 'screenshot-editor':
        return selectedCaptureId ? <ScreenshotEditor captureId={selectedCaptureId} /> : null;

      default:
        return (
          <div className="dashboard-app__loading">This section is coming soon.</div>
        );
    }
  };

  return (
    <ThemeProvider
      initialTheme={settings.theme}
      onThemeChange={(theme) => handleSettingsChange({ theme })}
    >
      <SubscriptionProvider value={subscriptionValue}>
      <NavigationProvider value={navigationValue}>
        <SnippetsProvider value={snippetsValue}>
          <div className="dashboard-app">
            <Sidebar />
            <div className="dashboard-app__content">
              <main className={`dashboard-app__main${currentView === 'notebooks' || currentView === 'notebook-detail' ? ' dashboard-app__main--flush' : ''}`}>{renderContent()}</main>
            </div>
          </div>

          <CommandPalette
            isOpen={palette.isOpen}
            query={palette.query}
            items={palette.items}
            selectableItems={palette.selectableItems}
            activeIndex={palette.activeIndex}
            onQueryChange={palette.setQuery}
            onSelectItem={(item) => item.onSelect()}
            onSetActiveIndex={palette.setActiveIndex}
            onClose={palette.close}
            onKeyDown={palette.handleKeyDown}
          />

          {showShortcuts && (
            <KeyboardShortcutsPanel onClose={() => setShowShortcuts(false)} />
          )}

          {audioUrl && (
            <AudioPlayer
              key={audioUrl}
              audioUrl={audioUrl}
              title={audioTitle}
              onClose={stopAudio}
              onEnded={() => void playNext()}
            />
          )}

          {driveConflict && (
            <DriveConflictDialog
              summary={driveConflict}
              onMerge={() => void handleConflictResolution('merge')}
              onOverwrite={() => void handleConflictResolution('overwrite')}
            />
          )}
        </SnippetsProvider>
      </NavigationProvider>
      </SubscriptionProvider>
    </ThemeProvider>
  );
}
