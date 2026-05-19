/**
 * @module useGlobalAudio
 * @description React hook that manages a single global audio playback session for the dashboard — covering NotebookLM artifact audio (fetched and cached in IndexedDB via the background), user-uploaded custom audio (read from IndexedDB directly), and ordered podcast playlist navigation. Blob URLs are revoked on track change and unmount to prevent memory leaks.
 * @dependencies @/types, @/services/audio-cache-service, @/services/drive/podcast-audio-drive-service
 * @public UseGlobalAudioReturn, useGlobalAudio
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { EpisodeTrack } from '@/types';
import { audioCacheService } from '@/services/audio-cache-service';
import { podcastAudioDriveService } from '@/services/drive/podcast-audio-drive-service';

interface PodcastContext {
  tracks: EpisodeTrack[];
  currentIndex: number;
}

interface MessageResult {
  ok: boolean;
  error?: string;
}

export interface UseGlobalAudioReturn {
  audioUrl: string | null;
  audioTitle: string | undefined;
  isLoadingAudio: boolean;
  audioError: string | null;
  podcastContext: PodcastContext | null;
  setAudioError: (err: string | null) => void;
  playArtifact: (mediaUrl: string, artifactId: string, title: string) => Promise<void>;
  playCustomAudio: (customAudioId: string, title: string) => Promise<void>;
  playTrack: (track: EpisodeTrack, playlist?: EpisodeTrack[], index?: number) => Promise<void>;
  playNext: () => Promise<void>;
  stopAudio: () => void;
}

export function useGlobalAudio(): UseGlobalAudioReturn {
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioTitle, setAudioTitle] = useState<string | undefined>(undefined);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [podcastContext, setPodcastContext] = useState<PodcastContext | null>(null);

  // Keep a ref to podcastContext so playNext can read the latest value without
  // being stale inside an onEnded callback.
  const podcastContextRef = useRef<PodcastContext | null>(null);
  podcastContextRef.current = podcastContext;

  // Revoke old blob URL when a new one replaces it, and on unmount.
  useEffect(() => {
    return () => {
      if (audioUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  const stopAudio = useCallback(() => {
    setAudioUrl((prev) => {
      if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev);
      return null;
    });
    setAudioTitle(undefined);
    setPodcastContext(null);
    podcastContextRef.current = null;
  }, []);

  const playArtifact = useCallback(async (
    mediaUrl: string,
    artifactId: string,
    title: string,
  ) => {
    setIsLoadingAudio(true);
    setAudioError(null);
    // Revoke previous blob URL before loading new audio
    setAudioUrl((prev) => {
      if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev);
      return null;
    });

    try {
      const result = await chrome.runtime.sendMessage({
        type: 'FETCH_AUDIO_FOR_PLAYBACK',
        url: mediaUrl,
        artifactId,
      }) as MessageResult;

      if (!result?.ok) {
        setAudioError(result?.error ?? 'Failed to load audio');
        return;
      }

      const cached = await audioCacheService.get(artifactId);
      if (!cached) {
        setAudioError('Audio was cached but could not be read back — please try again');
        return;
      }

      setAudioUrl(URL.createObjectURL(cached.blob));
      setAudioTitle(title);
    } catch {
      setAudioError('Failed to reach the extension background.');
    } finally {
      setIsLoadingAudio(false);
    }
  }, []);

  const playCustomAudio = useCallback(async (customAudioId: string, title: string) => {
    setIsLoadingAudio(true);
    setAudioError(null);
    setAudioUrl((prev) => {
      if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev);
      return null;
    });

    try {
      const entry = await podcastAudioDriveService.ensureLocal(customAudioId);
      if (!entry) {
        setAudioError('Custom audio file not found. It may have been deleted.');
        return;
      }
      setAudioUrl(URL.createObjectURL(entry.blob));
      setAudioTitle(title);
    } catch {
      setAudioError('Failed to load custom audio.');
    } finally {
      setIsLoadingAudio(false);
    }
  }, []);

  const playTrack = useCallback(async (
    track: EpisodeTrack,
    playlist?: EpisodeTrack[],
    index?: number,
  ) => {
    // Set podcast context before fetching so it's available on the first play
    if (playlist !== undefined && index !== undefined) {
      const ctx = { tracks: playlist, currentIndex: index };
      setPodcastContext(ctx);
      podcastContextRef.current = ctx;
    } else {
      setPodcastContext(null);
      podcastContextRef.current = null;
    }

    if (track.source.kind === 'artifact') {
      await playArtifact(track.source.mediaUrl, track.source.artifactId, track.title);
    } else {
      await playCustomAudio(track.source.customAudioId, track.title);
    }
  }, [playArtifact, playCustomAudio]);

  const playNext = useCallback(async () => {
    const ctx = podcastContextRef.current;
    if (!ctx) {
      stopAudio();
      return;
    }
    const nextIndex = ctx.currentIndex + 1;
    if (nextIndex >= ctx.tracks.length) {
      stopAudio();
      return;
    }
    await playTrack(ctx.tracks[nextIndex], ctx.tracks, nextIndex);
  }, [playTrack, stopAudio]);

  return {
    audioUrl,
    audioTitle,
    isLoadingAudio,
    audioError,
    podcastContext,
    setAudioError,
    playArtifact,
    playCustomAudio,
    playTrack,
    playNext,
    stopAudio,
  };
}
