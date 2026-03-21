import React, { useState } from 'react';
import type { TagMeta } from '@/types';
import ColorPicker from '@/components/dashboard/ColorPicker/ColorPicker';
import './TagCard.css';

interface TagCardProps {
  tag: TagMeta;
  usageCount: number;
  onRename: (oldName: string, newName: string) => void;
  onDelete: (name: string) => void;
  onColorChange: (name: string, color: string | undefined) => void;
}

export default function TagCard({ tag, usageCount, onRename, onDelete, onColorChange }: TagCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(tag.name);
  const [showColorPicker, setShowColorPicker] = useState(false);

  const handleRename = () => {
    const trimmed = editName.trim();
    if (trimmed && trimmed !== tag.name) {
      onRename(tag.name, trimmed);
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleRename();
    if (e.key === 'Escape') {
      setEditName(tag.name);
      setIsEditing(false);
    }
  };

  return (
    <div className="tag-card">
      <div className="tag-card__header">
        {tag.color && (
          <span className="tag-card__dot" style={{ background: tag.color }} />
        )}
        {isEditing ? (
          <input
            className="tag-card__edit-input"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onBlur={handleRename}
            onKeyDown={handleKeyDown}
            autoFocus
          />
        ) : (
          <span
            className="tag-card__name"
            style={tag.color ? { color: tag.color } : undefined}
          >
            {tag.name}
          </span>
        )}
        <span className="tag-card__count">{usageCount}</span>
      </div>

      {showColorPicker && (
        <div className="tag-card__color-picker">
          <ColorPicker
            value={tag.color}
            onChange={(color) => {
              onColorChange(tag.name, color);
              setShowColorPicker(false);
            }}
          />
        </div>
      )}

      <div className="tag-card__actions">
        <button
          className="tag-card__action-btn"
          onClick={() => {
            setEditName(tag.name);
            setIsEditing(true);
          }}
        >
          Rename
        </button>
        <button
          className="tag-card__action-btn"
          onClick={() => setShowColorPicker((v) => !v)}
        >
          Color
        </button>
        <button
          className="tag-card__action-btn tag-card__action-btn--danger"
          onClick={() => onDelete(tag.name)}
        >
          Delete
        </button>
      </div>
    </div>
  );
}
