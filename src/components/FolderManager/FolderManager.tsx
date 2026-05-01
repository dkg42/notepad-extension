/**
 * @module FolderManager
 * @description Renders a collapsible panel for creating, renaming, deleting, and nesting folders — each row supports inline edit and subfolder creation forms.
 * @dependencies @/types, @/utils/folder-utils, ./useFolderManager
 * @public FolderManager
 */
import React from 'react';
import type { Folder } from '@/types';
import { getFolderTreeItems } from '@/utils/folder-utils';
import { useFolderManager } from './useFolderManager';
import './FolderManager.css';

interface Props {
  folders: Folder[];
  onCreateFolder: (name: string, parentId?: string) => Promise<void>;
  onRenameFolder: (id: string, name: string) => Promise<void>;
  onDeleteFolder: (id: string) => Promise<void>;
}

export default function FolderManager({
  folders,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
}: Props) {
  const {
    isOpen,
    setIsOpen,
    newName,
    createError,
    editingId,
    editName,
    editError,
    subfolderParentId,
    subfolderName,
    subfolderError,
    handleNewNameChange,
    handleEditNameChange,
    handleCreate,
    handleRename,
    startEdit,
    cancelEdit,
    startCreatingSubfolder,
    cancelSubfolder,
    setSubfolderName,
    setSubfolderError,
    handleCreateSubfolder,
  } = useFolderManager({ onCreateFolder, onRenameFolder, onDeleteFolder });

  const treeItems = getFolderTreeItems(folders);

  return (
    <div className="folder-manager">
      <button onClick={() => setIsOpen((o) => !o)} className="folder-manager__toggle">
        <span>Folders ({folders.length})</span>
        <span className="folder-manager__toggle-arrow">{isOpen ? '▲' : '▼'}</span>
      </button>

      {isOpen && (
        <div className="folder-manager__panel">
          {/* Root folder creation */}
          <div className="folder-manager__new-row">
            <input
              value={newName}
              onChange={(e) => handleNewNameChange(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void handleCreate()}
              placeholder="New folder name..."
              className={`folder-manager__input${createError ? ' folder-manager__input--error' : ''}`}
            />
            <button
              onClick={() => void handleCreate()}
              disabled={!newName.trim()}
              className="folder-manager__add-btn"
            >
              + Add
            </button>
          </div>
          {createError && <p className="folder-manager__error">{createError}</p>}

          {treeItems.map(({ folder, depth }) => (
            <div key={folder.id} style={{ paddingLeft: depth * 14 }}>
              {editingId === folder.id ? (
                <>
                  <div className="folder-manager__folder-row">
                    <input
                      value={editName}
                      onChange={(e) => handleEditNameChange(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') void handleRename(folder.id);
                        if (e.key === 'Escape') cancelEdit();
                      }}
                      className={`folder-manager__input${editError ? ' folder-manager__input--error' : ''}`}
                      autoFocus
                    />
                    <button
                      onClick={() => void handleRename(folder.id)}
                      className="folder-manager__icon-btn folder-manager__icon-btn--confirm"
                    >
                      ✓
                    </button>
                    <button
                      onClick={cancelEdit}
                      className="folder-manager__icon-btn folder-manager__icon-btn--cancel"
                    >
                      ✕
                    </button>
                  </div>
                  {editError && <p className="folder-manager__error">{editError}</p>}
                </>
              ) : (
                <div className="folder-manager__folder-row">
                  <span className="folder-manager__folder-name" title={folder.name}>
                    {depth > 0 ? '└ ' : '📁 '}{folder.name}
                  </span>
                  <button
                    onClick={() => startCreatingSubfolder(folder.id)}
                    className="folder-manager__icon-btn folder-manager__icon-btn--sub"
                    title="Add subfolder"
                  >
                    +
                  </button>
                  <button
                    onClick={() => startEdit(folder)}
                    className="folder-manager__icon-btn folder-manager__icon-btn--rename"
                    title="Rename"
                  >
                    ✏
                  </button>
                  <button
                    onClick={() => void onDeleteFolder(folder.id)}
                    className="folder-manager__icon-btn folder-manager__icon-btn--delete"
                    title="Delete folder"
                  >
                    🗑
                  </button>
                </div>
              )}

              {/* Inline subfolder creation form, shown directly under the parent */}
              {subfolderParentId === folder.id && (
                <div className="folder-manager__subfolder-form">
                  <input
                    value={subfolderName}
                    onChange={(e) => {
                      setSubfolderName(e.target.value);
                      setSubfolderError(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void handleCreateSubfolder();
                      if (e.key === 'Escape') cancelSubfolder();
                    }}
                    placeholder="Subfolder name..."
                    className={`folder-manager__input${subfolderError ? ' folder-manager__input--error' : ''}`}
                    autoFocus
                  />
                  <button
                    onClick={() => void handleCreateSubfolder()}
                    disabled={!subfolderName.trim()}
                    className="folder-manager__add-btn"
                  >
                    Add
                  </button>
                  <button
                    onClick={cancelSubfolder}
                    className="folder-manager__icon-btn folder-manager__icon-btn--cancel"
                  >
                    ✕
                  </button>
                  {subfolderError && <p className="folder-manager__error">{subfolderError}</p>}
                </div>
              )}
            </div>
          ))}

          {folders.length === 0 && (
            <p className="folder-manager__empty">No folders yet. Add one above.</p>
          )}
        </div>
      )}
    </div>
  );
}
