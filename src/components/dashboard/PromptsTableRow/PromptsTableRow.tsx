import React from 'react';
import type { Snippet } from '@/types';
import FavoriteButton from '@/components/dashboard/FavoriteButton/FavoriteButton';
import './PromptsTableRow.css';

interface PromptsTableRowProps {
  snippet: Snippet;
  folderName?: string;
  isSelected: boolean;
  isFocused: boolean;
  onToggleSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onToggleFavorite: (id: string) => void;
}

function formatDate(ts: number): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(ts));
}

function extractHostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export default function PromptsTableRow({
  snippet,
  folderName,
  isSelected,
  isFocused,
  onToggleSelect,
  onDelete,
  onToggleFavorite,
}: PromptsTableRowProps) {
  const preview =
    snippet.text.length > 100 ? `${snippet.text.slice(0, 100)}…` : snippet.text;
  const hostname = extractHostname(snippet.source);

  return (
    <tr
      className={[
        'prompts-table-row',
        isSelected ? 'prompts-table-row--selected' : '',
        isFocused ? 'prompts-table-row--focused' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <td className="prompts-table-row__cell prompts-table-row__cell--checkbox">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onToggleSelect(snippet.id)}
        />
      </td>
      <td className="prompts-table-row__cell">
        <span className="prompts-table-row__text" title={snippet.text}>
          {preview}
        </span>
      </td>
      <td className="prompts-table-row__cell">
        <span className="prompts-table-row__source" title={snippet.source}>
          {hostname}
        </span>
      </td>
      <td className="prompts-table-row__cell">
        {folderName ? (
          <span className="prompts-table-row__folder">◫ {folderName}</span>
        ) : (
          <span className="prompts-table-row__folder prompts-table-row__folder--empty">—</span>
        )}
      </td>
      <td className="prompts-table-row__cell">
        <div className="prompts-table-row__tags">
          {snippet.tags?.length ? (
            snippet.tags.map((tag) => (
              <span key={tag} className="prompts-table-row__tag">
                {tag}
              </span>
            ))
          ) : (
            <span className="prompts-table-row__empty-value">—</span>
          )}
        </div>
      </td>
      <td className="prompts-table-row__cell">
        <span className="prompts-table-row__date">{formatDate(snippet.savedAt)}</span>
      </td>
      <td className="prompts-table-row__cell">
        <div className="prompts-table-row__actions">
          <FavoriteButton
            isFavorite={!!snippet.isFavorite}
            onToggle={(e) => {
              e.stopPropagation();
              onToggleFavorite(snippet.id);
            }}
          />
          <button
            className="prompts-table-row__action-btn prompts-table-row__action-btn--danger"
            onClick={() => onDelete(snippet.id)}
            title="Delete prompt"
          >
            Delete
          </button>
        </div>
      </td>
    </tr>
  );
}
