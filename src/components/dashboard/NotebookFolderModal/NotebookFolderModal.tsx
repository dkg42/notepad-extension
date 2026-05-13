/**
 * @module NotebookFolderModal
 * @description Modal dialog for assigning one or more notebooks to a nested folder. Renders a FolderTree for selection and supports inline root-folder creation.
 * @dependencies @/types (Folder), @/components/dashboard/FolderTree/FolderTree
 * @public NotebookFolderModal
 */
import React, { useState } from 'react';
import type { Folder } from '@/types';
import FolderTree from '@/components/dashboard/FolderTree/FolderTree';
import './NotebookFolderModal.css';

interface NotebookFolderModalProps {
  folders: Folder[];
  currentFolderId: string | undefined;
  subjectLabel: string;
  onConfirm: (folderId: string | undefined) => void;
  onCreateFolder: (name: string, parentId?: string) => Promise<string>;
  onClose: () => void;
}

export default function NotebookFolderModal({
  folders,
  currentFolderId,
  subjectLabel,
  onConfirm,
  onCreateFolder,
  onClose,
}: NotebookFolderModalProps) {
  const [selected, setSelected] = useState<string | undefined>(currentFolderId);
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleCreateAndSelect() {
    const name = newName.trim();
    if (!name) return;
    setIsSubmitting(true);
    setCreateError(null);
    try {
      const id = await onCreateFolder(name);
      setSelected(id);
      setNewName('');
      setIsCreating(false);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create folder.');
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleConfirm() {
    onConfirm(selected);
    onClose();
  }

  return (
    <div
      className="notebook-folder-modal__overlay"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="notebook-folder-modal" role="dialog" aria-modal="true">
        <div className="notebook-folder-modal__header">
          <h2 className="notebook-folder-modal__title">Move to Folder</h2>
          <button className="notebook-folder-modal__close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <p className="notebook-folder-modal__subtitle">
          Select a folder for <strong>{subjectLabel}</strong>:
        </p>

        <div className="notebook-folder-modal__body">
          {/* None option */}
          <button
            className={`notebook-folder-modal__none-btn${selected === undefined ? ' notebook-folder-modal__none-btn--selected' : ''}`}
            onClick={() => setSelected(undefined)}
          >
            <span className="notebook-folder-modal__none-icon">○</span>
            <span className="notebook-folder-modal__none-label">None</span>
            <span className="notebook-folder-modal__none-hint">Remove from any folder</span>
          </button>

          {folders.length > 0 && (
            <div className="notebook-folder-modal__tree">
              <FolderTree
                folders={folders}
                selectedId={selected}
                onSelect={setSelected}
              />
            </div>
          )}

          {folders.length === 0 && !isCreating && (
            <p className="notebook-folder-modal__empty">No folders yet. Create one below.</p>
          )}
        </div>

        {/* New root folder creator */}
        <div className="notebook-folder-modal__new">
          {isCreating ? (
            <>
              <div className="notebook-folder-modal__new-row">
                <input
                  className="notebook-folder-modal__new-input"
                  autoFocus
                  placeholder="Folder name…"
                  value={newName}
                  onChange={(e) => { setNewName(e.target.value); setCreateError(null); }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void handleCreateAndSelect();
                    if (e.key === 'Escape') { setNewName(''); setIsCreating(false); }
                  }}
                  disabled={isSubmitting}
                />
                <button
                  className="notebook-folder-modal__new-confirm"
                  onClick={() => void handleCreateAndSelect()}
                  disabled={!newName.trim() || isSubmitting}
                >
                  Create
                </button>
                <button
                  className="notebook-folder-modal__new-cancel"
                  onClick={() => { setNewName(''); setIsCreating(false); setCreateError(null); }}
                >
                  Cancel
                </button>
              </div>
              {createError && <p className="notebook-folder-modal__new-error">{createError}</p>}
            </>
          ) : (
            <button className="notebook-folder-modal__new-btn" onClick={() => setIsCreating(true)}>
              + New folder
            </button>
          )}
        </div>

        <div className="notebook-folder-modal__footer">
          <button className="notebook-folder-modal__cancel-btn" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </button>
          <button
            className="notebook-folder-modal__confirm-btn"
            onClick={handleConfirm}
            disabled={isSubmitting || selected === currentFolderId}
          >
            Assign
          </button>
        </div>
      </div>
    </div>
  );
}
