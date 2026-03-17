import React, { useEffect, useRef, useState } from 'react';
import type { Folder } from '@/types';
import { UNCATEGORIZED_ID } from '@/types';

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
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const toggle = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(next);
  };

  const hasOptions = folders.length > 0 || hasUncategorized;
  const label =
    selectedIds.size === 0
      ? 'All folders'
      : `${selectedIds.size} folder${selectedIds.size > 1 ? 's' : ''} selected`;

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={triggerStyle}
        disabled={!hasOptions}
        title={hasOptions ? 'Filter by folder' : 'No folders to filter by'}
      >
        <span>📁 {label}</span>
        <span style={{ marginLeft: 6, fontSize: 9 }}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div style={dropdownStyle}>
          {!hasOptions ? (
            <p style={emptyStyle}>No folders yet</p>
          ) : (
            <>
              {selectedIds.size > 0 && (
                <button
                  onClick={() => onChange(new Set())}
                  style={clearSelectionStyle}
                >
                  Clear filter
                </button>
              )}

              {hasUncategorized && (
                <label style={optionStyle}>
                  <input
                    type="checkbox"
                    checked={selectedIds.has(UNCATEGORIZED_ID)}
                    onChange={() => toggle(UNCATEGORIZED_ID)}
                  />
                  <span>Uncategorized</span>
                </label>
              )}

              {folders.map((f) => (
                <label key={f.id} style={optionStyle}>
                  <input
                    type="checkbox"
                    checked={selectedIds.has(f.id)}
                    onChange={() => toggle(f.id)}
                  />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {f.name}
                  </span>
                </label>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

const triggerStyle: React.CSSProperties = {
  width: '100%',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '5px 9px',
  fontSize: 12,
  border: '1px solid #d1d5db',
  borderRadius: 5,
  background: '#fff',
  cursor: 'pointer',
  color: '#374151',
  textAlign: 'left',
};

const dropdownStyle: React.CSSProperties = {
  position: 'absolute',
  top: 'calc(100% + 4px)',
  left: 0,
  right: 0,
  background: '#fff',
  border: '1px solid #e5e7eb',
  borderRadius: 6,
  boxShadow: '0 4px 16px rgba(0,0,0,0.10)',
  padding: '6px 0',
  zIndex: 100,
  maxHeight: 200,
  overflowY: 'auto',
};

const optionStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 7,
  padding: '4px 10px',
  fontSize: 12,
  color: '#374151',
  cursor: 'pointer',
  userSelect: 'none',
};

const clearSelectionStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  textAlign: 'left',
  padding: '3px 10px 6px',
  fontSize: 11,
  color: '#7c3aed',
  background: 'none',
  border: 'none',
  borderBottom: '1px solid #f3f4f6',
  cursor: 'pointer',
  marginBottom: 2,
};

const emptyStyle: React.CSSProperties = {
  fontSize: 12,
  color: '#9ca3af',
  margin: 0,
  padding: '6px 10px',
};