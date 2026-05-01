/**
 * @module PodcastDetailPage
 * @description Renders the detail view for a single podcast episode, including a drag-to-reorder track list, artifact picker panel, custom audio upload, and episode rename functionality.
 * @dependencies usePodcastDetailPage, @/types (EpisodeTrack)
 * @public PodcastDetailPage
 */
import React, { useRef, useState } from 'react';
import type { EpisodeTrack } from '@/types';
import { usePodcastDetailPage } from './usePodcastDetailPage';
import './PodcastDetailPage.css';

interface PodcastDetailPageProps {
  episodeId: string;
  onBack: () => void;
  onPlayTrack: (track: EpisodeTrack, playlist: EpisodeTrack[], index: number) => void;
  isLoadingAudio: boolean;
  activeTrackIndex: number;
}

export default function PodcastDetailPage({
  episodeId,
  onBack,
  onPlayTrack,
  isLoadingAudio,
  activeTrackIndex,
}: PodcastDetailPageProps) {
  const {
    episode,
    isLoading,
    error,
    availableArtifacts,
    isLoadingArtifacts,
    artifactsError,
    draggedIndex,
    loadArtifacts,
    handleAddArtifactTrack,
    handleUploadCustomAudio,
    handleRemoveTrack,
    handleReorderTracks,
    handleRenameEpisode,
  } = usePodcastDetailPage(episodeId);

  const [artifactsPanelOpen, setArtifactsPanelOpen] = useState(false);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const toggleArtifactsPanel = () => {
    if (!artifactsPanelOpen && availableArtifacts.length === 0) {
      void loadArtifacts();
    }
    setArtifactsPanelOpen((v) => !v);
  };

  if (isLoading) {
    return <div className="podcast-detail__loading">Loading episode…</div>;
  }

  if (error || !episode) {
    return (
      <div className="podcast-detail__error">
        {error ?? 'Episode not found.'}
        <button onClick={onBack}>← Back to Podcasts</button>
      </div>
    );
  }

  const addedArtifactIds = new Set(
    episode.tracks
      .filter((t) => t.source.kind === 'artifact')
      .map((t) => (t.source.kind === 'artifact' ? t.source.artifactId : '')),
  );

  return (
    <div className="podcast-detail">
      <div className="podcast-detail__header">
        <button className="podcast-detail__back-btn" onClick={onBack} title="Back to episodes">
          ←
        </button>
        <input
          className="podcast-detail__title-input"
          type="text"
          defaultValue={episode.title}
          onBlur={(e) => void handleRenameEpisode(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          }}
        />
      </div>

      <div className="podcast-detail__body">
        {/* ── Track list ──────────────────────────────────────────────────── */}
        <div className="podcast-detail__tracks">
          <div className="podcast-detail__tracks-header">
            <h2 className="podcast-detail__tracks-title">
              Tracks ({episode.tracks.length})
            </h2>
            <button
              className="podcast-detail__upload-btn"
              onClick={() => fileInputRef.current?.click()}
            >
              ↑ Upload Audio
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".mp3,.wav,.ogg,.m4a,.aac,.flac"
              style={{ display: 'none' }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleUploadCustomAudio(file);
                e.target.value = '';
              }}
            />
          </div>

          {episode.tracks.length === 0 ? (
            <div className="podcast-detail__tracks-empty">
              No tracks yet. Add audio from the Artifacts panel or upload a file.
            </div>
          ) : (
            episode.tracks.map((track, idx) => (
              <div
                key={track.trackId}
                className={[
                  'track-item',
                  draggedIndex.current === idx ? 'track-item--dragging' : '',
                  dragOverIndex === idx ? 'track-item--drag-over' : '',
                  activeTrackIndex === idx ? 'track-item--playing' : '',
                ].filter(Boolean).join(' ')}
                draggable
                onDragStart={() => { draggedIndex.current = idx; }}
                onDragOver={(e) => { e.preventDefault(); setDragOverIndex(idx); }}
                onDragLeave={() => setDragOverIndex(null)}
                onDrop={() => {
                  if (draggedIndex.current !== null) {
                    void handleReorderTracks(draggedIndex.current, idx);
                  }
                  draggedIndex.current = null;
                  setDragOverIndex(null);
                }}
                onDragEnd={() => { draggedIndex.current = null; setDragOverIndex(null); }}
              >
                <span className="track-item__drag-handle">⋮⋮</span>
                <div className="track-item__info">
                  <div className="track-item__title">{track.title}</div>
                  <div className="track-item__source">
                    {track.source.kind === 'artifact'
                      ? `From: ${track.source.notebookTitle}`
                      : 'Custom upload'}
                  </div>
                </div>
                <button
                  className="track-item__play-btn"
                  disabled={isLoadingAudio}
                  title="Play"
                  onClick={() => onPlayTrack(track, episode.tracks, idx)}
                >
                  {activeTrackIndex === idx ? '❚❚' : (isLoadingAudio ? '…' : '▶')}
                </button>
                <button
                  className="track-item__remove-btn"
                  title="Remove track"
                  onClick={() => void handleRemoveTrack(track.trackId)}
                >
                  ✕
                </button>
              </div>
            ))
          )}
        </div>

        {/* ── Add from Artifacts panel ─────────────────────────────────────── */}
        <div className="podcast-detail__panel">
          <div
            className="podcast-detail__panel-header"
            onClick={toggleArtifactsPanel}
          >
            <h3 className="podcast-detail__panel-title">Add from Artifacts</h3>
            <span className={`podcast-detail__panel-caret${artifactsPanelOpen ? ' podcast-detail__panel-caret--open' : ''}`}>
              &#x25B8;
            </span>
          </div>

          {artifactsPanelOpen && (
            <>
              {isLoadingArtifacts && (
                <div className="podcast-detail__panel-loading">Loading artifacts…</div>
              )}
              {artifactsError && (
                <div className="podcast-detail__panel-error">{artifactsError}</div>
              )}
              {!isLoadingArtifacts && !artifactsError && availableArtifacts.length === 0 && (
                <div className="podcast-detail__panel-empty">
                  No completed audio artifacts found. Sync your notebooks first.
                </div>
              )}
              {!isLoadingArtifacts && availableArtifacts.length > 0 && (
                <div className="podcast-detail__artifacts-list">
                  {availableArtifacts.map((artifact) => {
                    const alreadyAdded = addedArtifactIds.has(artifact.id);
                    return (
                      <div
                        key={`${artifact.notebookId}-${artifact.id}`}
                        className={`podcast-detail__artifact-item${alreadyAdded ? ' podcast-detail__artifact-item--added' : ''}`}
                      >
                        <div>
                          <div className="podcast-detail__artifact-name">{artifact.title}</div>
                          <div className="podcast-detail__artifact-notebook">{artifact.notebookTitle}</div>
                        </div>
                        <button
                          className="podcast-detail__artifact-add-btn"
                          disabled={alreadyAdded}
                          title={alreadyAdded ? 'Already added' : 'Add to episode'}
                          onClick={() => !alreadyAdded && void handleAddArtifactTrack(artifact)}
                        >
                          +
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
