import React from 'react';
import FolderFilterDropdown from '@/components/FolderFilterDropdown/FolderFilterDropdown';
import FolderManager from '@/components/FolderManager/FolderManager';
import SnippetList from '@/components/SnippetList/SnippetList';
import { useApp } from './useApp';
import './App.css';

export default function App() {
  const {
    snippets,
    folders,
    searchQuery,
    setSearchQuery,
    selectedFolderIds,
    setSelectedFolderIds,
    hasUncategorized,
    filteredSnippets,
    handleDelete,
    handleClear,
    handleCreateFolder,
    handleRenameFolder,
    handleDeleteFolder,
  } = useApp();

  return (
    <div className="app-container">
      <div className="app-header">
        <h2 className="app-header__title">Saved Prompts</h2>
        {snippets.length > 0 && (
          <button onClick={handleClear} className="app-header__clear-btn">
            Clear all
          </button>
        )}
      </div>

      <div className="app-search">
        <span className="app-search__icon">🔍</span>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search prompts..."
          className="app-search__input"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="app-search__clear-btn"
            title="Clear search"
          >
            ✕
          </button>
        )}
      </div>

      <div className="app-folder-filter">
        <FolderFilterDropdown
          folders={folders}
          hasUncategorized={hasUncategorized}
          selectedIds={selectedFolderIds}
          onChange={setSelectedFolderIds}
        />
      </div>

      <FolderManager
        folders={folders}
        onCreateFolder={handleCreateFolder}
        onRenameFolder={handleRenameFolder}
        onDeleteFolder={handleDeleteFolder}
      />

      {(searchQuery || selectedFolderIds.size > 0) && snippets.length > 0 && (
        <p className="app-result-count">
          {filteredSnippets.length} of {snippets.length} prompt
          {snippets.length !== 1 ? 's' : ''}
        </p>
      )}

      <SnippetList snippets={filteredSnippets} folders={folders} onDelete={handleDelete} />
    </div>
  );
}
