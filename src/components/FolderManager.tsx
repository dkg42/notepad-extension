import React, { useState } from 'react';
import type { Folder } from '@/types';

interface Props {
  folders: Folder[];
  onCreateFolder: (name: string) => Promise<void>;
  onRenameFolder: (id: string, name: string) => Promise<void>;
  onDeleteFolder: (id: string) => Promise<void>;
}

export default function FolderManager({
  folders,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const handleCreate = async () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    await onCreateFolder(trimmed);
    setNewName('');
  };

  const handleRename = async (id: string) => {
    const trimmed = editName.trim();
    if (!trimmed) return;
    await onRenameFolder(id, trimmed);
    setEditingId(null);
    setEditName('');
  };

  const startEdit = (folder: Folder) => {
    setEditingId(folder.id);
    setEditName(folder.name);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName('');
  };

  return (
    <div style={containerStyle}>
      <button onClick={() => setIsOpen((o) => !o)} style={toggleStyle}>
        <span>Folders ({folders.length})</span>
        <span style={{ fontSize: 9 }}>{isOpen ? '▲' : '▼'}</span>
      </button>

      {isOpen && (
        <div style={panelStyle}>
          {/* New folder row */}
          <div style={rowStyle}>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              placeholder="New folder name..."
              style={inputStyle}
            />
            <button
              onClick={handleCreate}
              disabled={!newName.trim()}
              style={addBtnStyle}
            >
              + Add
            </button>
          </div>

          {/* Folder list */}
          {folders.map((folder) => (
            <div key={folder.id} style={folderRowStyle}>
              {editingId === folder.id ? (
                <>
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleRename(folder.id);
                      if (e.key === 'Escape') cancelEdit();
                    }}
                    style={{ ...inputStyle, flex: 1 }}
                    autoFocus
                  />
                  <button onClick={() => handleRename(folder.id)} style={iconBtn('#16a34a')}>
                    ✓
                  </button>
                  <button onClick={cancelEdit} style={iconBtn('#6b7280')}>
                    ✕
                  </button>
                </>
              ) : (
                <>
                  <span style={folderNameStyle} title={folder.name}>
                    📁 {folder.name}
                  </span>
                  <button onClick={() => startEdit(folder)} style={iconBtn('#2563eb')} title="Rename">
                    ✏
                  </button>
                  <button
                    onClick={() => onDeleteFolder(folder.id)}
                    style={iconBtn('#ef4444')}
                    title="Delete folder"
                  >
                    🗑
                  </button>
                </>
              )}
            </div>
          ))}

          {folders.length === 0 && (
            <p style={{ fontSize: 11, color: '#9ca3af', margin: '4px 0 0' }}>
              No folders yet. Add one above.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

const containerStyle: React.CSSProperties = {
  marginBottom: 8,
};

const toggleStyle: React.CSSProperties = {
  width: '100%',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '5px 9px',
  fontSize: 12,
  fontWeight: 500,
  border: '1px solid #d1d5db',
  borderRadius: 5,
  background: '#f9fafb',
  cursor: 'pointer',
  color: '#374151',
  textAlign: 'left',
};

const panelStyle: React.CSSProperties = {
  border: '1px solid #e5e7eb',
  borderTop: 'none',
  borderRadius: '0 0 5px 5px',
  padding: '8px 8px 6px',
  background: '#fff',
};

const rowStyle: React.CSSProperties = {
  display: 'flex',
  gap: 6,
  marginBottom: 6,
};

const inputStyle: React.CSSProperties = {
  flex: 1,
  border: '1px solid #d1d5db',
  borderRadius: 4,
  padding: '3px 7px',
  fontSize: 12,
  outline: 'none',
  fontFamily: 'inherit',
};

const addBtnStyle: React.CSSProperties = {
  fontSize: 11,
  padding: '2px 8px',
  background: '#7c3aed',
  color: '#fff',
  border: 'none',
  borderRadius: 4,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
};

const folderRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  padding: '2px 0',
};

const folderNameStyle: React.CSSProperties = {
  flex: 1,
  fontSize: 12,
  color: '#374151',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const iconBtn = (color: string): React.CSSProperties => ({
  fontSize: 11,
  padding: '1px 5px',
  color,
  background: 'none',
  border: `1px solid ${color}`,
  borderRadius: 3,
  cursor: 'pointer',
  flexShrink: 0,
});