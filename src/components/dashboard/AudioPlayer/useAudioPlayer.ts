/**
 * @module useAudioPlayer
 * @description React hook that encapsulates all audio playback state and controls for the AudioPlayer component. Manages play/pause toggling, seek, playback rate, and auto-starts playback on mount.
 * @dependencies (none — React only)
 * @public useAudioPlayer, UseAudioPlayerReturn
 */
import { useCallback, useEffect, useRef, useState } from 'react';

export interface UseAudioPlayerReturn {
  audioRef: React.RefObject<HTMLAudioElement>;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  playbackRate: number;
  setCurrentTime: (t: number) => void;
  setDuration: (d: number) => void;
  setIsPlaying: (v: boolean) => void;
  setPlaybackRate: (rate: number) => void;
  togglePlay: () => void;
  seek: (time: number) => void;
}

export function useAudioPlayer(): UseAudioPlayerReturn {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRateState] = useState(1);

  // Auto-start playback when the component mounts (triggered by key change in parent).
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    void audio.play().catch(() => {
      // Autoplay may be blocked; user can click the play button manually.
    });
  }, []);

  // Sync playback rate to the audio element whenever it changes.
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  const togglePlay = useCallback(() => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      void audioRef.current.play();
    }
  }, [isPlaying]);

  const seek = useCallback((time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
    }
    setCurrentTime(time);
  }, []);

  const setPlaybackRate = useCallback((rate: number) => {
    setPlaybackRateState(rate);
  }, []);

  return {
    audioRef,
    isPlaying,
    currentTime,
    duration,
    playbackRate,
    setCurrentTime,
    setDuration,
    setIsPlaying,
    setPlaybackRate,
    togglePlay,
    seek,
  };
}
