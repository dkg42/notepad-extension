/**
 * @module AudioPlayButton
 * @description The single shared play/pause control rendered next to every audio item in the dashboard (artifacts table, all-audio table, podcast track list, persistent player bar). Reads identity + transport state from the global audio context so it always reflects what is actually playing, and toggles pause/resume on the loaded track.
 * @dependencies @/contexts/NavigationContext, lucide-react
 * @public AudioPlayButton
 */
import React from 'react';
import { Play as PlayIcon, Pause as PauseIcon } from 'lucide-react';
import { useNavigation } from '@/contexts/NavigationContext';
import './AudioPlayButton.css';

interface AudioPlayButtonProps {
  /** Stable identity for this track (artifactId or customAudioId). */
  trackId: string;
  /** Accessible label for the button. */
  title?: string;
  /** Diameter in pixels. Defaults to 30. */
  size?: number;
  /** How to start playback when the track is not currently loaded. */
  onPlay: () => void | Promise<void>;
}

export default function AudioPlayButton({
  trackId,
  title,
  size = 30,
  onPlay,
}: AudioPlayButtonProps) {
  const {
    currentTrackId,
    isLoadingAudio,
    isPlaying,
    pauseAudio,
    resumeAudio,
  } = useNavigation();

  const isActive = currentTrackId === trackId;
  const isLoadingThis = isActive && isLoadingAudio;
  const isPlayingThis = isActive && isPlaying;

  const handleClick = () => {
    if (isLoadingThis) return;
    if (!isActive) {
      void onPlay();
      return;
    }
    if (isPlayingThis) {
      pauseAudio();
    } else {
      resumeAudio();
    }
  };

  const label = isLoadingThis
    ? 'Loading audio'
    : isPlayingThis
      ? `Pause ${title ?? 'audio'}`
      : `Play ${title ?? 'audio'}`;

  const iconSize = Math.round(size * 0.47);

  return (
    <button
      type="button"
      className={`audio-play-btn${isActive ? ' audio-play-btn--active' : ''}`}
      style={{ width: size, height: size }}
      onClick={handleClick}
      disabled={isLoadingThis}
      title={label}
      aria-label={label}
      aria-pressed={isPlayingThis}
    >
      {isLoadingThis ? (
        <span className="audio-play-btn__spinner" aria-hidden="true" />
      ) : isPlayingThis ? (
        <PauseIcon size={iconSize} strokeWidth={2} />
      ) : (
        <PlayIcon size={iconSize} strokeWidth={2} />
      )}
    </button>
  );
}
