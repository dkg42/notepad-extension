/**
 * @module NotebookView
 * @description Sidebar view for adding the current tab as a source to a NotebookLM notebook.
 *   Shows the active tab URL, a selectable list of synced notebooks, and a submit button
 *   that fires the ADD_SOURCE_URL background message.
 * @dependencies useNotebookView
 * @public NotebookView (default export)
 */
import React from 'react';
import {
  BookOpen,
  RefreshCw,
  Loader2,
  Check,
  Plus,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { useNotebookView } from './useNotebookView';
import './NotebookView.css';

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

export default function NotebookView() {
  const {
    tabUrl,
    tabTitle,
    notebooks,
    isSyncing,
    selectedId,
    selectNotebook,
    handleSync,
    handleSubmit,
    status,
    errorMsg,
    reset,
  } = useNotebookView();

  const isSubmitting = status === 'submitting';

  return (
    <div className="notebook-view">
      {/* Current page preview */}
      <div className="notebook-view__page-card">
        <div className="notebook-view__page-card-label">Current Page</div>
        {tabUrl ? (
          <>
            <div className="notebook-view__page-title">{tabTitle ?? 'Untitled'}</div>
            <div className="notebook-view__page-url">{tabUrl}</div>
          </>
        ) : (
          <div className="notebook-view__no-url">
            No page detected — navigate to a webpage and re-open this panel.
          </div>
        )}
      </div>

      {/* Notebooks section header */}
      <div className="notebook-view__section-header">
        <span className="notebook-view__section-label">Notebooks</span>
        <button
          className="notebook-view__sync-btn"
          onClick={() => void handleSync()}
          disabled={isSyncing || isSubmitting}
        >
          {isSyncing ? (
            <Loader2 size={11} className="notebook-view__spin" strokeWidth={2} />
          ) : (
            <RefreshCw size={11} strokeWidth={2} />
          )}
          {isSyncing ? 'Syncing…' : 'Sync'}
        </button>
      </div>

      {/* Success banner */}
      {status === 'success' && (
        <div className="notebook-view__banner notebook-view__banner--success">
          <CheckCircle2 size={14} strokeWidth={2} />
          <div className="notebook-view__banner-body">
            <div className="notebook-view__banner-title">Added to notebook</div>
            <div className="notebook-view__banner-sub">
              NotebookLM is processing the source.
            </div>
          </div>
          <button className="notebook-view__banner-reset" onClick={reset}>
            Add another
          </button>
        </div>
      )}

      {/* Error banner */}
      {status === 'error' && (
        <div className="notebook-view__banner notebook-view__banner--error">
          <AlertCircle size={14} strokeWidth={2} />
          <div className="notebook-view__banner-body">
            <div className="notebook-view__banner-title">Failed to add source</div>
            <div className="notebook-view__banner-sub">{errorMsg}</div>
          </div>
          <button className="notebook-view__banner-reset" onClick={reset}>
            Try again
          </button>
        </div>
      )}

      {/* Notebook list + footer (hidden while showing success/error) */}
      {(status === 'idle' || status === 'submitting') && (
        <>
          {notebooks.length === 0 && !isSyncing && (
            <div className="notebook-view__empty">
              No notebooks found. Click <strong>Sync</strong> to fetch your notebooks from NotebookLM.
            </div>
          )}

          {notebooks.length > 0 && (
            <div className="notebook-view__list" role="listbox" aria-label="Select a notebook">
              {notebooks.map((nb) => {
                const selected = selectedId === nb.id;
                return (
                  <button
                    key={nb.id}
                    role="option"
                    aria-selected={selected}
                    className={`notebook-view__item${selected ? ' notebook-view__item--selected' : ''}`}
                    onClick={() => selectNotebook(nb.id)}
                    disabled={isSubmitting}
                  >
                    <BookOpen
                      size={13}
                      strokeWidth={1.7}
                      className="notebook-view__item-icon"
                    />
                    <div className="notebook-view__item-text">
                      <div className="notebook-view__item-title">{nb.title}</div>
                      <div className="notebook-view__item-meta">
                        Last synced {timeAgo(nb.lastSyncedAt)}
                      </div>
                    </div>
                    {selected && (
                      <Check size={12} strokeWidth={2.5} className="notebook-view__item-check" />
                    )}
                  </button>
                );
              })}
            </div>
          )}

          <div className="notebook-view__footer">
            <button
              className="notebook-view__submit-btn"
              onClick={() => void handleSubmit()}
              disabled={!tabUrl || !selectedId || isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={13} strokeWidth={2} className="notebook-view__spin" />
                  Adding…
                </>
              ) : (
                <>
                  <Plus size={13} strokeWidth={2} />
                  Add to Notebook
                </>
              )}
            </button>
            {!tabUrl && (
              <div className="notebook-view__footer-hint">
                No active page URL — navigate to a webpage first.
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
