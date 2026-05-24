/**
 * @module NotebookFolderModal
 * @description Modal dialog for assigning one or more notebooks to a nested folder. Uses the shared FolderNav for tree selection and inline root-folder creation.
 * @dependencies @/types, @/components/dashboard/FolderNav/FolderNav
 * @public NotebookFolderModal
 */
import React, { useState } from 'react';
import type { Folder } from '@/types';
import FolderNav from '@/components/dashboard/FolderNav/FolderNav';
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
  const [isSubmitting, setIsSubmitting] = useState(false);

  function handleConfirm() {
    onConfirm(selected);
    onClose();
  }

  async function handleCreateAndSelect(name: string, parentId?: string): Promise<string> {
    setIsSubmitting(true);
    try {
      const id = await onCreateFolder(name, parentId);
      setSelected(id);
      return id;
    } finally {
      setIsSubmitting(false);
    }
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
          <FolderNav
            folders={folders}
            selectedId={selected}
            onSelect={setSelected}
            onCreateFolder={handleCreateAndSelect}
            emptyMessage="No folders yet. Create one with + above."
            topSlot={
              <button
                className={`notebook-folder-modal__none-btn${selected === undefined ? ' notebook-folder-modal__none-btn--selected' : ''}`}
                onClick={() => setSelected(undefined)}
              >
                <span className="notebook-folder-modal__none-icon">○</span>
                <span className="notebook-folder-modal__none-label">None</span>
                <span className="notebook-folder-modal__none-hint">Remove from any folder</span>
              </button>
            }
          />
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
