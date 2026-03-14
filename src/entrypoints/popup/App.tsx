import React, { useEffect, useState } from 'react';
import type { Snippet } from '@/types';
import { storageService } from '@/services/storage-service';
import SnippetList from '@/components/SnippetList';

export default function App() {
  const [snippets, setSnippets] = useState<Snippet[]>([]);

  useEffect(() => {
    storageService.getAll().then(setSnippets);
  }, []);

  const handleDelete = async (id: string) => {
    await storageService.remove(id);
    setSnippets((prev) => prev.filter((s) => s.id !== id));
  };

  const handleClear = async () => {
    await storageService.clear();
    setSnippets([]);
  };

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Saved Snippets</h2>
        {snippets.length > 0 && (
          <button onClick={handleClear} style={clearBtnStyle}>
            Clear all
          </button>
        )}
      </div>
      <SnippetList snippets={snippets} onDelete={handleDelete} />
    </div>
  );
}

const containerStyle: React.CSSProperties = {
  width: 380,
  fontFamily: 'system-ui, -apple-system, sans-serif',
  padding: '12px 14px',
  boxSizing: 'border-box',
};

const headerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: 10,
};

const clearBtnStyle: React.CSSProperties = {
  fontSize: 12,
  color: '#ef4444',
  background: 'none',
  border: '1px solid #ef4444',
  borderRadius: 4,
  padding: '2px 8px',
  cursor: 'pointer',
};
