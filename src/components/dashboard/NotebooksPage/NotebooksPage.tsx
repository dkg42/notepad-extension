import React from 'react';
import { useNotebooksPage } from './useNotebooksPage';
import './NotebooksPage.css';

function formatRelativeTime(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function NotebooksPage() {
  const {
    notebooks,
    isLoading,
    isSyncing,
    lastSyncedAt,
    syncError,
    handleRefresh,
    handleRemove,
  } = useNotebooksPage();

  return (
    <div className="notebooks-page">
      <header className="notebooks-page__header">
        <div>
          <h1 className="notebooks-page__title">Notebooks</h1>
          <p className="notebooks-page__subtitle">
            Synced from your Google NotebookLM account
          </p>
        </div>
        <button
          className="notebooks-page__refresh-btn"
          onClick={handleRefresh}
          disabled={isSyncing}
          title="Refresh notebooks"
        >
          <span className={`notebooks-page__refresh-icon${isSyncing ? ' notebooks-page__refresh-icon--spinning' : ''}`}>
            &#x27F3;
          </span>
          {isSyncing ? 'Syncing...' : 'Refresh'}
        </button>
      </header>

      {syncError && (
        <div className="notebooks-page__error">
          Could not reach NotebookLM. Make sure you are signed into Google in this browser.
        </div>
      )}

      {lastSyncedAt && (
        <div className="notebooks-page__sync-bar">
          Last synced {formatRelativeTime(lastSyncedAt)} &middot;{' '}
          {notebooks.length} notebook{notebooks.length !== 1 ? 's' : ''}
        </div>
      )}

      {isLoading && (
        <div className="notebooks-page__loading">Loading...</div>
      )}

      {!isLoading && notebooks.length === 0 && (
        <div className="notebooks-page__empty">
          <span className="notebooks-page__empty-icon">&#x25F1;</span>
          <p className="notebooks-page__empty-text">No notebooks found</p>
          <p className="notebooks-page__empty-hint">
            Sign into Google and your NotebookLM notebooks will appear here
            automatically, or click Refresh above.
          </p>
        </div>
      )}

      {!isLoading && notebooks.length > 0 && (
        <ul className="notebooks-grid">
          {notebooks.map((notebook) => (
            <li className="notebook-card" key={notebook.id}>
              <a
                className="notebook-card__link"
                href={notebook.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                <span className="notebook-card__icon">&#x25F1;</span>
                <div className="notebook-card__body">
                  <span className="notebook-card__title">{notebook.title}</span>
                  <span className="notebook-card__meta">
                    Created {formatDate(notebook.createdAt)}
                  </span>
                  {!notebook.isOwner && (
                    <span className="notebook-card__badge">Shared</span>
                  )}
                </div>
              </a>
              <button
                className="notebook-card__remove"
                onClick={() => handleRemove(notebook.id)}
                aria-label="Remove notebook"
                title="Remove from dashboard"
              >
                &#x2715;
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
