import React, { useState } from 'react';
import type { Snippet } from '@/types';

interface Props {
  snippet: Snippet;
  folderName?: string;
  onDelete: (id: string) => void;
}

const MAX_PREVIEW_LENGTH = 200;

export default function SnippetItem({ snippet, folderName, onDelete }: Props) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(snippet.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const sourceLabel = parseHostname(snippet.source);
  const preview =
    snippet.text.length > MAX_PREVIEW_LENGTH
      ? snippet.text.slice(0, MAX_PREVIEW_LENGTH) + '…'
      : snippet.text;

  return (
    <li style={itemStyle}>
      {folderName && (
        <span style={folderBadgeStyle} title={`Folder: ${folderName}`}>
          📁 {folderName}
        </span>
      )}
      <p style={textStyle}>{preview}</p>
      <div style={footerStyle}>
        <span style={metaStyle}>
          {sourceLabel} · {new Date(snippet.savedAt).toLocaleTimeString()}
        </span>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={handleCopy} style={actionBtn('#2563eb')}>
            {copied ? 'Copied!' : 'Copy'}
          </button>
          <button onClick={() => onDelete(snippet.id)} style={actionBtn('#ef4444')}>
            Delete
          </button>
        </div>
      </div>
    </li>
  );
}

function parseHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

const itemStyle: React.CSSProperties = {
  background: '#f9fafb',
  border: '1px solid #e5e7eb',
  borderRadius: 6,
  padding: '8px 10px',
};

const folderBadgeStyle: React.CSSProperties = {
  display: 'inline-block',
  fontSize: 10,
  color: '#7c3aed',
  background: '#f5f3ff',
  border: '1px solid #ddd6fe',
  borderRadius: 3,
  padding: '1px 5px',
  marginBottom: 5,
};

const textStyle: React.CSSProperties = {
  margin: '0 0 6px',
  fontSize: 13,
  lineHeight: 1.4,
  wordBreak: 'break-word',
};

const footerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
};

const metaStyle: React.CSSProperties = {
  fontSize: 11,
  color: '#9ca3af',
};

const actionBtn = (color: string): React.CSSProperties => ({
  fontSize: 11,
  color,
  background: 'none',
  border: `1px solid ${color}`,
  borderRadius: 4,
  padding: '2px 7px',
  cursor: 'pointer',
});