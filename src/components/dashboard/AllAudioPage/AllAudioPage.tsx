/**
 * @module AllAudioPage
 * @description Renders a sortable, paginated table of all generated audio artifacts with search and inline playback controls; reads audio playback state from NavigationContext.
 * @dependencies useAllAudioPage, SearchBar, @/contexts/NavigationContext
 * @public AllAudioPage
 */
import React from 'react';
import { ChevronUp, ChevronDown, ChevronsUpDown, Music, Play as PlayIcon } from 'lucide-react';
import { useAllAudioPage } from './useAllAudioPage';
import SearchBar from '@/components/dashboard/SearchBar/SearchBar';
import { useNavigation } from '@/contexts/NavigationContext';
import './AllAudioPage.css';

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
  if (!active) return <ChevronsUpDown size={11} className="all-audio-sort-icon" />;
  return dir === 'asc'
    ? <ChevronUp size={11} className="all-audio-sort-icon all-audio-sort-icon--active" />
    : <ChevronDown size={11} className="all-audio-sort-icon all-audio-sort-icon--active" />;
}

export default function AllAudioPage() {
  const { playArtifact, isLoadingAudio } = useNavigation();
  const onPlayAudio = (mediaUrl: string, artifactId: string, title: string) =>
    void playArtifact(mediaUrl, artifactId, title);

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
    searchQuery,
    setSearchQuery,
    handleRefresh,
  } = useAllAudioPage();

  return (
    <div className="all-audio-page">
      <header className="all-audio-page__header">
        <div>
          <h1 className="all-audio-page__title">All Audio</h1>
          <p className="all-audio-page__subtitle">
            Aggregated from {notebookOptions.length} synced notebook{notebookOptions.length !== 1 ? 's' : ''}
            {' '}&middot; {totalCount} audio artifact{totalCount !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          className="all-audio-page__refresh-btn"
          onClick={handleRefresh}
          disabled={isLoading}
        >
          <span className={`all-audio-page__refresh-icon${isLoading ? ' all-audio-page__refresh-icon--spinning' : ''}`}>
            &#x27F3;
          </span>
          {isLoading ? 'Loading...' : 'Refresh'}
        </button>
      </header>

      {error && (
        <div className="all-audio-page__error">
          {error}
          <button className="all-audio-page__error-dismiss" onClick={() => setError(null)}>
            &#x2715;
          </button>
        </div>
      )}

      {!isLoading && totalCount > 0 && (
        <div className="all-audio-toolbar">
          <SearchBar
            className="all-audio-toolbar__search"
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search audio…"
          />
          <select
            className="all-audio-toolbar__filter"
            value={filterNotebook}
            onChange={(e) => setFilterNotebook(e.target.value)}
          >
            <option value="all">All notebooks</option>
            {notebookOptions.map((nb) => (
              <option key={nb.id} value={nb.id}>{nb.title}</option>
            ))}
          </select>
        </div>
      )}

      {isLoading && (
        <div className="all-audio-page__loading">Loading audio from all notebooks...</div>
      )}

      {!isLoading && totalCount === 0 && (
        <div className="all-audio-page__empty">
          <span className="all-audio-page__empty-icon">
            <Music size={40} strokeWidth={1.5} />
          </span>
          <p className="all-audio-page__empty-text">No audio artifacts found</p>
          <p className="all-audio-page__empty-hint">
            Generate audio overviews in NotebookLM, then sync your notebooks.
          </p>
        </div>
      )}

      {!isLoading && totalCount > 0 && (
        <div className="all-audio-table-wrapper">
          <div className="all-audio-table__scroll">
            <table className="all-audio-table">
              <colgroup>
                <col className="all-audio-table__col--title" />
                <col className="all-audio-table__col--notebook" />
                <col className="all-audio-table__col--status" />
                <col className="all-audio-table__col--created" />
                <col className="all-audio-table__col--play" />
              </colgroup>
              <thead className="all-audio-table__head">
                <tr>
                  <th
                    className="all-audio-table__th all-audio-table__th--sortable"
                    onClick={() => handleSort('title')}
                  >
                    <span className="all-audio-table__th-content">
                      Title <SortIndicator active={sortField === 'title'} dir={sortDir} />
                    </span>
                  </th>
                  <th
                    className="all-audio-table__th all-audio-table__th--sortable"
                    onClick={() => handleSort('notebookTitle')}
                  >
                    <span className="all-audio-table__th-content">
                      Notebook <SortIndicator active={sortField === 'notebookTitle'} dir={sortDir} />
                    </span>
                  </th>
                  <th className="all-audio-table__th">Status</th>
                  <th
                    className="all-audio-table__th all-audio-table__th--sortable"
                    onClick={() => handleSort('createdAt')}
                  >
                    <span className="all-audio-table__th-content">
                      Created <SortIndicator active={sortField === 'createdAt'} dir={sortDir} />
                    </span>
                  </th>
                  <th className="all-audio-table__th">Play</th>
                </tr>
              </thead>
              <tbody>
                {artifacts.length === 0 ? (
                  <tr>
                    <td className="all-audio-table__empty-row" colSpan={5}>
                      No audio matches the current filters.
                    </td>
                  </tr>
                ) : (
                  artifacts.map((artifact) => (
                    <tr key={`${artifact.notebookId}-${artifact.id}`} className="all-audio-table__row">
                      <td className="all-audio-table__td all-audio-table__td--title">
                        {artifact.title}
                      </td>
                      <td className="all-audio-table__td all-audio-table__td--notebook">
                        {artifact.notebookTitle}
                      </td>
                      <td className="all-audio-table__td">
                        <span className={`all-audio-status-badge all-audio-status-badge--${artifact.status}`}>
                          {STATUS_LABELS[artifact.status ?? 0] ?? 'Unknown'}
                        </span>
                      </td>
                      <td className="all-audio-table__td">
                        {formatDate(artifact.createdAt)}
                      </td>
                      <td className="all-audio-table__td all-audio-table__td--play">
                        {artifact.status === 3 && artifact.mediaUrl ? (
                          <button
                            className="all-audio-play-btn"
                            disabled={isLoadingAudio}
                            onClick={() => onPlayAudio(artifact.mediaUrl!, artifact.id, artifact.title)}
                          >
                            {isLoadingAudio ? (
                              <span className="all-audio-loading-spinner" />
                            ) : (
                              <PlayIcon size={11} strokeWidth={2} />
                            )}
                            Play
                          </button>
                        ) : (
                          <span style={{ color: 'var(--color-text-secondary)', fontSize: 12 }}>—</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="all-audio-table__footer">
            Showing {artifacts.length} of {totalCount} audio artifact{totalCount !== 1 ? 's' : ''}
          </div>
        </div>
      )}
    </div>
  );
}
