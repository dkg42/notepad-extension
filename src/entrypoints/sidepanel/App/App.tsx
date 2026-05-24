/**
 * @module App
 * @description Root component for the browser side panel; handles auth state resolution and renders the appropriate sidebar view (Home, PromptHub, or Snippets) behind an auth gate.
 * @dependencies authService, useClipboardTab, useApp, SidebarHeader, HomeView, PromptHubView, SnippetsView, UserMenu
 * @public App
 */
import React, { useEffect, useState } from 'react';
import SidebarHeader from '@/components/sidebar/SidebarHeader/SidebarHeader';
import HomeView from '@/components/sidebar/HomeView/HomeView';
import PromptHubView from '@/components/sidebar/PromptHubView/PromptHubView';
import SnippetsView from '@/components/sidebar/SnippetsView/SnippetsView';
import ChatHistoryView from '@/components/sidebar/ChatHistoryView/ChatHistoryView';
import TabManagerView from '@/components/sidebar/TabManagerView/TabManagerView';
import ScreenshotView from '@/components/sidebar/ScreenshotView/ScreenshotView';
import NotebookView from '@/components/sidebar/NotebookView/NotebookView';
import UserMenu from '@/components/sidebar/UserMenu/UserMenu';
import AuthButton from '@/components/AuthButton/AuthButton';
import type { StoredAuthProfile } from '@/types';
import { authService } from '@/services/auth-service';
import { SubscriptionProvider, useSubscriptionState } from '@/contexts/SubscriptionContext';
import { useClipboardTab } from '@/components/ClipboardTab/useClipboardTab';
import { storageService } from '@/services/storage-service';
import { useApp } from './useApp';
import './App.css';

type View = 'home' | 'prompts' | 'snippets' | 'history' | 'tabs' | 'screenshot' | 'notebook';

export default function App() {
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authUser, setAuthUser] = useState<StoredAuthProfile | null>(null);

  useEffect(() => {
    authService.getCurrentUser().then((user) => {
      setAuthUser(user);
      setIsLoadingAuth(false);
    });

    const unsubscribe = authService.onAuthStateChange((user) => {
      if (!user) localStorage.clear();
      setAuthUser(user);
      setIsLoadingAuth(false);
    });

    return unsubscribe;
  }, []);

  if (isLoadingAuth) {
    return (
      <div className="app-loading">
        <span className="app-loading-spinner" aria-label="Loading…" />
      </div>
    );
  }

  return (
    <>
      <AppContent user={authUser} />
      {!authUser && <AuthButton />}
    </>
  );
}

function AppContent({ user }: { user: StoredAuthProfile | null }) {
  const [view, setView] = useState<View>('home');
  const [dark, setDark] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const subscriptionValue = useSubscriptionState();
  const appData = useApp(subscriptionValue.isPro);
  const clipboardData = useClipboardTab();

  useEffect(() => {
    if (!user) return;
    chrome.runtime.sendMessage({ type: 'DRIVE_INITIALIZE' }).catch(() => {});
  }, [user?.uid]);

  useEffect(() => {
    storageService.getSettings().then((settings) => {
      setDark(settings.theme === 'dark');
    });

    const listener = (
      changes: Record<string, chrome.storage.StorageChange>,
      areaName: string,
    ) => {
      if (areaName === 'local' && changes['dashboardSettings']?.newValue) {
        setDark(
          (changes['dashboardSettings'].newValue as { theme?: string }).theme === 'dark',
        );
      }
    };

    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, []);

  const toggleDark = () => {
    const next = !dark;
    setDark(next);
    void storageService.saveSettings({ theme: next ? 'dark' : 'light' });
  };

  const handleSignOut = () => {
    authService.signOut().catch(() => {});
  };

  const handleNavigate = (target: string) => {
    if (target === 'prompts' || target === 'snippets' || target === 'history' || target === 'tabs' || target === 'screenshot' || target === 'notebook') {
      setView(target as View);
    }
  };

  return (
    <SubscriptionProvider value={subscriptionValue}>
    <div className={`app-shell${dark ? ' dark' : ''}`}>
      <SidebarHeader
        view={view}
        dark={dark}
        user={user}
        userMenuOpen={userMenuOpen}
        onBack={() => setView('home')}
        onToggleDark={toggleDark}
        onOpenDashboard={() => chrome.runtime.openOptionsPage()}
        onUserClick={() => setUserMenuOpen((o) => !o)}
      />

      {view === 'home' && (
        <HomeView
          onNavigate={handleNavigate}
          user={user}
        />
      )}

      {view === 'prompts' && (
        <PromptHubView
          snippets={appData.snippets}
          folders={appData.folders}
          allTags={appData.allTags}
          searchQuery={appData.searchQuery}
          setSearchQuery={appData.setSearchQuery}
          handleDelete={appData.handleDelete}
          handleUpdateTags={appData.handleUpdateTags}
          handleToggleFavorite={appData.handleToggleFavorite}
          handleAddSnippet={appData.handleAddSnippet}
          handleCreateFolder={appData.handleCreateFolder}
          handleRenameFolder={appData.handleRenameFolder}
          handleDeleteFolder={appData.handleDeleteFolder}
          handleMoveToFolder={appData.handleMoveToFolder}
        />
      )}

      {view === 'snippets' && (
        <SnippetsView
          entries={clipboardData.entries}
          onDelete={clipboardData.handleDelete}
          onClear={clipboardData.handleClear}
          onCopyText={clipboardData.handleCopyText}
          onSaveAsSnippet={clipboardData.handleSaveAsSnippet}
        />
      )}

      {view === 'history' && <ChatHistoryView />}

      {view === 'tabs' && <TabManagerView />}

      {view === 'screenshot' && <ScreenshotView />}

      {view === 'notebook' && <NotebookView />}

      {userMenuOpen && user && (
        <UserMenu
          user={user}
          claims={subscriptionValue.claims}
          onClose={() => setUserMenuOpen(false)}
          onSignOut={handleSignOut}
        />
      )}
    </div>
    </SubscriptionProvider>
  );
}
