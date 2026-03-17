import React, { useEffect, useMemo, useState } from 'react';
import type { Folder, Snippet } from '@/types';
import { UNCATEGORIZED_ID } from '@/types';
import { storageService } from '@/services/storage-service';
import FolderFilterDropdown from '@/components/FolderFilterDropdown';
import FolderManager from '@/components/FolderManager';
import SnippetList from '@/components/SnippetList';

export default function App() {
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFolderIds, setSelectedFolderIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    Promise.all([storageService.getAll(), storageService.getFolders()]).then(
      ([loadedSnippets, loadedFolders]) => {
        setSnippets(loadedSnippets);
        setFolders(loadedFolders);
      },
    );
  }, []);

  // ── Derived state ──────────────────────────────────────────────────────────

  const hasUncategorized = useMemo(() => snippets.some((s) => !s.folderId), [snippets]);

  const filteredSnippets = useMemo(() => {
    let result = snippets;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((s) => s.text.toLowerCase().includes(q));
    }

    if (selectedFolderIds.size > 0) {
      result = result.filter((s) => {
        const id = s.folderId ?? UNCATEGORIZED_ID;
        return selectedFolderIds.has(id);
      });
    }

    return result;
  }, [snippets, searchQuery, selectedFolderIds]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleDelete = async (id: string) => {
    await storageService.remove(id);
    setSnippets((prev) => prev.filter((s) => s.id !== id));
  };

  const handleClear = async () => {
    await storageService.clear();
    setSnippets([]);
  };

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
    // Unassign snippets from the deleted folder in local state
    setSnippets((prev) =>
      prev.map((s) => (s.folderId === id ? { ...s, folderId: undefined } : s)),
    );
    // Remove deleted folder from active filter
    setSelectedFolderIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={containerStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Saved Prompts</h2>
        {snippets.length > 0 && (
          <button onClick={handleClear} style={clearBtnStyle}>
            Clear all
          </button>
        )}
      </div>

      {/* Search bar */}
      <div style={searchRowStyle}>
        <span style={searchIconStyle}>🔍</span>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search prompts..."
          style={searchInputStyle}
        />
        {searchQuery && (
          <button onClick={() => setSearchQuery('')} style={clearSearchBtnStyle} title="Clear search">
            ✕
          </button>
        )}
      </div>

      {/* Folder filter dropdown */}
      <div style={{ marginBottom: 8 }}>
        <FolderFilterDropdown
          folders={folders}
          hasUncategorized={hasUncategorized}
          selectedIds={selectedFolderIds}
          onChange={setSelectedFolderIds}
        />
      </div>

      {/* Folder manager (collapsible) */}
      <FolderManager
        folders={folders}
        onCreateFolder={handleCreateFolder}
        onRenameFolder={handleRenameFolder}
        onDeleteFolder={handleDeleteFolder}
      />

      {/* Results count when filtering */}
      {(searchQuery || selectedFolderIds.size > 0) && snippets.length > 0 && (
        <p style={resultCountStyle}>
          {filteredSnippets.length} of {snippets.length} prompt
          {snippets.length !== 1 ? 's' : ''}
        </p>
      )}

      {/* Snippet list */}
      <SnippetList
        snippets={filteredSnippets}
        folders={folders}
        onDelete={handleDelete}
      />
    </div>
  );
}

const containerStyle: React.CSSProperties = {
  width: 400,
  fontFamily: 'system-ui, -apple-system, sans-serif',
  padding: '12px 14px',
  boxSizing: 'border-box',
};

const headerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: 10,
};

const clearBtnStyle: React.CSSProperties = {
  fontSize: 12,
  color: '#ef4444',
  background: 'none',
  border: '1px solid #ef4444',
  borderRadius: 4,
  padding: '2px 8px',
  cursor: 'pointer',
};

const searchRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  border: '1px solid #d1d5db',
  borderRadius: 5,
  padding: '4px 8px',
  marginBottom: 8,
  background: '#fff',
};

const searchIconStyle: React.CSSProperties = {
  fontSize: 13,
  marginRight: 6,
  flexShrink: 0,
};

const searchInputStyle: React.CSSProperties = {
  flex: 1,
  border: 'none',
  outline: 'none',
  fontSize: 12,
  color: '#111827',
  background: 'transparent',
  fontFamily: 'inherit',
};

const clearSearchBtnStyle: React.CSSProperties = {
  fontSize: 11,
  color: '#9ca3af',
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  padding: '0 2px',
  lineHeight: 1,
};

const resultCountStyle: React.CSSProperties = {
  fontSize: 11,
  color: '#6b7280',
  margin: '0 0 6px',
};