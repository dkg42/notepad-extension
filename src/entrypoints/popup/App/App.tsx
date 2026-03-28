import React from 'react';
import { Search, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import FolderFilterDropdown from '@/components/FolderFilterDropdown/FolderFilterDropdown';
import FolderManager from '@/components/FolderManager/FolderManager';
import SnippetList from '@/components/SnippetList/SnippetList';
import TagFilter from '@/components/TagFilter/TagFilter';
import { useApp } from './useApp';
import './App.css';

export default function App() {
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