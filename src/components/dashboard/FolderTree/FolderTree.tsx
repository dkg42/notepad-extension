/**
 * @module FolderTree
 * @description Renders a recursive, collapsible folder tree with per-node snippet counts and a ⋯ dropdown for context-menu actions (new subfolder, rename, move, delete).
 * @dependencies @/types (Folder)
 * @public FolderTree
 */
import React, { useEffect, useState } from 'react';
import { Folder, MoreHorizontal } from 'lucide-react';
import type { Folder as FolderType } from '@/types';
import './FolderTree.css';

interface FolderTreeProps {
  folders: FolderType[];
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
  folder: FolderType;
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
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) return;
    const close = () => setMenuOpen(false);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [menuOpen]);

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
          <span className="folder-tree__icon">
            <Folder size={13} strokeWidth={1.5} />
          </span>
          <span className="folder-tree__name">{folder.name}</span>
          {count !== undefined && (
            <span className="folder-tree__count">{count}</span>
          )}
        </button>

        {hasActions && (
          <div className="folder-tree__menu-wrap" onClick={(e) => e.stopPropagation()}>
            <button
              className="folder-tree__more-btn"
              onClick={() => setMenuOpen((v) => !v)}
              title="More options"
            >
              <MoreHorizontal size={13} />
            </button>
            {menuOpen && (
              <div className="folder-tree__dropdown">
                {onCreateSubfolder && (
                  <button
                    className="folder-tree__dropdown-item"
                    onClick={() => { setMenuOpen(false); onCreateSubfolder(folder.id); }}
                  >
                    New subfolder
                  </button>
                )}
                {onRename && (
                  <button
                    className="folder-tree__dropdown-item"
                    onClick={() => { setMenuOpen(false); onRename(folder.id, folder.name); }}
                  >
                    Rename
                  </button>
                )}
                {onMove && (
                  <button
                    className="folder-tree__dropdown-item"
                    onClick={() => { setMenuOpen(false); onMove(folder.id); }}
                  >
                    Move to…
                  </button>
                )}
                {onDelete && (
                  <button
                    className="folder-tree__dropdown-item folder-tree__dropdown-item--danger"
                    onClick={() => { setMenuOpen(false); onDelete(folder.id); }}
                  >
                    Delete
                  </button>
                )}
              </div>
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
