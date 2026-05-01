/**
 * @module MoveFolderDialog
 * @description Modal dialog that lets the user pick a destination for moving a folder — renders a root option and a full folder tree with disabled self/descendant nodes.
 * @dependencies @/types, @/components/dashboard/FolderTree/FolderTree, ./useMoveFolderDialog
 * @public MoveFolderDialog
 */
import React from 'react';
import type { Folder } from '@/types';
import FolderTree from '@/components/dashboard/FolderTree/FolderTree';
import { useMoveFolderDialog } from './useMoveFolderDialog';
import './MoveFolderDialog.css';

interface MoveFolderDialogProps {
  folderId: string;
  folders: Folder[];
  onMove: (newParentId: string | undefined) => void;
  onClose: () => void;
}

export default function MoveFolderDialog({
  folderId,
  folders,
  onMove,
  onClose,
}: MoveFolderDialogProps) {
  const { selectedDestId, setSelectedDestId, disabledIds } = useMoveFolderDialog(folderId, folders);

  const folderName = folders.find((f) => f.id === folderId)?.name ?? 'folder';

  const handleConfirm = () => {
    onMove(selectedDestId);
    onClose();
  };

  return (
    <div className="move-folder-dialog__overlay" onClick={onClose}>
      <div className="move-folder-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="move-folder-dialog__header">
          <h2 className="move-folder-dialog__title">Move "{folderName}" to…</h2>
          <button className="move-folder-dialog__close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="move-folder-dialog__body">
          <label
            className={`move-folder-dialog__root-option${selectedDestId === undefined ? ' move-folder-dialog__root-option--active' : ''}`}
          >
            <input
              type="radio"
              name="move-dest"
              checked={selectedDestId === undefined}
              onChange={() => setSelectedDestId(undefined)}
            />
            <span>◫</span>
            <span>Root (no parent)</span>
          </label>

          {folders.length > 0 && (
            <div className="move-folder-dialog__tree">
              <FolderTree
                folders={folders}
                selectedId={selectedDestId}
                onSelect={(id) => setSelectedDestId(id)}
                disabledIds={disabledIds}
              />
            </div>
          )}
        </div>

        <div className="move-folder-dialog__footer">
          <button className="move-folder-dialog__cancel-btn" onClick={onClose}>
            Cancel
          </button>
          <button className="move-folder-dialog__confirm-btn" onClick={handleConfirm}>
            Move here
          </button>
        </div>
      </div>
    </div>
  );
}
