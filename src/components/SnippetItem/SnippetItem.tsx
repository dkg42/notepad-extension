/**
 * @module SnippetItem
 * @description Renders a single saved prompt snippet as a list item with copy, delete, and tag management actions. Truncates long text to a configurable preview length and displays the source hostname and save time.
 * @dependencies @/types, ./useSnippetItem
 * @public SnippetItem (default export)
 */
import React from 'react';
import type { Snippet } from '@/types';
import { MAX_PREVIEW_LENGTH, parseHostname, useSnippetItem } from './useSnippetItem';
import './SnippetItem.css';

interface Props {
  snippet: Snippet;
  folderName?: string;
  onDelete: (id: string) => void;
  onUpdateTags: (id: string, tags: string[]) => void;
}

export default function SnippetItem({ snippet, folderName, onDelete, onUpdateTags }: Props) {
  const tags = snippet.tags ?? [];
  const {
    copied,
    handleCopy,
    isAddingTag,
    tagInput,
    setTagInput,
    tagInputRef,
    handleStartAddTag,
    handleTagInputKeyDown,
    handleTagInputBlur,
    handleRemoveTag,
  } = useSnippetItem(snippet.text, tags, (updated) => onUpdateTags(snippet.id, updated));

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

      <div className="snippet-item__tags">
        {tags.map((tag) => (
          <span key={tag} className="snippet-item__tag">
            #{tag}
            <button
              className="snippet-item__tag-remove"
              onClick={() => handleRemoveTag(tag)}
              title={`Remove tag "${tag}"`}
            >
              ×
            </button>
          </span>
        ))}

        {isAddingTag ? (
          <input
            ref={tagInputRef}
            className="snippet-item__tag-input"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={handleTagInputKeyDown}
            onBlur={handleTagInputBlur}
            placeholder="tag name…"
            maxLength={32}
          />
        ) : (
          <button className="snippet-item__tag-add" onClick={handleStartAddTag} title="Add tag">
            + tag
          </button>
        )}
      </div>

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