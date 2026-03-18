import React from 'react';
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