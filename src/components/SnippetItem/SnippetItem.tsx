import React from 'react';
import type { Snippet } from '@/types';
import { MAX_PREVIEW_LENGTH, parseHostname, useSnippetItem } from './useSnippetItem';
import './SnippetItem.css';

interface Props {
  snippet: Snippet;
  folderName?: string;
  onDelete: (id: string) => void;
}

export default function SnippetItem({ snippet, folderName, onDelete }: Props) {
  const { copied, handleCopy } = useSnippetItem(snippet.text);

  const sourceLabel = parseHostname(snippet.source);
  const preview =
    snippet.text.length > MAX_PREVIEW_LENGTH
      ? snippet.text.slice(0, MAX_PREVIEW_LENGTH) + '…'
      : snippet.text;

  return (
    <li className="snippet-item">
      {folderName && (
        <span className="snippet-item__folder-badge" title={`Folder: ${folderName}`}>
          📁 {folderName}
        </span>
      )}
      <p className="snippet-item__text">{preview}</p>
      <div className="snippet-item__footer">
        <span className="snippet-item__meta">
          {sourceLabel} · {new Date(snippet.savedAt).toLocaleTimeString()}
        </span>
        <div className="snippet-item__actions">
          <button onClick={handleCopy} className="action-btn action-btn--copy">
            {copied ? 'Copied!' : 'Copy'}
          </button>
          <button onClick={() => onDelete(snippet.id)} className="action-btn action-btn--delete">
            Delete
          </button>
        </div>
      </div>
    </li>
  );
}