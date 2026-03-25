import React, { useMemo } from 'react';
import Sidebar from '@/components/dashboard/Sidebar/Sidebar';
import DashboardHome from '@/components/dashboard/DashboardHome/DashboardHome';
import PromptsTable from '@/components/dashboard/PromptsTable/PromptsTable';
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
import CommandPalette from '@/components/dashboard/CommandPalette/CommandPalette';
import KeyboardShortcutsPanel from '@/components/dashboard/KeyboardShortcutsPanel/KeyboardShortcutsPanel';
import { ThemeProvider } from '@/components/dashboard/ThemeProvider/ThemeProvider';
import { useCommandPalette } from '@/components/dashboard/CommandPalette/useCommandPalette';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useDashboardApp } from './useDashboardApp';
import './DashboardApp.css';

export default function DashboardApp() {
  const {
    snippets,
    folders,
    tagsMeta,
    settings,
    currentView,
    isLoading,
    favoritesCount,
    notebooksCount,
    chatHistoryCount,
    selectedChatId,
    selectedChatPlatform,
    showShortcuts,
    setShowShortcuts,
    setCurrentView,
    selectedNotebookId,
    handleOpenNotebookDetail,
    handleBackToNotebooks,
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
  } = useDashboardApp();

  const palette = useCommandPalette(snippets, folders, setCurrentView);

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

  const renderContent = () => {
    if (isLoading) {
      return <div className="dashboard-app__loading">Loading…</div>;
    }

    switch (currentView) {
      case 'home':
        return (
          <DashboardHome
            snippets={snippets}
            folders={folders}
            onNavigate={setCurrentView}
          />
        );

      case 'prompts':
        return (
          <PromptsTable
            snippets={snippets}
            folders={folders}
            onDelete={handleDelete}
            onUpdateTags={handleUpdateTags}
            onToggleFavorite={handleToggleFavorite}
            onBulkDelete={handleBulkDelete}
            onBulkMoveToFolder={handleBulkMoveToFolder}
            onBulkAddTags={handleBulkAddTags}
          />
        );

      case 'favorites':
        return (
          <PromptsTable
            snippets={snippets.filter((s) => s.isFavorite)}
            folders={folders}
            onDelete={handleDelete}
            onUpdateTags={handleUpdateTags}
            onToggleFavorite={handleToggleFavorite}
            onBulkDelete={handleBulkDelete}
            onBulkMoveToFolder={handleBulkMoveToFolder}
            onBulkAddTags={handleBulkAddTags}
          />
        );

      case 'folders':
        return (
          <FolderExplorer
            folders={folders}
            snippets={snippets}
            onCreateFolder={handleCreateFolder}
            onRenameFolder={handleRenameFolder}
            onDeleteFolder={handleDeleteFolder}
            onFolderColorChange={handleFolderColorChange}
            onViewFolderPrompts={handleViewFolderPrompts}
            onReorderFolders={handleFolderReorder}
          />
        );

      case 'tags':
        return (
          <TagManager
            snippets={snippets}
            tagsMeta={tagsMeta}
            onRenameTag={handleRenameTag}
            onDeleteTag={handleDeleteTag}
            onTagColorChange={handleTagColorChange}
          />
        );

      case 'analytics':
        return <AnalyticsPage snippets={snippets} folders={folders} />;

      case 'export-history':
        return <ExportHistoryPage />;

      case 'notebooks':
        return <NotebooksPage onOpenNotebook={handleOpenNotebookDetail} />;

      case 'notebook-detail':
        return selectedNotebookId ? (
          <NotebookDetailPage
            notebookId={selectedNotebookId}
            onBack={handleBackToNotebooks}
          />
        ) : null;

      case 'all-sources':
        return <AllSourcesPage />;

      case 'all-artifacts':
        return <AllArtifactsPage />;

      case 'chat-history':
        return <ChatHistoryPage onOpenConversation={handleOpenChatDetail} />;

      case 'chat-history-detail':
        return selectedChatPlatform && selectedChatId ? (
          <ChatHistoryDetailPage
            platform={selectedChatPlatform}
            conversationId={selectedChatId}
            onBack={handleBackToChatHistory}
          />
        ) : null;

      case 'settings':
        return (
          <SettingsPage settings={settings} onSettingsChange={handleSettingsChange} />
        );

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
      <div className="dashboard-app">
        <Sidebar
          currentView={currentView}
          onNavigate={setCurrentView}
          promptCount={snippets.length}
          favoritesCount={favoritesCount}
          notebooksCount={notebooksCount}
          chatHistoryCount={chatHistoryCount}
        />
        <div className="dashboard-app__content">
          <main className="dashboard-app__main">{renderContent()}</main>
        </div>
      </div>

      <CommandPalette
        isOpen={palette.isOpen}
        query={palette.query}
        items={palette.items}
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
    </ThemeProvider>
  );
}
