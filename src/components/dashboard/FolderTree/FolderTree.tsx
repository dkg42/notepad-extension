import React from 'react';
import type { Folder } from '@/types';
import './FolderTree.css';

interface FolderTreeProps {
  folders: Folder[];
  parentId?: string;
  depth?: number;
  selectedId?: string;
  onSelect: (id: string) => void;
}

export default function FolderTree({
  folders,
  parentId,
  depth = 0,
  selectedId,
  onSelect,
}: FolderTreeProps) {
  const children = folders
    .filter((f) => f.parentId === parentId)
    .sort((a, b) => {
      const orderA = a.sortOrder ?? Infinity;
      const orderB = b.sortOrder ?? Infinity;
      if (orderA !== orderB) return orderA - orderB;
      return a.name.localeCompare(b.name);
    });

  if (children.length === 0) return null;

  return (
    <ul className="folder-tree" style={{ paddingLeft: depth > 0 ? 16 : 0 }}>
      {children.map((folder) => (
        <li key={folder.id} className="folder-tree__item">
          <button
            className={`folder-tree__btn${selectedId === folder.id ? ' folder-tree__btn--active' : ''}`}
            onClick={() => onSelect(folder.id)}
          >
            {folder.color && (
              <span className="folder-tree__dot" style={{ background: folder.color }} />
            )}
            <span className="folder-tree__icon">◫</span>
            <span className="folder-tree__name">{folder.name}</span>
          </button>
          <FolderTree
            folders={folders}
            parentId={folder.id}
            depth={depth + 1}
            selectedId={selectedId}
            onSelect={onSelect}
          />
        </li>
      ))}
    </ul>
  );
}
