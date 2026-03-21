import React from 'react';
import type { Folder } from '@/types';
import { useBulkActionsBar } from './useBulkActionsBar';
import './BulkActionsBar.css';

interface BulkActionsBarProps {
  selectedCount: number;
  folders: Folder[];
  onDelete: () => void;
  onMoveToFolder: (folderId: string | undefined) => void;
  onAddTags: (tags: string[]) => void;
  onClearSelection: () => void;
}

export default function BulkActionsBar({
  selectedCount,
  folders,
  onDelete,
  onMoveToFolder,
  onAddTags,
  onClearSelection,
}: BulkActionsBarProps) {
  const {
    showFolderPicker,
    showTagInput,
    tagInput,
    setTagInput,
    handleMoveToFolder,
    handleAddTags,
    toggleFolderPicker,
    toggleTagInput,
  } = useBulkActionsBar(onMoveToFolder, onAddTags);

  return (
    <div className="bulk-actions-bar">
      <span className="bulk-actions-bar__count">{selectedCount} selected</span>

      <div className="bulk-actions-bar__actions">
        <button
          className="bulk-actions-bar__btn bulk-actions-bar__btn--danger"
          onClick={onDelete}
        >
          Delete
        </button>

        <div className="bulk-actions-bar__picker-wrap">
          <button className="bulk-actions-bar__btn" onClick={toggleFolderPicker}>
            Move to Folder ▾
          </button>
          {showFolderPicker && (
            <div className="bulk-actions-bar__dropdown">
              <button
                className="bulk-actions-bar__dropdown-item"
                onClick={() => handleMoveToFolder(undefined)}
              >
                Remove from folder
              </button>
              {folders.map((f) => (
                <button
                  key={f.id}
                  className="bulk-actions-bar__dropdown-item"
                  onClick={() => handleMoveToFolder(f.id)}
                >
                  {f.color && (
                    <span
                      className="bulk-actions-bar__folder-dot"
                      style={{ background: f.color }}
                    />
                  )}
                  {f.name}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="bulk-actions-bar__picker-wrap">
          <button className="bulk-actions-bar__btn" onClick={toggleTagInput}>
            Add Tags ▾
          </button>
          {showTagInput && (
            <div className="bulk-actions-bar__tag-input-wrap">
              <input
                className="bulk-actions-bar__tag-input"
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                placeholder="tag1, tag2…"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddTags(tagInput);
                  if (e.key === 'Escape') toggleTagInput();
                }}
                autoFocus
              />
              <button
                className="bulk-actions-bar__btn bulk-actions-bar__btn--primary"
                onClick={() => handleAddTags(tagInput)}
              >
                Add
              </button>
            </div>
          )}
        </div>
      </div>

      <button
        className="bulk-actions-bar__clear"
        onClick={onClearSelection}
        title="Clear selection"
      >
        ✕
      </button>
    </div>
  );
}
