import React from 'react';
import type { ClipboardEntry } from '@/types';
import './ClipboardEntryItem.css';

interface ClipboardEntryItemProps {
  entry: ClipboardEntry;
  onDelete: (id: string) => void;
  onCopyText: (text: string) => void;
  onSaveAsSnippet: (entry: ClipboardEntry) => void;
}

function formatRelativeTime(ms: number): string {
  const diff = Date.now() - ms;
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

function extractHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

export default function ClipboardEntryItem({
  entry,
  onDelete,
  onCopyText,
  onSaveAsSnippet,
}: ClipboardEntryItemProps) {
  return (
    <div className="clipboard-entry">
      {entry.type === 'text' ? (
        <p className="clipboard-entry__text">{entry.text}</p>
      ) : (
        <img
          className="clipboard-entry__image"
          src={entry.thumbnailDataUrl}
          alt="Clipboard image"
        />
      )}

      <div className="clipboard-entry__meta">
        <span className="clipboard-entry__source" title={entry.source}>
          {extractHostname(entry.source)}
        </span>
        <span className="clipboard-entry__time">{formatRelativeTime(entry.copiedAt)}</span>
      </div>

      <div className="clipboard-entry__actions">
        {entry.type === 'text' && (
          <>
            <button
              className="clipboard-entry__btn clipboard-entry__btn--copy"
              onClick={() => onCopyText(entry.text!)}
              title="Copy to clipboard"
            >
              Copy
            </button>
            <button
              className="clipboard-entry__btn clipboard-entry__btn--save"
              onClick={() => onSaveAsSnippet(entry)}
              title="Save as snippet"
            >
              Save
            </button>
          </>
        )}
        <button
          className="clipboard-entry__btn clipboard-entry__btn--delete"
          onClick={() => onDelete(entry.id)}
          title="Delete"
        >
          Delete
        </button>
      </div>
    </div>
  );
}
