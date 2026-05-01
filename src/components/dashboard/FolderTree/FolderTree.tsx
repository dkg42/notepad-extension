/**
 * @module FolderTree
 * @description Renders a recursive, collapsible folder tree with per-node snippet counts and optional context-menu actions for creating subfolders, renaming, deleting, or moving folders.
 * @dependencies @/types (Folder)
 * @public FolderTree
 */
import React, { useState } from 'react';
import type { Folder } from '@/types';
import './FolderTree.css';

interface FolderTreeProps {
  folders: Folder[];
  parentId?: string;
  depth?: number;
  selectedId?: string;
  onSelect: (id: string) => void;
  snippetCountByFolder?: Map<string, number>;
  onCreateSubfolder?: (parentId: string) => void;
  onRename?: (id: string, currentName: string) => void;
  onDelete?: (id: string) => void;
  onMove?: (id: string) => void;
  /** IDs that cannot be selected (used in Move dialog to disable invalid targets). */
  disabledIds?: Set<string>;
}

interface FolderTreeNodeProps extends Omit<FolderTreeProps, 'parentId' | 'depth'> {
  folder: Folder;
  depth: number;
}

function FolderTreeNode({
  folder,
  depth,
  folders,
  selectedId,
  onSelect,
  snippetCountByFolder,
  onCreateSubfolder,
  onRename,
  onDelete,
  onMove,
  disabledIds,
}: FolderTreeNodeProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  const children = folders
    .filter((f) => f.parentId === folder.id)
    .sort((a, b) => {
      const orderA = a.sortOrder ?? Infinity;
      const orderB = b.sortOrder ?? Infinity;
      if (orderA !== orderB) return orderA - orderB;
      return a.name.localeCompare(b.name);
    });

  const hasChildren = children.length > 0;
  const isDisabled = disabledIds?.has(folder.id) ?? false;
  const isSelected = selectedId === folder.id;
  const count = snippetCountByFolder?.get(folder.id);
  const hasActions = onCreateSubfolder ?? onRename ?? onDelete ?? onMove;

  return (
    <li className="folder-tree__item">
      <div className={`folder-tree__row${isSelected ? ' folder-tree__row--active' : ''}${isDisabled ? ' folder-tree__row--disabled' : ''}`}>
        <button
          className="folder-tree__toggle"
          onClick={() => setIsExpanded((v) => !v)}
          aria-label={isExpanded ? 'Collapse' : 'Expand'}
          style={{ visibility: hasChildren ? 'visible' : 'hidden' }}
        >
          {isExpanded ? '▾' : '▸'}
        </button>

        <button
          className="folder-tree__btn"
          onClick={() => !isDisabled && onSelect(folder.id)}
          disabled={isDisabled}
          title={folder.name}
        >
          {folder.color && (
            <span className="folder-tree__dot" style={{ background: folder.color }} />
          )}
          <span className="folder-tree__icon">◫</span>
          <span className="folder-tree__name">{folder.name}</span>
          {count !== undefined && (
            <span className="folder-tree__count">{count}</span>
          )}
        </button>

        {hasActions && (
          <div className="folder-tree__actions">
            {onCreateSubfolder && (
              <button
                className="folder-tree__action-btn"
                onClick={() => onCreateSubfolder(folder.id)}
                title="Add subfolder"
              >
                + Sub
              </button>
            )}
            {onRename && (
              <button
                className="folder-tree__action-btn"
                onClick={() => onRename(folder.id, folder.name)}
                title="Rename"
              >
                ✎
              </button>
            )}
            {onMove && (
              <button
                className="folder-tree__action-btn"
                onClick={() => onMove(folder.id)}
                title="Move to…"
              >
                ↪
              </button>
            )}
            {onDelete && (
              <button
                className="folder-tree__action-btn folder-tree__action-btn--danger"
                onClick={() => onDelete(folder.id)}
                title="Delete"
              >
                ✕
              </button>
            )}
          </div>
        )}
      </div>

      {isExpanded && hasChildren && (
        <FolderTree
          folders={folders}
          parentId={folder.id}
          depth={depth + 1}
          selectedId={selectedId}
          onSelect={onSelect}
          snippetCountByFolder={snippetCountByFolder}
          onCreateSubfolder={onCreateSubfolder}
          onRename={onRename}
          onDelete={onDelete}
          onMove={onMove}
          disabledIds={disabledIds}
        />
      )}
    </li>
  );
}

export default function FolderTree({
  folders,
  parentId,
  depth = 0,
  selectedId,
  onSelect,
  snippetCountByFolder,
  onCreateSubfolder,
  onRename,
  onDelete,
  onMove,
  disabledIds,
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
        <FolderTreeNode
          key={folder.id}
          folder={folder}
          depth={depth}
          folders={folders}
          selectedId={selectedId}
          onSelect={onSelect}
          snippetCountByFolder={snippetCountByFolder}
          onCreateSubfolder={onCreateSubfolder}
          onRename={onRename}
          onDelete={onDelete}
          onMove={onMove}
          disabledIds={disabledIds}
        />
      ))}
    </ul>
  );
}
