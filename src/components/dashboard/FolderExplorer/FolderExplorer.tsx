import React from 'react';
import type { Folder, Snippet } from '@/types';
import FolderCard from '@/components/dashboard/FolderCard/FolderCard';
import FolderTree from '@/components/dashboard/FolderTree/FolderTree';
import { useFolderExplorer } from './useFolderExplorer';
import './FolderExplorer.css';

interface FolderExplorerProps {
  folders: Folder[];
  snippets: Snippet[];
  onCreateFolder: (name: string) => Promise<void>;
  onRenameFolder: (id: string, name: string) => void;
  onDeleteFolder: (id: string) => void;
  onFolderColorChange: (id: string, color: string | undefined) => void;
  onViewFolderPrompts: (folderId: string) => void;
  onReorderFolders: (updates: Array<{ id: string; sortOrder: number }>) => Promise<void>;
}

export default function FolderExplorer({
  folders,
  snippets,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  onFolderColorChange,
  onViewFolderPrompts,
  onReorderFolders,
}: FolderExplorerProps) {
  const {
    newFolderName,
    setNewFolderName,
    isCreating,
    setIsCreating,
    errorMessage,
    setErrorMessage,
    snippetCountByFolder,
    sortedFolders,
    viewMode,
    setViewMode,
    draggedId,
    dragOverId,
    selectedTreeId,
    setSelectedTreeId,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    computeReorder,
  } = useFolderExplorer(folders, snippets);

  const handleCreate = async () => {
    const trimmed = newFolderName.trim();
    if (!trimmed) return;
    try {
      await onCreateFolder(trimmed);
      setNewFolderName('');
      setIsCreating(false);
      setErrorMessage('');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to create folder');
    }
  };

  const handleDrop = async (targetId: string) => {
    const updates = computeReorder(targetId);
    handleDragEnd();
    if (updates) {
      await onReorderFolders(updates);
    }
  };

  return (
    <div className="folder-explorer">
      <div className="folder-explorer__header">
        <div>
          <h1 className="folder-explorer__heading">Folders</h1>
          <p className="folder-explorer__subheading">
            Organise your prompts with folders and colours. Drag cards to reorder.
          </p>
        </div>
        <div className="folder-explorer__header-actions">
          <div className="folder-explorer__view-toggle">
            <button
              className={`folder-explorer__view-btn${viewMode === 'grid' ? ' folder-explorer__view-btn--active' : ''}`}
              onClick={() => setViewMode('grid')}
              title="Grid view"
            >
              ⊞
            </button>
            <button
              className={`folder-explorer__view-btn${viewMode === 'tree' ? ' folder-explorer__view-btn--active' : ''}`}
              onClick={() => setViewMode('tree')}
              title="Tree view"
            >
              ≡
            </button>
          </div>
          <button
            className="folder-explorer__create-btn"
            onClick={() => setIsCreating(true)}
          >
            + New Folder
          </button>
        </div>
      </div>

      {isCreating && (
        <div className="folder-explorer__create-form">
          <input
            className="folder-explorer__create-input"
            type="text"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            placeholder="Folder name…"
            onKeyDown={(e) => {
              if (e.key === 'Enter') void handleCreate();
              if (e.key === 'Escape') {
                setIsCreating(false);
                setNewFolderName('');
              }
            }}
            autoFocus
          />
          <button className="folder-explorer__create-confirm-btn" onClick={() => void handleCreate()}>
            Create
          </button>
          <button
            className="folder-explorer__create-cancel-btn"
            onClick={() => {
              setIsCreating(false);
              setNewFolderName('');
            }}
          >
            Cancel
          </button>
          {errorMessage && (
            <span className="folder-explorer__error">{errorMessage}</span>
          )}
        </div>
      )}

      {sortedFolders.length === 0 ? (
        <div className="folder-explorer__empty">
          <span className="folder-explorer__empty-icon">◫</span>
          <p>No folders yet. Create one to organise your prompts.</p>
        </div>
      ) : viewMode === 'tree' ? (
        <div className="folder-explorer__tree-wrap">
          <FolderTree
            folders={sortedFolders}
            selectedId={selectedTreeId}
            onSelect={setSelectedTreeId}
          />
          {selectedTreeId && (() => {
            const folder = sortedFolders.find((f) => f.id === selectedTreeId);
            if (!folder) return null;
            return (
              <div className="folder-explorer__tree-detail">
                <FolderCard
                  folder={folder}
                  snippetCount={snippetCountByFolder.get(folder.id) ?? 0}
                  onRename={onRenameFolder}
                  onDelete={onDeleteFolder}
                  onColorChange={onFolderColorChange}
                  onViewPrompts={onViewFolderPrompts}
                />
              </div>
            );
          })()}
        </div>
      ) : (
        <div className="folder-explorer__grid">
          {sortedFolders.map((folder) => (
            <div
              key={folder.id}
              className={[
                'folder-explorer__card-wrap',
                draggedId === folder.id ? 'folder-explorer__card-wrap--dragging' : '',
                dragOverId === folder.id && draggedId !== folder.id
                  ? 'folder-explorer__card-wrap--drag-over'
                  : '',
              ]
                .filter(Boolean)
                .join(' ')}
              draggable
              onDragStart={() => handleDragStart(folder.id)}
              onDragOver={(e) => {
                e.preventDefault();
                handleDragOver(folder.id);
              }}
              onDrop={(e) => {
                e.preventDefault();
                void handleDrop(folder.id);
              }}
              onDragEnd={handleDragEnd}
            >
              <FolderCard
                folder={folder}
                snippetCount={snippetCountByFolder.get(folder.id) ?? 0}
                onRename={onRenameFolder}
                onDelete={onDeleteFolder}
                onColorChange={onFolderColorChange}
                onViewPrompts={onViewFolderPrompts}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
