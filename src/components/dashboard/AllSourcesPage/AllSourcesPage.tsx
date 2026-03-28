import React, { useState } from 'react';
import { ChevronUp, ChevronDown, ChevronsUpDown, Database } from 'lucide-react';
import { useAllSourcesPage } from './useAllSourcesPage';
import { sourceExportStrategies } from '@/export/source-export-registry';
import SearchBar from '@/components/dashboard/SearchBar/SearchBar';
import './AllSourcesPage.css';

const SOURCE_TYPE_LABELS: Record<string, string> = {
  website: 'Website',
  youtube: 'YouTube',
  pdf: 'PDF',
  gdoc: 'Google Doc',
  gslide: 'Google Slides',
  unknown: 'Unknown',
};

function SortIndicator({ active, dir }: { active: boolean; dir: 'asc' | 'desc' }) {
  if (!active) return <ChevronsUpDown size={11} className="all-sources__sort-icon" />;
  return dir === 'asc'
    ? <ChevronUp size={11} className="all-sources__sort-icon all-sources__sort-icon--active" />
    : <ChevronDown size={11} className="all-sources__sort-icon all-sources__sort-icon--active" />;
}

export default function AllSourcesPage() {
  const {
    sources,
    totalCount,
    notebooks,
    isLoading,
    error,
    setError,
    sourceTypes,
    notebookOptions,
    sortField,
    sortDir,
    handleSort,
    filterType,
    setFilterType,
    filterNotebook,
    setFilterNotebook,
    searchQuery,
    setSearchQuery,
    selectedIds,
    toggleSelect,
    toggleSelectAll,
    clearSelection,
    isAddingToNotebook,
    addError,
    setAddError,
    handleAddToNotebook,
    handleExport,
    handleRefresh,
  } = useAllSourcesPage();

  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showNotebookPicker, setShowNotebookPicker] = useState(false);

  const allVisibleSelected =
    sources.length > 0 && sources.every((s) => selectedIds.has(s.id));

  return (
    <div className="all-sources-page">
      <header className="all-sources-page__header">
        <div>
          <h1 className="all-sources-page__title">All Sources</h1>
          <p className="all-sources-page__subtitle">
            Aggregated from {notebookOptions.length} synced notebook{notebookOptions.length !== 1 ? 's' : ''}
            {' '}&middot; {totalCount} source{totalCount !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          className="all-sources-page__refresh-btn"
          onClick={handleRefresh}
          disabled={isLoading}
        >
          <span className={`all-sources-page__refresh-icon${isLoading ? ' all-sources-page__refresh-icon--spinning' : ''}`}>
            &#x27F3;
          </span>
          {isLoading ? 'Loading...' : 'Refresh'}
        </button>
      </header>

      {/* Error banners */}
      {error && (
        <div className="all-sources-page__error">
          {error}
          <button className="all-sources-page__error-dismiss" onClick={() => setError(null)}>&#x2715;</button>
        </div>
      )}
      {addError && (
        <div className="all-sources-page__error">
          {addError}
          <button className="all-sources-page__error-dismiss" onClick={() => setAddError(null)}>&#x2715;</button>
        </div>
      )}

      {/* Toolbar */}
      {!isLoading && totalCount > 0 && (
        <div className="all-sources-toolbar">
          <SearchBar
            className="all-sources-toolbar__search"
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search sources…"
          />

          <select
            className="all-sources-toolbar__filter"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
          >
            <option value="all">All types</option>
            {sourceTypes.map((t) => (
              <option key={t} value={t}>{SOURCE_TYPE_LABELS[t] ?? t}</option>
            ))}
          </select>

          <select
            className="all-sources-toolbar__filter"
            value={filterNotebook}
            onChange={(e) => setFilterNotebook(e.target.value)}
          >
            <option value="all">All notebooks</option>
            {notebookOptions.map((nb) => (
              <option key={nb.id} value={nb.id}>{nb.title}</option>
            ))}
          </select>

          {/* Export button */}
          <div className="all-sources-toolbar__action-wrapper">
            <button
              className="all-sources-toolbar__btn"
              onClick={() => setShowExportMenu((v) => !v)}
            >
              Export{selectedIds.size > 0 ? ` (${selectedIds.size})` : ''}
            </button>
            {showExportMenu && (
              <div className="all-sources-toolbar__menu">
                {sourceExportStrategies.map((s) => (
                  <button
                    key={s.type}
                    className="all-sources-toolbar__menu-item"
                    onClick={() => {
                      setShowExportMenu(false);
                      void handleExport(s.type);
                    }}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Add to notebook */}
          {selectedIds.size > 0 && (
            <div className="all-sources-toolbar__action-wrapper">
              <button
                className="all-sources-toolbar__btn all-sources-toolbar__btn--primary"
                onClick={() => setShowNotebookPicker((v) => !v)}
                disabled={isAddingToNotebook}
              >
                {isAddingToNotebook ? 'Adding...' : `Add to notebook (${selectedIds.size})`}
              </button>
              {showNotebookPicker && (
                <div className="all-sources-toolbar__menu">
                  {notebooks.map((nb) => (
                    <button
                      key={nb.id}
                      className="all-sources-toolbar__menu-item"
                      onClick={() => {
                        setShowNotebookPicker(false);
                        void handleAddToNotebook(nb.id);
                      }}
                    >
                      {nb.title}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {selectedIds.size > 0 && (
            <button className="all-sources-toolbar__clear" onClick={clearSelection}>
              Clear selection
            </button>
          )}
        </div>
      )}

      {/* Overlay */}
      {(showExportMenu || showNotebookPicker) && (
        <div
          className="all-sources-overlay"
          onClick={() => { setShowExportMenu(false); setShowNotebookPicker(false); }}
        />
      )}

      {/* Loading */}
      {isLoading && (
        <div className="all-sources-page__loading">Loading sources from all notebooks...</div>
      )}

      {/* Empty state */}
      {!isLoading && totalCount === 0 && (
        <div className="all-sources-page__empty">
          <span className="all-sources-page__empty-icon">
            <Database size={40} strokeWidth={1.5} />
          </span>
          <p className="all-sources-page__empty-text">No sources found</p>
          <p className="all-sources-page__empty-hint">
            Sync your notebooks first, then sources will appear here.
          </p>
        </div>
      )}

      {/* Table */}
      {!isLoading && totalCount > 0 && (
        <div className="all-sources-table-wrapper">
          <div className="all-sources-table__scroll">
            <table className="all-sources-table">
              <colgroup>
                <col className="all-sources-table__col--check" />
                <col className="all-sources-table__col--title" />
                <col className="all-sources-table__col--type" />
                <col className="all-sources-table__col--notebook" />
              </colgroup>
              <thead className="all-sources-table__head">
                <tr>
                  <th className="all-sources-table__th all-sources-table__th--check">
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={toggleSelectAll}
                      aria-label="Select all visible sources"
                    />
                  </th>
                  <th
                    className="all-sources-table__th all-sources-table__th--sortable"
                    onClick={() => handleSort('title')}
                  >
                    <span className="all-sources-table__th-content">
                      Title <SortIndicator active={sortField === 'title'} dir={sortDir} />
                    </span>
                  </th>
                  <th
                    className="all-sources-table__th all-sources-table__th--sortable"
                    onClick={() => handleSort('type')}
                  >
                    <span className="all-sources-table__th-content">
                      Type <SortIndicator active={sortField === 'type'} dir={sortDir} />
                    </span>
                  </th>
                  <th
                    className="all-sources-table__th all-sources-table__th--sortable"
                    onClick={() => handleSort('notebookTitle')}
                  >
                    <span className="all-sources-table__th-content">
                      Notebook <SortIndicator active={sortField === 'notebookTitle'} dir={sortDir} />
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {sources.length === 0 ? (
                  <tr>
                    <td className="all-sources-table__empty-row" colSpan={4}>
                      No sources match the current filters.
                    </td>
                  </tr>
                ) : (
                  sources.map((source) => (
                    <tr
                      key={`${source.notebookId}-${source.id}`}
                      className={`all-sources-table__row${selectedIds.has(source.id) ? ' all-sources-table__row--selected' : ''}`}
                    >
                      <td className="all-sources-table__td all-sources-table__td--check">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(source.id)}
                          onChange={() => toggleSelect(source.id)}
                          aria-label={`Select ${source.title}`}
                        />
                      </td>
                      <td className="all-sources-table__td all-sources-table__td--title">
                        <span className="all-sources-table__source-title">{source.title}</span>
                      </td>
                      <td className="all-sources-table__td all-sources-table__td--type">
                        <span className={`all-sources-type-badge all-sources-type-badge--${source.type}`}>
                          {SOURCE_TYPE_LABELS[source.type] ?? source.type}
                        </span>
                      </td>
                      <td className="all-sources-table__td all-sources-table__td--notebook">
                        {source.notebookTitle}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="all-sources-table__footer">
            Showing {sources.length} of {totalCount} source{totalCount !== 1 ? 's' : ''}
          </div>
        </div>
      )}
    </div>
  );
}
