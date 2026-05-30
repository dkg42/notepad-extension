/**
 * @module AudioPlayer
 * @description Persistent audio playback bar. Pure presentation — every piece of state (current track, isPlaying, currentTime, duration, playbackRate) is read from the global audio context, and every control dispatches back through it. The play/pause control reuses the shared AudioPlayButton.
 * @dependencies @/contexts/NavigationContext, ../AudioPlayButton
 * @public AudioPlayer
 */
import React from 'react';
import { useNavigation } from '@/contexts/NavigationContext';
import AudioPlayButton from '../AudioPlayButton/AudioPlayButton';
import './AudioPlayer.css';

const SPEED_OPTIONS = [
  { value: 0.5, label: '0.5×' },
  { value: 0.75, label: '0.75×' },
  { value: 1, label: '1×' },
  { value: 1.25, label: '1.25×' },
  { value: 1.5, label: '1.5×' },
  { value: 2, label: '2×' },
];

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || isNaN(seconds)) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function AudioPlayer() {
  const {
    currentTrackId,
    audioTitle,
    currentTime,
    duration,
    playbackRate,
    seek,
    setPlaybackRate,
    resumeAudio,
    stopAudio,
  } = useNavigation();

  if (!currentTrackId) return null;

  return (
    <div className="audio-player">
      <AudioPlayButton
        trackId={currentTrackId}
        title={audioTitle}
        size={36}
        onPlay={resumeAudio}
      />
      {audioTitle && <span className="audio-player__title">{audioTitle}</span>}
      <input
        type="range"
        className="audio-player__seek"
        min={0}
        max={duration || 0}
        value={currentTime}
        onChange={(e) => seek(Number(e.target.value))}
      />
      <span className="audio-player__time">
        {formatTime(currentTime)} / {formatTime(duration)}
      </span>
      <select
        className="audio-player__speed-select"
        value={playbackRate}
        onChange={(e) => setPlaybackRate(Number(e.target.value))}
        title="Playback speed"
      >
        {SPEED_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      <button
        className="audio-player__close"
        onClick={stopAudio}
        title="Close player"
      >
        ✕
      </button>
    </div>
  );
}
