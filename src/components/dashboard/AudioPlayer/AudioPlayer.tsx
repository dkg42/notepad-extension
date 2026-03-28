import React from 'react';
import { useAudioPlayer } from './useAudioPlayer';
import './AudioPlayer.css';

interface AudioPlayerProps {
  audioUrl: string;
  title?: string;
  onClose: () => void;
  onEnded?: () => void;
}

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

export default function AudioPlayer({ audioUrl, title, onClose, onEnded }: AudioPlayerProps) {
  const {
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
  } = useAudioPlayer();

  return (
    <div className="audio-player">
      <audio
        ref={audioRef}
        src={audioUrl}
        autoPlay
        onTimeUpdate={() => {
          if (audioRef.current) setCurrentTime(audioRef.current.currentTime);
        }}
        onLoadedMetadata={() => {
          if (audioRef.current) {
            setDuration(audioRef.current.duration);
            // Apply stored playback rate when new audio loads
            audioRef.current.playbackRate = playbackRate;
          }
        }}
        onEnded={() => {
          setIsPlaying(false);
          onEnded?.();
        }}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onError={onClose}
      />
      <button className="audio-player__play-btn" onClick={togglePlay}>
        {isPlaying ? '❚❚' : '▶'}
      </button>
      {title && <span className="audio-player__title">{title}</span>}
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
        onClick={() => {
          if (audioRef.current) audioRef.current.pause();
          onClose();
        }}
        title="Close player"
      >
        ✕
      </button>
    </div>
  );
}
