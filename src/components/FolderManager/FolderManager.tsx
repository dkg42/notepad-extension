import React from 'react';
import type { Folder } from '@/types';
import { useFolderManager } from './useFolderManager';
import './FolderManager.css';

interface Props {
  folders: Folder[];
  onCreateFolder: (name: string) => Promise<void>;
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
    handleNewNameChange,
    handleEditNameChange,
    handleCreate,
    handleRename,
    startEdit,
    cancelEdit,
  } = useFolderManager({ onCreateFolder, onRenameFolder, onDeleteFolder });

  return (
    <div className="folder-manager">
      <button onClick={() => setIsOpen((o) => !o)} className="folder-manager__toggle">
        <span>Folders ({folders.length})</span>
        <span className="folder-manager__toggle-arrow">{isOpen ? '▲' : '▼'}</span>
      </button>

      {isOpen && (
        <div className="folder-manager__panel">
          <div className="folder-manager__new-row">
            <input
              value={newName}
              onChange={(e) => handleNewNameChange(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              placeholder="New folder name..."
              className={`folder-manager__input${createError ? ' folder-manager__input--error' : ''}`}
            />
            <button
              onClick={handleCreate}
              disabled={!newName.trim()}
              className="folder-manager__add-btn"
            >
              + Add
            </button>
          </div>
          {createError && <p className="folder-manager__error">{createError}</p>}

          {folders.map((folder) => (
            <div key={folder.id}>
              {editingId === folder.id ? (
                <>
                  <div className="folder-manager__folder-row">
                    <input
                      value={editName}
                      onChange={(e) => handleEditNameChange(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRename(folder.id);
                        if (e.key === 'Escape') cancelEdit();
                      }}
                      className={`folder-manager__input${editError ? ' folder-manager__input--error' : ''}`}
                      autoFocus
                    />
                    <button
                      onClick={() => handleRename(folder.id)}
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
                    📁 {folder.name}
                  </span>
                  <button
                    onClick={() => startEdit(folder)}
                    className="folder-manager__icon-btn folder-manager__icon-btn--rename"
                    title="Rename"
                  >
                    ✏
                  </button>
                  <button
                    onClick={() => onDeleteFolder(folder.id)}
                    className="folder-manager__icon-btn folder-manager__icon-btn--delete"
                    title="Delete folder"
                  >
                    🗑
                  </button>
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
