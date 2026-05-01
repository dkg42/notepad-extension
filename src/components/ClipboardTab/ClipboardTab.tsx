/**
 * @module ClipboardTab
 * @description Renders the clipboard history tab showing a session-scoped list of copied text and image entries with clear-all and per-entry action callbacks.
 * @dependencies ClipboardEntryItem, @/types (ClipboardEntry)
 * @public ClipboardTab
 */
import React from 'react';
import type { ClipboardEntry } from '@/types';
import ClipboardEntryItem from './ClipboardEntryItem/ClipboardEntryItem';
import './ClipboardTab.css';

interface ClipboardTabProps {
  entries: ClipboardEntry[];
  onDelete: (id: string) => void;
  onClear: () => void;
  onCopyText: (text: string) => void;
  onSaveAsSnippet: (entry: ClipboardEntry) => void;
}

export default function ClipboardTab({
  entries,
  onDelete,
  onClear,
  onCopyText,
  onSaveAsSnippet,
}: ClipboardTabProps) {
  return (
    <div className="clipboard-tab">
      <div className="clipboard-tab__header">
        <span className="clipboard-tab__session-note">Cleared when browser closes</span>
        {entries.length > 0 && (
          <button className="clipboard-tab__clear-btn" onClick={onClear}>
            Clear all
          </button>
        )}
      </div>

      {entries.length === 0 ? (
        <p className="clipboard-tab__empty">
          Nothing copied yet. Copy text or images on any page to save them here.
        </p>
      ) : (
        <ul className="clipboard-tab__list">
          {entries.map((entry) => (
            <li key={entry.id}>
              <ClipboardEntryItem
                entry={entry}
                onDelete={onDelete}
                onCopyText={onCopyText}
                onSaveAsSnippet={onSaveAsSnippet}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
