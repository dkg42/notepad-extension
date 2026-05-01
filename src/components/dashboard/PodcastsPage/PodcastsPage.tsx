/**
 * @module PodcastsPage
 * @description Renders the list of podcast episodes with creation and deletion controls; delegates to usePodcastsPage for episode data management and navigation to detail view.
 * @dependencies usePodcastsPage
 * @public PodcastsPage
 */
import React, { useState } from 'react';
import { usePodcastsPage } from './usePodcastsPage';
import './PodcastsPage.css';

interface PodcastsPageProps {
  onOpenEpisode: (id: string) => void;
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function PodcastsPage({ onOpenEpisode }: PodcastsPageProps) {
  const { episodes, isLoading, handleCreateEpisode, handleDeleteEpisode } =
    usePodcastsPage(onOpenEpisode);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');

  const submitCreate = () => {
    if (!newTitle.trim()) return;
    void handleCreateEpisode(newTitle);
    setNewTitle('');
    setShowCreateForm(false);
  };

  if (isLoading) {
    return <div className="podcasts-page__loading">Loading episodes…</div>;
  }

  return (
    <div className="podcasts-page">
      <header className="podcasts-page__header">
        <h1 className="podcasts-page__title">Podcast Episodes</h1>
        {!showCreateForm && (
          <button className="podcasts-page__new-btn" onClick={() => setShowCreateForm(true)}>
            + New Episode
          </button>
        )}
      </header>

      {showCreateForm && (
        <div className="podcasts-page__create-form">
          <input
            className="podcasts-page__create-input"
            type="text"
            placeholder="Episode title…"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submitCreate();
              if (e.key === 'Escape') { setShowCreateForm(false); setNewTitle(''); }
            }}
            autoFocus
          />
          <button className="podcasts-page__create-submit" onClick={submitCreate}>
            Create
          </button>
          <button
            className="podcasts-page__create-cancel"
            onClick={() => { setShowCreateForm(false); setNewTitle(''); }}
          >
            Cancel
          </button>
        </div>
      )}

      {episodes.length === 0 ? (
        <div className="podcasts-page__empty">
          <span className="podcasts-page__empty-icon">⏺</span>
          <p className="podcasts-page__empty-text">No episodes yet</p>
          <p className="podcasts-page__empty-hint">
            Create an episode and add audio artifacts or upload your own files.
          </p>
        </div>
      ) : (
        <div className="podcasts-page__grid">
          {episodes.map((episode) => (
            <div key={episode.id} className="episode-card">
              <div className="episode-card__header">
                <span
                  className="episode-card__title"
                  onClick={() => onOpenEpisode(episode.id)}
                >
                  {episode.title}
                </span>
                <button
                  className="episode-card__delete-btn"
                  title="Delete episode"
                  onClick={() => void handleDeleteEpisode(episode.id)}
                >
                  ✕
                </button>
              </div>
              <div className="episode-card__meta">
                <span className="episode-card__track-badge">
                  ♫ {episode.tracks.length} track{episode.tracks.length !== 1 ? 's' : ''}
                </span>
                <span className="episode-card__date">{formatDate(episode.createdAt)}</span>
              </div>
              <button
                className="episode-card__open-btn"
                onClick={() => onOpenEpisode(episode.id)}
              >
                Open →
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
