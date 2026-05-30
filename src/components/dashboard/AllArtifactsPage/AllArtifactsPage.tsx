/**
 * @module AllArtifactsPage
 * @description Renders a sortable, paginated table of all generated artifacts (e.g. Audio Overviews) across notebooks, with search, status labels, and notebook assignment display.
 * @dependencies useAllArtifactsPage, SearchBar
 * @public AllArtifactsPage
 */
import React from 'react';
import { ChevronUp, ChevronDown, ChevronsUpDown, Package, Download, ExternalLink } from 'lucide-react';
import { useAllArtifactsPage } from './useAllArtifactsPage';
import SearchBar from '@/components/dashboard/SearchBar/SearchBar';
import AudioPlayButton from '@/components/dashboard/AudioPlayButton/AudioPlayButton';
import { exportArtifact, getArtifactActionMeta } from '@/export/artifact/artifact-export';
import { useNavigation } from '@/contexts/NavigationContext';
import './AllArtifactsPage.css';

const AUDIO_TYPE_CODE = 1;
const STATUS_COMPLETED = 3;

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
  if (!active) return <ChevronsUpDown size={11} className="all-artifacts__sort-icon" />;
  return dir === 'asc'
    ? <ChevronUp size={11} className="all-artifacts__sort-icon all-artifacts__sort-icon--active" />
    : <ChevronDown size={11} className="all-artifacts__sort-icon all-artifacts__sort-icon--active" />;
}

export default function AllArtifactsPage() {
  const { playArtifact } = useNavigation();

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
    handleRefresh,
  } = useAllArtifactsPage();

  const handleArtifactAction = async (artifact: Parameters<typeof exportArtifact>[0]) => {
    const result = await exportArtifact(artifact);
    if (!result.ok && result.error) {
      setError(result.error);
    }
  };

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
          <SearchBar
            className="all-artifacts-toolbar__search"
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search artifacts…"
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
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="all-artifacts-page__loading">Loading artifacts from all notebooks...</div>
      )}

      {/* Empty */}
      {!isLoading && totalCount === 0 && (
        <div className="all-artifacts-page__empty">
          <span className="all-artifacts-page__empty-icon">
            <Package size={40} strokeWidth={1.5} />
          </span>
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
                <col className="all-artifacts-table__col--action" />
              </colgroup>
              <thead className="all-artifacts-table__head">
                <tr>
                  <th
                    className="all-artifacts-table__th all-artifacts-table__th--sortable"
                    onClick={() => handleSort('title')}
                  >
                    <span className="all-artifacts-table__th-content">
                      Title <SortIndicator active={sortField === 'title'} dir={sortDir} />
                    </span>
                  </th>
                  <th className="all-artifacts-table__th">Type</th>
                  <th
                    className="all-artifacts-table__th all-artifacts-table__th--sortable"
                    onClick={() => handleSort('notebookTitle')}
                  >
                    <span className="all-artifacts-table__th-content">
                      Notebook <SortIndicator active={sortField === 'notebookTitle'} dir={sortDir} />
                    </span>
                  </th>
                  <th className="all-artifacts-table__th">Status</th>
                  <th
                    className="all-artifacts-table__th all-artifacts-table__th--sortable"
                    onClick={() => handleSort('createdAt')}
                  >
                    <span className="all-artifacts-table__th-content">
                      Created <SortIndicator active={sortField === 'createdAt'} dir={sortDir} />
                    </span>
                  </th>
                  <th className="all-artifacts-table__th">Action</th>
                </tr>
              </thead>
              <tbody>
                {artifacts.length === 0 ? (
                  <tr>
                    <td className="all-artifacts-table__empty-row" colSpan={6}>
                      No artifacts match the current filters.
                    </td>
                  </tr>
                ) : (
                  artifacts.map((artifact) => {
                    const actionMeta = getArtifactActionMeta(artifact.typeCode, artifact.status, artifact.mediaUrl);
                    const ActionIcon = actionMeta.kind === 'download' ? Download : ExternalLink;
                    return (
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
                        <td className="all-artifacts-table__td all-artifacts-table__td--action">
                          <div className="all-artifacts-table__action-group">
                            {artifact.typeCode === AUDIO_TYPE_CODE && artifact.status === STATUS_COMPLETED && artifact.mediaUrl && (
                              <AudioPlayButton
                                trackId={artifact.id}
                                title={artifact.title}
                                onPlay={() => playArtifact(artifact.mediaUrl!, artifact.id, artifact.title)}
                              />
                            )}
                            <button
                              className="all-artifacts-table__action-btn"
                              onClick={() => void handleArtifactAction(artifact)}
                              disabled={!!actionMeta.disabledReason}
                              title={actionMeta.disabledReason ?? actionMeta.label}
                              aria-label={actionMeta.label}
                            >
                              <ActionIcon size={14} strokeWidth={1.7} />
                              <span>{actionMeta.label}</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
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
