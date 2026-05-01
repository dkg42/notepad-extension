/**
 * @module RssFeedForm
 * @description Form that fetches an RSS/Atom feed by URL and renders a filterable, selectable list of articles so the user can choose which to bulk-import as notebook sources.
 * @dependencies ./useRssFeedForm
 * @public RssFeedForm
 */
import React from 'react';
import { useRssFeedForm } from './useRssFeedForm';
import './RssFeedForm.css';

interface RssFeedFormProps {
  onImport: (urls: string[]) => void;
  disabled?: boolean;
}

function formatDate(timestamp: number | null): string {
  if (!timestamp) return '';
  return new Date(timestamp).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function RssFeedForm({ onImport, disabled }: RssFeedFormProps) {
  const {
    feedUrl,
    setFeedUrl,
    filteredEntries,
    isFetching,
    error,
    dateFilter,
    setDateFilter,
    selectedUrls,
    toggleEntry,
    toggleAll,
    getSelectedUrls,
    fetchFeed,
  } = useRssFeedForm();

  const selected = getSelectedUrls();
  const allSelected = filteredEntries.length > 0 && filteredEntries.every((e) => selectedUrls.has(e.url));

  return (
    <div className="rss-form">
      <div className="rss-form__input-row">
        <input
          type="url"
          className="rss-form__url-input"
          placeholder="Enter RSS or Atom feed URL…"
          value={feedUrl}
          onChange={(e) => setFeedUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && feedUrl.trim()) void fetchFeed();
          }}
          disabled={isFetching || disabled}
        />
        <button
          className="rss-form__fetch-btn"
          onClick={() => void fetchFeed()}
          disabled={isFetching || !feedUrl.trim() || disabled}
        >
          {isFetching ? 'Fetching…' : 'Fetch Feed'}
        </button>
      </div>

      {error && <div className="rss-form__error">{error}</div>}

      {filteredEntries.length > 0 && (
        <>
          <div className="rss-form__controls">
            <div className="rss-form__filter">
              <label className="rss-form__filter-label">Show:</label>
              <select
                className="rss-form__filter-select"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value as 'all' | '7d' | '30d')}
              >
                <option value="all">All articles</option>
                <option value="7d">Last 7 days</option>
                <option value="30d">Last 30 days</option>
              </select>
            </div>
            <label className="rss-form__select-all">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleAll}
              />
              Select all ({filteredEntries.length})
            </label>
          </div>

          <div className="rss-form__entries">
            {filteredEntries.map((entry) => (
              <label key={entry.url} className="rss-form__entry">
                <input
                  type="checkbox"
                  checked={selectedUrls.has(entry.url)}
                  onChange={() => toggleEntry(entry.url)}
                />
                <div className="rss-form__entry-info">
                  <span className="rss-form__entry-title">{entry.title}</span>
                  <span className="rss-form__entry-meta">
                    {entry.publishedAt && formatDate(entry.publishedAt)}
                    {entry.publishedAt && ' · '}
                    <span className="rss-form__entry-url">{entry.url}</span>
                  </span>
                </div>
              </label>
            ))}
          </div>

          <div className="rss-form__footer">
            <span className="rss-form__count">
              {selected.length} article{selected.length !== 1 ? 's' : ''} selected
            </span>
            <button
              className="rss-form__import-btn"
              onClick={() => onImport(selected)}
              disabled={disabled || selected.length === 0}
            >
              Import {selected.length} Article{selected.length !== 1 ? 's' : ''}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
