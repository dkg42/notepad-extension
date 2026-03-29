import React, { useEffect, useState } from 'react';
import { Search, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import FolderFilterDropdown from '@/components/FolderFilterDropdown/FolderFilterDropdown';
import FolderManager from '@/components/FolderManager/FolderManager';
import SnippetList from '@/components/SnippetList/SnippetList';
import TagFilter from '@/components/TagFilter/TagFilter';
import AccountSwitcher from '@/components/AccountSwitcher/AccountSwitcher';
import type { AuthUser } from '@/types';
import { authService } from '@/services/auth-service';
import { useApp } from './useApp';
import './App.css';

/**
 * Root popup component. Auth is optional — the full snippet UI is always
 * accessible. The AccountSwitcher in the header handles sign-in/sign-out.
 */
export default function App() {
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    authService.getCurrentUser().then((user) => {
      setAuthUser(user);
      setIsLoadingAuth(false);
    });

    const unsubscribe = authService.onAuthStateChange((user) => {
      setAuthUser(user);
      setIsLoadingAuth(false);
    });

    return unsubscribe;
  }, []);

  if (isLoadingAuth) {
    return (
      <div className="app-container app-loading">
        <span className="app-loading-spinner" aria-label="Loading..." />
      </div>
    );
  }

  return <AppContent user={authUser} />;
}

// ── App content (always rendered regardless of auth state) ───────────────────

interface AppContentProps {
  user: AuthUser | null;
}

function AppContent({ user }: AppContentProps) {
  const {
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
  } = useApp();

  const isFiltering = searchQuery || selectedFolderIds.size > 0 || selectedTags.size > 0;

  return (
    <div className="app-container">
      <div className="app-header">
        <h2 className="app-header__title">Saved Prompts</h2>
        <div className="app-header__actions">
          <AccountSwitcher user={user} />
          <button
            onClick={() => chrome.runtime.openOptionsPage()}
            className="app-header__dashboard-btn"
            title="Open full dashboard"
          >
            Dashboard ↗
          </button>
          {snippets.length > 0 && (
            <button onClick={handleClear} className="app-header__clear-btn">
              Clear all
            </button>
          )}
        </div>
      </div>

      <div className="app-search">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search prompts..."
          className="app-search__input"
        />
        <div className="app-search__icon-wrap">
          <AnimatePresence mode="popLayout" initial={false}>
            {searchQuery.length > 0 ? (
              <motion.button
                key="clear"
                className="app-search__icon-btn"
                onClick={() => setSearchQuery('')}
                title="Clear search"
                initial={{ y: -8, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 8, opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <X size={12} strokeWidth={2.5} />
              </motion.button>
            ) : (
              <motion.span
                key="search"
                className="app-search__icon-indicator"
                initial={{ y: -8, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 8, opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <Search size={12} strokeWidth={1.75} />
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="app-folder-filter">
        <FolderFilterDropdown
          folders={folders}
          hasUncategorized={hasUncategorized}
          selectedIds={selectedFolderIds}
          onChange={setSelectedFolderIds}
        />
      </div>

      <div className="app-tag-filter">
        <TagFilter allTags={allTags} selectedTags={selectedTags} onChange={setSelectedTags} />
      </div>

      <FolderManager
        folders={folders}
        onCreateFolder={handleCreateFolder}
        onRenameFolder={handleRenameFolder}
        onDeleteFolder={handleDeleteFolder}
      />

      {isFiltering && snippets.length > 0 && (
        <p className="app-result-count">
          {filteredSnippets.length} of {snippets.length} prompt
          {snippets.length !== 1 ? 's' : ''}
        </p>
      )}

      <SnippetList
        snippets={filteredSnippets}
        folders={folders}
        onDelete={handleDelete}
        onUpdateTags={handleUpdateTags}
      />
    </div>
  );
}
