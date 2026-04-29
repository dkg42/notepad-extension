import React from 'react';
import type { Folder } from '@/types';
import { UNCATEGORIZED_ID } from '@/types';
import { getFolderTreeItems } from '@/utils/folder-utils';
import { useFolderFilterDropdown } from './useFolderFilterDropdown';
import './FolderFilterDropdown.css';

interface Props {
  folders: Folder[];
  hasUncategorized: boolean;
  selectedIds: Set<string>;
  onChange: (ids: Set<string>) => void;
}

export default function FolderFilterDropdown({
  folders,
  hasUncategorized,
  selectedIds,
  onChange,
}: Props) {
  const { open, setOpen, ref, handleToggle } = useFolderFilterDropdown(selectedIds, onChange);

  const hasOptions = folders.length > 0 || hasUncategorized;
  const label =
    selectedIds.size === 0
      ? 'All folders'
      : `${selectedIds.size} folder${selectedIds.size > 1 ? 's' : ''} selected`;

  const treeItems = getFolderTreeItems(folders);

  return (
    <div ref={ref} className="folder-filter">
      <button
        onClick={() => setOpen((o) => !o)}
        className="folder-filter__trigger"
        disabled={!hasOptions}
        title={hasOptions ? 'Filter by folder' : 'No folders to filter by'}
      >
        <span>📁 {label}</span>
        <span className="folder-filter__trigger-arrow">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="folder-filter__dropdown">
          {!hasOptions ? (
            <p className="folder-filter__empty">No folders yet</p>
          ) : (
            <>
              {selectedIds.size > 0 && (
                <button onClick={() => onChange(new Set())} className="folder-filter__clear-btn">
                  Clear filter
                </button>
              )}

              {hasUncategorized && (
                <label className="folder-filter__option">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(UNCATEGORIZED_ID)}
                    onChange={() => handleToggle(UNCATEGORIZED_ID)}
                  />
                  <span>Uncategorized</span>
                </label>
              )}

              {treeItems.map(({ folder, depth }) => (
                <label
                  key={folder.id}
                  className="folder-filter__option"
                  style={{ paddingLeft: 10 + depth * 14 }}
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.has(folder.id)}
                    onChange={() => handleToggle(folder.id)}
                  />
                  {folder.color && (
                    <span
                      className="folder-filter__dot"
                      style={{ background: folder.color }}
                    />
                  )}
                  <span>{folder.name}</span>
                </label>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
