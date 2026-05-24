/**
 * @module FolderNav
 * @description Single source of truth for folder management UX. Wraps FolderTree with the inline create/rename/subfolder forms and the "+ new folder" trigger. Used by every page that manages folders.
 * @dependencies @/types, @/components/dashboard/FolderTree/FolderTree, ./useFolderNav
 * @public FolderNav
 */
import React from 'react';
import type { Folder } from '@/types';
import FolderTree from '@/components/dashboard/FolderTree/FolderTree';
import { useFolderNav } from './useFolderNav';
import './FolderNav.css';

export interface FolderNavProps {
  folders: Folder[];
  selectedId?: string;
  onSelect: (id: string) => void;
  snippetCountByFolder?: Map<string, number>;
  /** Show "+ new folder" trigger and subfolder creation via ⋯ menu. */
  onCreateFolder?: (name: string, parentId?: string) => Promise<unknown> | unknown;
  /** Show "Rename" in the ⋯ menu. */
  onRenameFolder?: (id: string, name: string) => Promise<unknown> | unknown;
  /** Show "Delete" in the ⋯ menu. */
  onDeleteFolder?: (id: string) => Promise<unknown> | unknown;
  /** Show "Move to…" in the ⋯ menu. */
  onMoveFolder?: (id: string) => void;
  disabledIds?: Set<string>;
  /** Content rendered above the tree (e.g. "All / Favorites" virtual rows). */
  topSlot?: React.ReactNode;
  /** Show the section header with label + add button. Defaults to true when onCreateFolder is provided. */
  showHeader?: boolean;
  /** Header label (default: "Folders"). */
  headerLabel?: string;
  /** Empty-state message when there are no folders. */
  emptyMessage?: string;
  /** Hide the tree rendering (still shows header + inline forms). Use when another view (e.g. card grid) replaces the tree. */
  hideTree?: boolean;
}

export default function FolderNav({
  folders,
  selectedId,
  onSelect,
  snippetCountByFolder,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  onMoveFolder,
  disabledIds,
  topSlot,
  showHeader,
  headerLabel = 'Folders',
  emptyMessage,
  hideTree,
}: FolderNavProps) {
  const nav = useFolderNav({ onCreateFolder, onRenameFolder });
  const headerVisible = showHeader ?? Boolean(onCreateFolder);

  // Tree action callbacks: surface only those the parent enabled.
  const treeCreate = onCreateFolder ? nav.startCreatingSubfolder : undefined;
  const treeRename = onRenameFolder ? nav.startRenaming : undefined;
  const treeDelete = onDeleteFolder ? (id: string) => void onDeleteFolder(id) : undefined;
  const treeMove = onMoveFolder;

  return (
    <div className="folder-nav">
      {headerVisible && (
        <div className="folder-nav__header">
          <span className="folder-nav__label">{headerLabel}</span>
          {onCreateFolder && (
            <button
              className="folder-nav__add-btn"
              onClick={nav.startCreatingRoot}
              title="New folder"
            >
              +
            </button>
          )}
        </div>
      )}

      <div className="folder-nav__body">
        {topSlot}

        {folders.length > 0 && !hideTree && (
          <div className="folder-nav__tree-wrap">
            <FolderTree
              folders={folders}
              selectedId={selectedId}
              onSelect={onSelect}
              snippetCountByFolder={snippetCountByFolder}
              onCreateSubfolder={treeCreate}
              onRename={treeRename}
              onDelete={treeDelete}
              onMove={treeMove}
              disabledIds={disabledIds}
            />
          </div>
        )}

        {nav.creatingSubParentId && (
          <div className="folder-nav__inline-form">
            <span className="folder-nav__inline-label">
              Inside &quot;{folders.find((f) => f.id === nav.creatingSubParentId)?.name}&quot;:
            </span>
            <input
              className="folder-nav__inline-input"
              autoFocus
              placeholder="Subfolder name…"
              value={nav.newSubName}
              onChange={(e) => { nav.setNewSubName(e.target.value); nav.setSubError(''); }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void nav.confirmCreateSubfolder();
                if (e.key === 'Escape') nav.cancelCreatingSubfolder();
              }}
            />
            <div className="folder-nav__inline-actions">
              <button className="folder-nav__inline-confirm" onClick={() => void nav.confirmCreateSubfolder()}>Create</button>
              <button className="folder-nav__inline-cancel" onClick={nav.cancelCreatingSubfolder}>Cancel</button>
            </div>
            {nav.subError && <p className="folder-nav__inline-error">{nav.subError}</p>}
          </div>
        )}

        {nav.renamingId && (
          <div className="folder-nav__inline-form">
            <span className="folder-nav__inline-label">Rename folder:</span>
            <input
              className="folder-nav__inline-input"
              autoFocus
              value={nav.renameValue}
              onChange={(e) => { nav.setRenameValue(e.target.value); nav.setRenameError(''); }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void nav.confirmRename();
                if (e.key === 'Escape') nav.cancelRenaming();
              }}
            />
            <div className="folder-nav__inline-actions">
              <button className="folder-nav__inline-confirm" onClick={() => void nav.confirmRename()}>Rename</button>
              <button className="folder-nav__inline-cancel" onClick={nav.cancelRenaming}>Cancel</button>
            </div>
            {nav.renameError && <p className="folder-nav__inline-error">{nav.renameError}</p>}
          </div>
        )}

        {nav.isCreatingRoot && (
          <div className="folder-nav__inline-form">
            <input
              className="folder-nav__inline-input"
              autoFocus
              placeholder="Folder name…"
              value={nav.newRootName}
              onChange={(e) => { nav.setNewRootName(e.target.value); nav.setRootError(''); }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void nav.confirmCreateRoot();
                if (e.key === 'Escape') nav.cancelCreatingRoot();
              }}
            />
            <div className="folder-nav__inline-actions">
              <button className="folder-nav__inline-confirm" onClick={() => void nav.confirmCreateRoot()}>Create</button>
              <button className="folder-nav__inline-cancel" onClick={nav.cancelCreatingRoot}>Cancel</button>
            </div>
            {nav.rootError && <p className="folder-nav__inline-error">{nav.rootError}</p>}
          </div>
        )}

        {folders.length === 0 && !nav.isCreatingRoot && emptyMessage && (
          <p className="folder-nav__empty">{emptyMessage}</p>
        )}
      </div>
    </div>
  );
}
