/**
 * @module useGlobalAudio
 * @description React hook that owns the dashboard's single global Audio element and exposes its full state (current track identity, isPlaying, currentTime, duration, playbackRate) plus imperative controls (play/pause/resume/seek/setRate/stop) used by the persistent AudioPlayer bar and the shared AudioPlayButton across every page.
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
  // Identity + transport state
  currentTrackId: string | null;
  audioTitle: string | undefined;
  isLoadingAudio: boolean;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  playbackRate: number;
  audioError: string | null;
  podcastContext: PodcastContext | null;
  hasAudio: boolean;
  setAudioError: (err: string | null) => void;
  // Track-launching actions
  playArtifact: (mediaUrl: string, artifactId: string, title: string) => Promise<void>;
  playCustomAudio: (customAudioId: string, title: string) => Promise<void>;
  playTrack: (track: EpisodeTrack, playlist?: EpisodeTrack[], index?: number) => Promise<void>;
  playNext: () => Promise<void>;
  // Transport actions on the loaded audio
  pauseAudio: () => void;
  resumeAudio: () => void;
  seek: (time: number) => void;
  setPlaybackRate: (rate: number) => void;
  stopAudio: () => void;
}

export function useGlobalAudio(): UseGlobalAudioReturn {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  if (audioRef.current === null && typeof Audio !== 'undefined') {
    audioRef.current = new Audio();
  }

  const blobUrlRef = useRef<string | null>(null);
  const [currentTrackId, setCurrentTrackId] = useState<string | null>(null);
  const [audioTitle, setAudioTitle] = useState<string | undefined>(undefined);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRateState] = useState(1);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [podcastContext, setPodcastContext] = useState<PodcastContext | null>(null);

  const podcastContextRef = useRef<PodcastContext | null>(null);
  podcastContextRef.current = podcastContext;

  // Forward declaration so playNext can be referenced inside the `ended` listener
  // without a circular dependency in the useCallback graph.
  const playTrackRef = useRef<(t: EpisodeTrack, p?: EpisodeTrack[], i?: number) => Promise<void>>(
    async () => {},
  );

  const revokeBlobUrl = useCallback(() => {
    if (blobUrlRef.current?.startsWith('blob:')) {
      URL.revokeObjectURL(blobUrlRef.current);
    }
    blobUrlRef.current = null;
  }, []);

  const stopAudio = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
    }
    revokeBlobUrl();
    setCurrentTrackId(null);
    setAudioTitle(undefined);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setPodcastContext(null);
    podcastContextRef.current = null;
  }, [revokeBlobUrl]);

  // Wire audio element events to React state. The element itself is stable
  // across the component's lifetime, so a single effect on mount suffices.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onLoadedMetadata = () => setDuration(audio.duration);
    const onRateChange = () => setPlaybackRateState(audio.playbackRate);
    const onEnded = () => {
      setIsPlaying(false);
      const ctx = podcastContextRef.current;
      if (!ctx) return;
      const nextIndex = ctx.currentIndex + 1;
      if (nextIndex >= ctx.tracks.length) return;
      void playTrackRef.current(ctx.tracks[nextIndex], ctx.tracks, nextIndex);
    };
    const onError = () => {
      setAudioError('Audio playback failed.');
      setIsPlaying(false);
    };

    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('ratechange', onRateChange);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);

    return () => {
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('ratechange', onRateChange);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
      if (blobUrlRef.current?.startsWith('blob:')) {
        URL.revokeObjectURL(blobUrlRef.current);
      }
      blobUrlRef.current = null;
    };
  }, []);

  const loadBlobAndPlay = useCallback((blob: Blob, trackId: string, title: string) => {
    const audio = audioRef.current;
    if (!audio) return;
    revokeBlobUrl();
    const url = URL.createObjectURL(blob);
    blobUrlRef.current = url;
    audio.src = url;
    audio.playbackRate = playbackRate;
    setCurrentTrackId(trackId);
    setAudioTitle(title);
    setCurrentTime(0);
    setDuration(0);
    void audio.play().catch(() => {
      // Autoplay may be blocked; the play button can still resume.
    });
  }, [playbackRate, revokeBlobUrl]);

  const playArtifact = useCallback(async (
    mediaUrl: string,
    artifactId: string,
    title: string,
  ) => {
    setIsLoadingAudio(true);
    setAudioError(null);

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

      loadBlobAndPlay(cached.blob, artifactId, title);
    } catch {
      setAudioError('Failed to reach the extension background.');
    } finally {
      setIsLoadingAudio(false);
    }
  }, [loadBlobAndPlay]);

  const playCustomAudio = useCallback(async (customAudioId: string, title: string) => {
    setIsLoadingAudio(true);
    setAudioError(null);

    try {
      const entry = await podcastAudioDriveService.ensureLocal(customAudioId);
      if (!entry) {
        setAudioError('Custom audio file not found. It may have been deleted.');
        return;
      }
      loadBlobAndPlay(entry.blob, customAudioId, title);
    } catch {
      setAudioError('Failed to load custom audio.');
    } finally {
      setIsLoadingAudio(false);
    }
  }, [loadBlobAndPlay]);

  const playTrack = useCallback(async (
    track: EpisodeTrack,
    playlist?: EpisodeTrack[],
    index?: number,
  ) => {
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

  playTrackRef.current = playTrack;

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

  const pauseAudio = useCallback(() => {
    audioRef.current?.pause();
  }, []);

  const resumeAudio = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !audio.src) return;
    void audio.play().catch(() => {
      // Browser may block; nothing actionable to do here.
    });
  }, []);

  const seek = useCallback((time: number) => {
    const audio = audioRef.current;
    if (audio) audio.currentTime = time;
    setCurrentTime(time);
  }, []);

  const setPlaybackRate = useCallback((rate: number) => {
    const audio = audioRef.current;
    if (audio) audio.playbackRate = rate;
    setPlaybackRateState(rate);
  }, []);

  return {
    currentTrackId,
    audioTitle,
    isLoadingAudio,
    isPlaying,
    currentTime,
    duration,
    playbackRate,
    audioError,
    podcastContext,
    hasAudio: currentTrackId !== null,
    setAudioError,
    playArtifact,
    playCustomAudio,
    playTrack,
    playNext,
    pauseAudio,
    resumeAudio,
    seek,
    setPlaybackRate,
    stopAudio,
  };
}
