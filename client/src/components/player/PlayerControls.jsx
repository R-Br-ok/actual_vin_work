'use client';

import React, { useState } from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize, RotateCcw } from 'lucide-react';
import { formatTime } from '../../lib/utils';

export function PlayerControls({
  isPlaying,
  currentTime,
  duration,
  isHost,
  onPlayPause,
  onSeek,
  onToggleFullscreen,
}) {
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);

  const handleSeekChange = (e) => {
    if (!isHost) return;
    const newTime = parseFloat(e.target.value);
    onSeek(newTime);
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="absolute inset-x-0 bottom-0 z-20 flex flex-col justify-end p-4 pt-16 bg-gradient-to-t from-black/90 via-black/50 to-transparent transition-opacity duration-300">
      {/* Timeline Scrubber */}
      <div className="group relative flex items-center mb-3">
        <input
          type="range"
          min={0}
          max={duration || 100}
          step={0.1}
          value={currentTime || 0}
          onChange={handleSeekChange}
          disabled={!isHost}
          className={`w-full h-1.5 appearance-none rounded-lg bg-line-soft transition-all cursor-pointer accent-accent focus:outline-none ${
            !isHost ? 'opacity-80 cursor-not-allowed' : 'hover:h-2'
          }`}
          style={{
            background: `linear-gradient(to right, var(--accent) ${progressPercent}%, var(--line) ${progressPercent}%)`,
          }}
        />
      </div>

      {/* Control Buttons & Info Bar */}
      <div className="flex items-center justify-between text-app-text text-sm">
        {/* Left: Play/Pause, Replay & Timestamp */}
        <div className="flex items-center gap-3">
          {isHost ? (
            <button
              onClick={onPlayPause}
              className="flex items-center justify-center w-10 h-10 rounded-full bg-accent text-accent-ink hover:scale-105 active:scale-95 transition shadow-lg shadow-accent/20"
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-0.5" />}
            </button>
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-line bg-panel-soft/80 text-muted text-xs">
              <span className="w-2 h-2 rounded-full bg-secondary animate-pulse" />
              <span>Host Synced</span>
            </div>
          )}

          {isHost && (
            <button
              onClick={() => onSeek(0)}
              className="p-2 rounded-full hover:bg-white/10 text-muted hover:text-app-text transition"
              title="Restart"
            >
              <RotateCcw size={16} />
            </button>
          )}

          {/* Time Display */}
          <div className="font-mono text-xs tracking-wider text-muted">
            <span className="text-app-text">{formatTime(currentTime)}</span>
            <span className="mx-1">/</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Right: Audio Volume & Fullscreen */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsMuted(!isMuted)}
            className="p-2 rounded-full hover:bg-white/10 text-muted hover:text-app-text transition"
          >
            {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>

          <button
            onClick={onToggleFullscreen}
            className="p-2 rounded-full hover:bg-white/10 text-muted hover:text-app-text transition"
            title="Toggle Fullscreen"
          >
            <Maximize size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
