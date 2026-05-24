/**
 * @module FolderExplorer
 * @description Full folder management page with switchable tree/grid views and drag-to-reorder in grid mode. Folder create/rename/subfolder/delete UX is delegated to the shared FolderNav component.
 * @dependencies @/types, @/components/dashboard/FolderCard/FolderCard, @/components/dashboard/FolderNav/FolderNav, @/components/dashboard/MoveFolderDialog/MoveFolderDialog, ./useFolderExplorer, @/contexts/SnippetsContext
 * @public FolderExplorer
 */
import React from 'react';
import FolderCard from '@/components/dashboard/FolderCard/FolderCard';
import FolderNav from '@/components/dashboard/FolderNav/FolderNav';
import MoveFolderDialog from '@/components/dashboard/MoveFolderDialog/MoveFolderDialog';
import { useFolderExplorer } from './useFolderExplorer';
import { useSnippets } from '@/contexts/SnippetsContext';
import './FolderExplorer.css';

export default function FolderExplorer() {
  const {
    folders,
    snippets,
    handleCreateFolder: onCreateFolder,
    handleRenameFolder: onRenameFolder,
    handleDeleteFolder: onDeleteFolder,
    handleFolderColorChange: onFolderColorChange,
    handleViewFolderPrompts: onViewFolderPrompts,
    handleFolderReorder: onReorderFolders,
    handleMoveFolder: onMoveFolder,
  } = useSnippets();

  const {
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
    movingFolderId,
    openMoveDialog,
    closeMoveDialog,
  } = useFolderExplorer(folders, snippets);

  const handleDrop = async (targetId: string) => {
    const updates = computeReorder(targetId);
    handleDragEnd();
    if (updates) await onReorderFolders(updates);
  };

  return (
    <div className="folder-explorer">
      <div className="folder-explorer__header">
        <div>
          <h1 className="folder-explorer__heading">Folders</h1>
          <p className="folder-explorer__subheading">
            Organise your prompts with nested folders. Drag cards to reorder in grid view.
          </p>
        </div>
        <div className="folder-explorer__header-actions">
          <div className="folder-explorer__view-toggle">
            <button
              className={`folder-explorer__view-btn${viewMode === 'tree' ? ' folder-explorer__view-btn--active' : ''}`}
              onClick={() => setViewMode('tree')}
              title="Tree view"
            >
              ≡
            </button>
            <button
              className={`folder-explorer__view-btn${viewMode === 'grid' ? ' folder-explorer__view-btn--active' : ''}`}
              onClick={() => setViewMode('grid')}
              title="Grid view"
            >
              ⊞
            </button>
          </div>
        </div>
      </div>

      {sortedFolders.length === 0 && viewMode === 'grid' ? (
        <FolderNav
          folders={sortedFolders}
          selectedId={undefined}
          onSelect={() => {}}
          onCreateFolder={onCreateFolder}
          onRenameFolder={onRenameFolder}
          onDeleteFolder={onDeleteFolder}
          emptyMessage="No folders yet. Create one to organise your prompts."
        />
      ) : viewMode === 'tree' ? (
        <div className="folder-explorer__tree-wrap">
          <FolderNav
            folders={sortedFolders}
            selectedId={selectedTreeId}
            onSelect={setSelectedTreeId}
            snippetCountByFolder={snippetCountByFolder}
            onCreateFolder={onCreateFolder}
            onRenameFolder={onRenameFolder}
            onDeleteFolder={onDeleteFolder}
            onMoveFolder={openMoveDialog}
            emptyMessage="No folders yet. Create one to organise your prompts."
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
                  onMove={openMoveDialog}
                />
              </div>
            );
          })()}
        </div>
      ) : (
        <>
          <FolderNav
            folders={sortedFolders}
            selectedId={undefined}
            onSelect={() => {}}
            onCreateFolder={onCreateFolder}
            onRenameFolder={onRenameFolder}
            onDeleteFolder={onDeleteFolder}
            hideTree
          />
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
                  onMove={openMoveDialog}
                />
              </div>
            ))}
          </div>
        </>
      )}

      {movingFolderId && (
        <MoveFolderDialog
          folderId={movingFolderId}
          folders={folders}
          onMove={(newParentId) => onMoveFolder(movingFolderId, newParentId)}
          onClose={closeMoveDialog}
        />
      )}
    </div>
  );
}
