import React, { useState } from 'react';
import { useAllArtifactsPage } from './useAllArtifactsPage';
import './AllArtifactsPage.css';

const ARTIFACT_TYPE_LABELS: Record<number, string> = {
  1: 'Audio Overview',
};

const STATUS_LABELS: Record<number, string> = {
  1: 'Processing',
  2: 'Pending',
  3: 'Completed',
};

function formatDate(timestamp?: number): string {
  if (!timestamp) return '—';
  return new Date(timestamp).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function SortIndicator({ active, dir }: { active: boolean; dir: 'asc' | 'desc' }) {
  if (!active) return <span className="all-artifacts__sort-icon">&#x21C5;</span>;
  return (
    <span className="all-artifacts__sort-icon all-artifacts__sort-icon--active">
      {dir === 'asc' ? '&#x25B2;' : '&#x25BC;'}
    </span>
  );
}

export default function AllArtifactsPage() {
  const {
    artifacts,
    totalCount,
    isLoading,
    error,
    setError,
    notebookOptions,
    sortField,
    sortDir,
    handleSort,
    filterNotebook,
    setFilterNotebook,
    filterStatus,
    setFilterStatus,
    searchQuery,
    setSearchQuery,
    handleExportCsv,
    handleExportJson,
    handleRefresh,
  } = useAllArtifactsPage();

  const [showExportMenu, setShowExportMenu] = useState(false);

  return (
    <div className="all-artifacts-page">
      <header className="all-artifacts-page__header">
        <div>
          <h1 className="all-artifacts-page__title">All Artifacts</h1>
          <p className="all-artifacts-page__subtitle">
            Aggregated from {notebookOptions.length} synced notebook{notebookOptions.length !== 1 ? 's' : ''}
            {' '}&middot; {totalCount} artifact{totalCount !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          className="all-artifacts-page__refresh-btn"
          onClick={handleRefresh}
          disabled={isLoading}
        >
          <span className={`all-artifacts-page__refresh-icon${isLoading ? ' all-artifacts-page__refresh-icon--spinning' : ''}`}>
            &#x27F3;
          </span>
          {isLoading ? 'Loading...' : 'Refresh'}
        </button>
      </header>

      {/* Error banner */}
      {error && (
        <div className="all-artifacts-page__error">
          {error}
          <button className="all-artifacts-page__error-dismiss" onClick={() => setError(null)}>&#x2715;</button>
        </div>
      )}

      {/* Toolbar */}
      {!isLoading && totalCount > 0 && (
        <div className="all-artifacts-toolbar">
          <input
            className="all-artifacts-toolbar__search"
            type="text"
            placeholder="Search artifacts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />

          <select
            className="all-artifacts-toolbar__filter"
            value={filterNotebook}
            onChange={(e) => setFilterNotebook(e.target.value)}
          >
            <option value="all">All notebooks</option>
            {notebookOptions.map((nb) => (
              <option key={nb.id} value={nb.id}>{nb.title}</option>
            ))}
          </select>

          <select
            className="all-artifacts-toolbar__filter"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="all">All statuses</option>
            <option value="3">Completed</option>
            <option value="1">Processing</option>
            <option value="2">Pending</option>
          </select>

          <div className="all-artifacts-toolbar__action-wrapper">
            <button
              className="all-artifacts-toolbar__btn"
              onClick={() => setShowExportMenu((v) => !v)}
            >
              Export
            </button>
            {showExportMenu && (
              <div className="all-artifacts-toolbar__menu">
                <button
                  className="all-artifacts-toolbar__menu-item"
                  onClick={() => { setShowExportMenu(false); handleExportCsv(); }}
                >
                  CSV (.csv)
                </button>
                <button
                  className="all-artifacts-toolbar__menu-item"
                  onClick={() => { setShowExportMenu(false); handleExportJson(); }}
                >
                  JSON (.json)
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Overlay */}
      {showExportMenu && (
        <div className="all-artifacts-overlay" onClick={() => setShowExportMenu(false)} />
      )}

      {/* Loading */}
      {isLoading && (
        <div className="all-artifacts-page__loading">Loading artifacts from all notebooks...</div>
      )}

      {/* Empty */}
      {!isLoading && totalCount === 0 && (
        <div className="all-artifacts-page__empty">
          <span className="all-artifacts-page__empty-icon">&#x266B;</span>
          <p className="all-artifacts-page__empty-text">No artifacts found</p>
          <p className="all-artifacts-page__empty-hint">
            Sync your notebooks first, then artifacts will appear here.
          </p>
        </div>
      )}

      {/* Table */}
      {!isLoading && totalCount > 0 && (
        <div className="all-artifacts-table-wrapper">
          <div className="all-artifacts-table__scroll">
            <table className="all-artifacts-table">
              <colgroup>
                <col className="all-artifacts-table__col--title" />
                <col className="all-artifacts-table__col--type" />
                <col className="all-artifacts-table__col--notebook" />
                <col className="all-artifacts-table__col--status" />
                <col className="all-artifacts-table__col--created" />
              </colgroup>
              <thead className="all-artifacts-table__head">
                <tr>
                  <th
                    className="all-artifacts-table__th all-artifacts-table__th--sortable"
                    onClick={() => handleSort('title')}
                  >
                    Title <SortIndicator active={sortField === 'title'} dir={sortDir} />
                  </th>
                  <th className="all-artifacts-table__th">Type</th>
                  <th
                    className="all-artifacts-table__th all-artifacts-table__th--sortable"
                    onClick={() => handleSort('notebookTitle')}
                  >
                    Notebook <SortIndicator active={sortField === 'notebookTitle'} dir={sortDir} />
                  </th>
                  <th className="all-artifacts-table__th">Status</th>
                  <th
                    className="all-artifacts-table__th all-artifacts-table__th--sortable"
                    onClick={() => handleSort('createdAt')}
                  >
                    Created <SortIndicator active={sortField === 'createdAt'} dir={sortDir} />
                  </th>
                </tr>
              </thead>
              <tbody>
                {artifacts.length === 0 ? (
                  <tr>
                    <td className="all-artifacts-table__empty-row" colSpan={5}>
                      No artifacts match the current filters.
                    </td>
                  </tr>
                ) : (
                  artifacts.map((artifact) => (
                    <tr key={`${artifact.notebookId}-${artifact.id}`} className="all-artifacts-table__row">
                      <td className="all-artifacts-table__td all-artifacts-table__td--title">
                        <span className="all-artifacts-table__artifact-title">{artifact.title}</span>
                      </td>
                      <td className="all-artifacts-table__td all-artifacts-table__td--type">
                        {ARTIFACT_TYPE_LABELS[artifact.typeCode] ?? `Type ${artifact.typeCode}`}
                      </td>
                      <td className="all-artifacts-table__td all-artifacts-table__td--notebook">
                        {artifact.notebookTitle}
                      </td>
                      <td className="all-artifacts-table__td all-artifacts-table__td--status">
                        <span className={`all-artifacts-status-badge all-artifacts-status-badge--${artifact.status}`}>
                          {STATUS_LABELS[artifact.status ?? 0] ?? 'Unknown'}
                        </span>
                      </td>
                      <td className="all-artifacts-table__td all-artifacts-table__td--created">
                        {formatDate(artifact.createdAt)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="all-artifacts-table__footer">
            Showing {artifacts.length} of {totalCount} artifact{totalCount !== 1 ? 's' : ''}
          </div>
        </div>
      )}
    </div>
  );
}
