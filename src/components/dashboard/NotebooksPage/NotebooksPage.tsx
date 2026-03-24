import React, { useRef, useState } from 'react';
import { useNotebooksPage, UNCOLLECTED_FILTER_ID } from './useNotebooksPage';
import { sourceExportStrategies } from '@/export/source-export-registry';
import './NotebooksPage.css';

function TrashIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
      <path
        d="M1.5 3h10M4.5 3V2a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1m2 0-.667 8a1 1 0 0 1-1 .917H4.167A1 1 0 0 1 3.167 11L2.5 3M5.5 5.5v4m2-4v4"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
      <path
        d="M6.5 1v8m0 0L3.5 6m3 3 3-3M1.5 10.5v1a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-1"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

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

interface NotebooksPageProps {
  onOpenNotebook: (id: string) => void;
}

export default function NotebooksPage({ onOpenNotebook }: NotebooksPageProps) {
  const {
    notebooks,
    filteredNotebooks,
    isLoading,
    isSyncing,
    lastSyncedAt,
    syncError,
    deletingId,
    deleteError,
    setDeleteError,
    sourceCounts,
    fetchingSourcesId,
    sourceExportError,
    setSourceExportError,
    handleExportSources,
    collections,
    activeCollectionId,
    setActiveCollectionId,
    getAnnotation,
    handleRefresh,
    handleDelete,
    handleAddTag,
    handleRemoveTag,
    handleCreateCollection,
    handleDeleteCollection,
    handleAssignCollection,
  } = useNotebooksPage();

  // ── Local UI state ──────────────────────────────────────────────────────────
  const [taggingNotebookId, setTaggingNotebookId] = useState<string | null>(null);
  const [movingNotebookId, setMovingNotebookId] = useState<string | null>(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [exportingNotebookId, setExportingNotebookId] = useState<string | null>(null);
  const [isCreatingCollection, setIsCreatingCollection] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');
  const newCollectionInputRef = useRef<HTMLInputElement>(null);

  const uncollectedCount = notebooks.filter((n) => !getAnnotation(n.id).collectionId).length;

  function handleNewCollectionConfirm() {
    const name = newCollectionName.trim();
    if (name) {
      handleCreateCollection(name).then((id) => setActiveCollectionId(id));
    }
    setNewCollectionName('');
    setIsCreatingCollection(false);
  }

  function handleTagInputKeyDown(
    e: React.KeyboardEvent<HTMLInputElement>,
    notebookId: string,
  ) {
    if (e.key === 'Enter') {
      const val = e.currentTarget.value.trim();
      if (val) handleAddTag(notebookId, val);
      setTaggingNotebookId(null);
    }
    if (e.key === 'Escape') setTaggingNotebookId(null);
  }

  function handleTagInputBlur(
    e: React.FocusEvent<HTMLInputElement>,
    notebookId: string,
  ) {
    const val = e.currentTarget.value.trim();
    if (val) handleAddTag(notebookId, val);
    setTaggingNotebookId(null);
  }

  return (
    <div className="notebooks-page">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
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
          <span
            className={`notebooks-page__refresh-icon${isSyncing ? ' notebooks-page__refresh-icon--spinning' : ''}`}
          >
            &#x27F3;
          </span>
          {isSyncing ? 'Syncing...' : 'Refresh'}
        </button>
      </header>

      {/* ── Error banner ────────────────────────────────────────────────────── */}
      {syncError && (
        <div className="notebooks-page__error">
          Could not reach NotebookLM. Make sure you are signed into Google in this browser.
        </div>
      )}

      {/* ── Delete error banner ─────────────────────────────────────────────── */}
      {deleteError && (
        <div className="notebooks-page__error">
          {deleteError}
          <button
            className="notebooks-page__error-dismiss"
            onClick={() => setDeleteError(null)}
            aria-label="Dismiss error"
          >
            &#x2715;
          </button>
        </div>
      )}

      {/* ── Source export error banner ──────────────────────────────────────── */}
      {sourceExportError && (
        <div className="notebooks-page__error">
          {sourceExportError}
          <button
            className="notebooks-page__error-dismiss"
            onClick={() => setSourceExportError(null)}
            aria-label="Dismiss error"
          >
            &#x2715;
          </button>
        </div>
      )}

      {/* ── Sync bar ────────────────────────────────────────────────────────── */}
      {lastSyncedAt && (
        <div className="notebooks-page__sync-bar">
          Last synced {formatRelativeTime(lastSyncedAt)} &middot;{' '}
          {notebooks.length} notebook{notebooks.length !== 1 ? 's' : ''}
        </div>
      )}

      {/* ── Collection filter bar ───────────────────────────────────────────── */}
      {!isLoading && notebooks.length > 0 && (
        <div className="notebooks-collections-bar">
          <button
            className={`notebooks-filter-chip${activeCollectionId === null ? ' notebooks-filter-chip--active' : ''}`}
            onClick={() => setActiveCollectionId(null)}
          >
            All
            <span className="notebooks-filter-chip__count">{notebooks.length}</span>
          </button>

          <button
            className={`notebooks-filter-chip${activeCollectionId === UNCOLLECTED_FILTER_ID ? ' notebooks-filter-chip--active' : ''}`}
            onClick={() => setActiveCollectionId(UNCOLLECTED_FILTER_ID)}
          >
            Uncollected
            <span className="notebooks-filter-chip__count">{uncollectedCount}</span>
          </button>

          {collections.map((col) => {
            const count = notebooks.filter(
              (n) => getAnnotation(n.id).collectionId === col.id,
            ).length;
            return (
              <span
                key={col.id}
                className={`notebooks-filter-chip notebooks-filter-chip--collection${activeCollectionId === col.id ? ' notebooks-filter-chip--active' : ''}`}
              >
                <button
                  className="notebooks-filter-chip__label"
                  onClick={() => setActiveCollectionId(col.id)}
                >
                  {col.name}
                  <span className="notebooks-filter-chip__count">{count}</span>
                </button>
                <button
                  className="notebooks-filter-chip__delete"
                  onClick={() => handleDeleteCollection(col.id)}
                  title={`Delete collection "${col.name}"`}
                  aria-label={`Delete collection ${col.name}`}
                >
                  &#x2715;
                </button>
              </span>
            );
          })}

          {isCreatingCollection ? (
            <input
              ref={newCollectionInputRef}
              className="notebooks-collection-new-input"
              autoFocus
              placeholder="Collection name…"
              value={newCollectionName}
              onChange={(e) => setNewCollectionName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleNewCollectionConfirm();
                if (e.key === 'Escape') {
                  setNewCollectionName('');
                  setIsCreatingCollection(false);
                }
              }}
              onBlur={handleNewCollectionConfirm}
            />
          ) : (
            <button
              className="notebooks-filter-chip notebooks-filter-chip--new"
              onClick={() => setIsCreatingCollection(true)}
            >
              + New collection
            </button>
          )}
        </div>
      )}

      {/* ── Loading ─────────────────────────────────────────────────────────── */}
      {isLoading && (
        <div className="notebooks-page__loading">Loading...</div>
      )}

      {/* ── Empty state ─────────────────────────────────────────────────────── */}
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

      {/* ── Table ───────────────────────────────────────────────────────────── */}
      {!isLoading && notebooks.length > 0 && (
        <>
          {(movingNotebookId || exportingNotebookId) && (
            <div
              className="notebooks-overlay"
              onClick={() => {
                setMovingNotebookId(null);
                setExportingNotebookId(null);
              }}
            />
          )}

          <div className="notebooks-table-wrapper">
            <div className="notebooks-table__scroll">
              <table className="notebooks-table">
                <colgroup>
                  <col className="notebooks-table__col--notebook" />
                  <col className="notebooks-table__col--created" />
                  <col className="notebooks-table__col--collection" />
                  <col className="notebooks-table__col--tags" />
                  <col className="notebooks-table__col--sources" />
                  <col className="notebooks-table__col--actions" />
                </colgroup>

                <thead className="notebooks-table__head">
                  <tr>
                    <th className="notebooks-table__th">Notebook</th>
                    <th className="notebooks-table__th">Created</th>
                    <th className="notebooks-table__th">Collection</th>
                    <th className="notebooks-table__th">Tags</th>
                    <th className="notebooks-table__th">Sources</th>
                    <th className="notebooks-table__th" />
                  </tr>
                </thead>

                <tbody>
                  {filteredNotebooks.length === 0 ? (
                    <tr>
                      <td className="notebooks-table__empty" colSpan={6}>
                        <span className="notebooks-table__empty-icon">&#x25F1;</span>
                        No notebooks in this view
                      </td>
                    </tr>
                  ) : (
                    filteredNotebooks.map((notebook) => {
                      const annotation = getAnnotation(notebook.id);
                      const assignedCollection = collections.find(
                        (c) => c.id === annotation.collectionId,
                      );

                      return (
                        <tr key={notebook.id} className="notebooks-table__row">

                          {/* ── Notebook cell ─────────────────────────────── */}
                          <td className="notebooks-table__td notebooks-table__td--notebook">
                            <button
                              className="notebooks-table__notebook-link"
                              onClick={() => onOpenNotebook(notebook.id)}
                              title="Open notebook details"
                            >
                              <span className="notebooks-table__notebook-icon">
                                &#x25F1;
                              </span>
                              <span className="notebooks-table__notebook-title">
                                {notebook.title}
                              </span>
                            </button>
                            <a
                              className="notebooks-table__external-link"
                              href={notebook.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Open in NotebookLM"
                            >
                              ↗
                            </a>
                            {!notebook.isOwner && (
                              <span className="notebooks-table__badge">Shared</span>
                            )}
                          </td>

                          {/* ── Created cell ──────────────────────────────── */}
                          <td className="notebooks-table__td notebooks-table__td--created">
                            {formatDate(notebook.createdAt)}
                          </td>

                          {/* ── Collection cell ───────────────────────────── */}
                          <td className="notebooks-table__td notebooks-table__td--collection">
                            <button
                              className={`notebooks-collection-selector${assignedCollection ? ' notebooks-collection-selector--assigned' : ''}`}
                              onClick={() =>
                                setMovingNotebookId((prev) =>
                                  prev === notebook.id ? null : notebook.id,
                                )
                              }
                              title="Assign to collection"
                            >
                              {assignedCollection ? assignedCollection.name : '—'}
                              <span className="notebooks-collection-selector__caret">▾</span>
                            </button>

                            {movingNotebookId === notebook.id && (
                              <div className="notebooks-collection-menu">
                                <button
                                  className={`notebooks-collection-menu__item${!annotation.collectionId ? ' notebooks-collection-menu__item--active' : ''}`}
                                  onClick={() => {
                                    handleAssignCollection(notebook.id, undefined);
                                    setMovingNotebookId(null);
                                  }}
                                >
                                  None
                                </button>
                                {collections.map((col) => (
                                  <button
                                    key={col.id}
                                    className={`notebooks-collection-menu__item${annotation.collectionId === col.id ? ' notebooks-collection-menu__item--active' : ''}`}
                                    onClick={() => {
                                      handleAssignCollection(notebook.id, col.id);
                                      setMovingNotebookId(null);
                                    }}
                                  >
                                    {col.name}
                                  </button>
                                ))}
                              </div>
                            )}
                          </td>

                          {/* ── Tags cell ─────────────────────────────────── */}
                          <td className="notebooks-table__td notebooks-table__td--tags">
                            <div className="notebooks-tags-cell">
                              {annotation.tags.map((tag) => (
                                <span key={tag} className="notebook-tag">
                                  <span className="notebook-tag__label">{tag}</span>
                                  <button
                                    className="notebook-tag__remove"
                                    onClick={() => handleRemoveTag(notebook.id, tag)}
                                    aria-label={`Remove tag ${tag}`}
                                  >
                                    &#x2715;
                                  </button>
                                </span>
                              ))}

                              {taggingNotebookId === notebook.id ? (
                                <input
                                  className="notebook-tag-input"
                                  autoFocus
                                  placeholder="Tag name…"
                                  onKeyDown={(e) => handleTagInputKeyDown(e, notebook.id)}
                                  onBlur={(e) => handleTagInputBlur(e, notebook.id)}
                                />
                              ) : (
                                <button
                                  className="notebooks-add-tag-btn"
                                  onClick={() => setTaggingNotebookId(notebook.id)}
                                  title="Add tag"
                                  aria-label="Add tag"
                                >
                                  +
                                </button>
                              )}
                            </div>
                          </td>

                          {/* ── Sources cell ──────────────────────────────── */}
                          <td className="notebooks-table__td notebooks-table__td--sources">
                            {fetchingSourcesId === notebook.id || fetchingSourcesId === '__all__' ? (
                              <span
                                className="notebooks-table__sources-loading"
                                aria-label="Fetching sources…"
                                title="Loading source count…"
                              >
                                &#x231B;
                              </span>
                            ) : (
                              <div className="notebooks-sources-cell">
                                <span className="notebooks-sources-count">
                                  {sourceCounts[notebook.id] !== undefined
                                    ? sourceCounts[notebook.id]
                                    : '—'}
                                </span>
                                <button
                                  className="notebooks-sources-download-btn"
                                  onClick={() =>
                                    setExportingNotebookId((prev) =>
                                      prev === notebook.id ? null : notebook.id,
                                    )
                                  }
                                  title="Export sources"
                                  aria-label="Export sources"
                                >
                                  <DownloadIcon />
                                </button>

                                {exportingNotebookId === notebook.id && (
                                  <div className="notebooks-sources-format-menu">
                                    {sourceExportStrategies.map((strategy) => (
                                      <button
                                        key={strategy.type}
                                        className="notebooks-sources-format-item"
                                        onClick={() => {
                                          setExportingNotebookId(null);
                                          void handleExportSources(
                                            notebook.id,
                                            notebook.title,
                                            strategy.type,
                                          );
                                        }}
                                      >
                                        {strategy.label}
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </td>

                          {/* ── Actions cell ──────────────────────────────── */}
                          <td className="notebooks-table__td notebooks-table__td--actions">
                            {deletingId === notebook.id ? (
                              <span className="notebooks-table__deleting" aria-label="Deleting…">
                                &#x231B;
                              </span>
                            ) : confirmingDeleteId === notebook.id ? (
                              <span className="notebooks-table__confirm-delete">
                                <span className="notebooks-table__confirm-label">Delete?</span>
                                <button
                                  className="notebooks-table__confirm-btn notebooks-table__confirm-btn--yes"
                                  title="Confirm delete from NotebookLM"
                                  onClick={() => {
                                    setConfirmingDeleteId(null);
                                    void handleDelete(notebook.id);
                                  }}
                                >
                                  &#x2713;
                                </button>
                                <button
                                  className="notebooks-table__confirm-btn notebooks-table__confirm-btn--no"
                                  title="Cancel"
                                  onClick={() => setConfirmingDeleteId(null)}
                                >
                                  &#x2715;
                                </button>
                              </span>
                            ) : (
                              <button
                                className="notebooks-table__delete-btn"
                                onClick={() => setConfirmingDeleteId(notebook.id)}
                                aria-label="Delete notebook from NotebookLM"
                                title="Delete from NotebookLM"
                              >
                                <TrashIcon />
                              </button>
                            )}
                          </td>

                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
