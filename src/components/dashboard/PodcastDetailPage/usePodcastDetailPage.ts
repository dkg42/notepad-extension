/**
 * @module usePodcastDetailPage
 * @description Hook for the podcast episode detail page that manages the track list (add artifact, upload custom audio, remove, drag-reorder), fetches available audio artifacts from the background, and persists every change to storage.
 * @dependencies @/types, @/services/storage-service, @/services/podcast-audio-service, @/services/drive/podcast-audio-drive-service
 * @public usePodcastDetailPage
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { AggregatedArtifact, EpisodeTrack, PodcastEpisode } from '@/types';
import { storageService } from '@/services/storage-service';
import { podcastAudioService } from '@/services/podcast-audio-service';
import { podcastAudioDriveService } from '@/services/drive/podcast-audio-drive-service';

interface FetchAllArtifactsResult {
  ok: boolean;
  artifacts?: AggregatedArtifact[];
  error?: string;
}

export function usePodcastDetailPage(episodeId: string) {
  const [episode, setEpisode] = useState<PodcastEpisode | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Available audio artifacts
  const [availableArtifacts, setAvailableArtifacts] = useState<AggregatedArtifact[]>([]);
  const [isLoadingArtifacts, setIsLoadingArtifacts] = useState(false);
  const [artifactsError, setArtifactsError] = useState<string | null>(null);

  // Drag-reorder
  const draggedIndex = useRef<number | null>(null);

  // ── Load episode ────────────────────────────────────────────────────────────

  useEffect(() => {
    setIsLoading(true);
    storageService.getPodcastEpisodes()
      .then((episodes) => {
        const found = episodes.find((e) => e.id === episodeId) ?? null;
        setEpisode(found);
        if (!found) setError('Episode not found.');
      })
      .catch(() => setError('Failed to load episode.'))
      .finally(() => setIsLoading(false));
  }, [episodeId]);

  // ── Load available artifacts ─────────────────────────────────────────────

  const loadArtifacts = useCallback(async () => {
    setIsLoadingArtifacts(true);
    setArtifactsError(null);
    try {
      const result = await chrome.runtime.sendMessage({
        type: 'FETCH_ALL_ARTIFACTS',
      }) as FetchAllArtifactsResult;

      if (!result?.ok) {
        setArtifactsError(result?.error ?? 'Failed to fetch artifacts');
        return;
      }
      setAvailableArtifacts(
        (result.artifacts ?? []).filter((a) => a.typeCode === 1 && a.status === 3 && a.mediaUrl),
      );
    } catch {
      setArtifactsError('Failed to reach the extension background.');
    } finally {
      setIsLoadingArtifacts(false);
    }
  }, []);

  // ── Track management ─────────────────────────────────────────────────────

  const persistTracks = useCallback(async (tracks: EpisodeTrack[]) => {
    await storageService.updateEpisodeTracks(episodeId, tracks);
    setEpisode((prev) => prev ? { ...prev, tracks, updatedAt: Date.now() } : prev);
  }, [episodeId]);

  const handleAddArtifactTrack = useCallback(async (artifact: AggregatedArtifact) => {
    if (!episode) return;
    // Avoid duplicate tracks for the same artifact
    if (episode.tracks.some((t) => t.source.kind === 'artifact' && t.source.artifactId === artifact.id)) {
      return;
    }
    const track: EpisodeTrack = {
      trackId: crypto.randomUUID(),
      title: artifact.title,
      source: {
        kind: 'artifact',
        artifactId: artifact.id,
        mediaUrl: artifact.mediaUrl!,
        notebookId: artifact.notebookId,
        notebookTitle: artifact.notebookTitle,
      },
      addedAt: Date.now(),
    };
    await persistTracks([...episode.tracks, track]);
  }, [episode, persistTracks]);

  const handleUploadCustomAudio = useCallback(async (file: File) => {
    if (!episode) return;
    const id = crypto.randomUUID();
    await podcastAudioService.put(id, file.name, file, file.type);
    void podcastAudioDriveService.uploadCustomAudio({
      id,
      filename: file.name,
      mimeType: file.type,
      blob: file,
      addedAt: Date.now(),
    });
    const track: EpisodeTrack = {
      trackId: crypto.randomUUID(),
      title: file.name.replace(/\.[^/.]+$/, ''),
      source: { kind: 'custom', customAudioId: id },
      addedAt: Date.now(),
    };
    await persistTracks([...episode.tracks, track]);
  }, [episode, persistTracks]);

  const handleRemoveTrack = useCallback(async (trackId: string) => {
    if (!episode) return;
    const track = episode.tracks.find((t) => t.trackId === trackId);
    if (track?.source.kind === 'custom') {
      await podcastAudioService.remove(track.source.customAudioId);
      void podcastAudioDriveService.deleteCustomAudio(track.source.customAudioId);
    }
    await persistTracks(episode.tracks.filter((t) => t.trackId !== trackId));
  }, [episode, persistTracks]);

  const handleReorderTracks = useCallback(async (fromIdx: number, toIdx: number) => {
    if (!episode || fromIdx === toIdx) return;
    const updated = [...episode.tracks];
    const [moved] = updated.splice(fromIdx, 1);
    updated.splice(toIdx, 0, moved);
    await persistTracks(updated);
  }, [episode, persistTracks]);

  const handleRenameEpisode = useCallback(async (title: string) => {
    if (!episode || !title.trim()) return;
    const updated = { ...episode, title: title.trim(), updatedAt: Date.now() };
    await storageService.savePodcastEpisode(updated);
    setEpisode(updated);
  }, [episode]);

  return {
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
  };
}
