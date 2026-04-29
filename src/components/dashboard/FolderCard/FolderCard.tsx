import React, { useState } from 'react';
import type { Folder } from '@/types';
import ColorPicker from '@/components/dashboard/ColorPicker/ColorPicker';
import './FolderCard.css';

interface FolderCardProps {
  folder: Folder;
  snippetCount: number;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onColorChange: (id: string, color: string | undefined) => void;
  onViewPrompts: (folderId: string) => void;
  onMove?: (id: string) => void;
}

export default function FolderCard({
  folder,
  snippetCount,
  onRename,
  onDelete,
  onColorChange,
  onViewPrompts,
  onMove,
}: FolderCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(folder.name);
  const [showColorPicker, setShowColorPicker] = useState(false);

  const handleRename = () => {
    const trimmed = editName.trim();
    if (trimmed && trimmed !== folder.name) {
      onRename(folder.id, trimmed);
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleRename();
    if (e.key === 'Escape') {
      setEditName(folder.name);
      setIsEditing(false);
    }
  };

  return (
    <div className="folder-card">
      <div className="folder-card__header">
        <div className="folder-card__icon-wrap">
          {folder.color ? (
            <span className="folder-card__dot" style={{ background: folder.color }} />
          ) : (
            <span className="folder-card__icon">◫</span>
          )}
        </div>

        <div className="folder-card__info">
          {isEditing ? (
            <input
              className="folder-card__edit-input"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onBlur={handleRename}
              onKeyDown={handleKeyDown}
              autoFocus
            />
          ) : (
            <span className="folder-card__name" title={folder.name}>
              {folder.name}
            </span>
          )}
          <span className="folder-card__count">
            {snippetCount} prompt{snippetCount !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {showColorPicker && (
        <div className="folder-card__color-picker">
          <ColorPicker
            value={folder.color}
            onChange={(color) => {
              onColorChange(folder.id, color);
              setShowColorPicker(false);
            }}
          />
        </div>
      )}

      <div className="folder-card__actions">
        <button
          className="folder-card__action-btn"
          onClick={() => onViewPrompts(folder.id)}
          title="View prompts"
        >
          View
        </button>
        <button
          className="folder-card__action-btn"
          onClick={() => {
            setEditName(folder.name);
            setIsEditing(true);
          }}
          title="Rename folder"
        >
          Rename
        </button>
        <button
          className="folder-card__action-btn"
          onClick={() => setShowColorPicker((v) => !v)}
          title="Change color"
        >
          Color
        </button>
        {onMove && (
          <button
            className="folder-card__action-btn"
            onClick={() => onMove(folder.id)}
            title="Move to…"
          >
            Move
          </button>
        )}
        <button
          className="folder-card__action-btn folder-card__action-btn--danger"
          onClick={() => onDelete(folder.id)}
          title="Delete folder"
        >
          Delete
        </button>
      </div>
    </div>
  );
}
