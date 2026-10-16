'use client';

import React, { useEffect, useState } from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize, Minimize, RotateCcw, RotateCw, SkipForward, Radio } from 'lucide-react';
import { formatTime, cn } from '../../lib/utils';
import { SpeedMenu } from './SpeedMenu';

export function PlayerControls({
  isPlaying,
  currentTime,
  duration,
  buffered,
  isHost,
  volume,
  isMuted,
  isFullscreen,
  hasNext,
  onPlayPause,
  onSeek,
  onSkip,
  onNext,
  onVolumeChange,
  onToggleMute,
  onToggleFullscreen,
  playbackRate = 1,
  onRateChange,
}) {
  // While dragging the scrubber we preview locally and only commit (emit SEEK) on release
  const [scrubValue, setScrubValue] = useState(null);
  useEffect(() => {
    if (!isHost) setScrubValue(null);
  }, [isHost]);

  const shownTime = scrubValue ?? currentTime;
  const safeDuration = duration > 0 ? duration : 0;
  const progress = safeDuration ? (shownTime / safeDuration) * 100 : 0;
  const bufferedPct = safeDuration ? Math.min(100, (buffered / safeDuration) * 100) : 0;

  const commitScrub = () => {
    if (scrubValue !== null) {
      onSeek(scrubValue);
      setScrubValue(null);
    }
  };

  return (
    <div className="pointer-events-auto bg-gradient-to-t from-black/90 via-black/55 to-transparent px-3 pb-3 pt-14 md:px-5 md:pb-4">
      {/* Scrubber */}
      <div className="relative mb-2.5 h-4">
        <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 overflow-hidden rounded-full bg-white/15">
          <div className="absolute inset-y-0 left-0 bg-white/20" style={{ width: `${bufferedPct}%` }} />
          <div className="absolute inset-y-0 left-0 bg-accent" style={{ width: `${progress}%` }} />
        </div>
        <input
          type="range"
          min={0}
          max={safeDuration || 1}
          step={0.1}
          value={Math.min(shownTime, safeDuration || 1)}
          disabled={!isHost || !safeDuration}
          onChange={(e) => setScrubValue(parseFloat(e.target.value))}
          onPointerUp={commitScrub}
          onKeyUp={commitScrub}
          onBlur={commitScrub}
          className="range absolute inset-0 h-4 w-full"
          aria-label="Seek"
          title={isHost ? 'Seek' : 'Only the host can seek'}
        />
      </div>

      <div className="flex items-center justify-between gap-2 text-app-text">
        <div className="flex items-center gap-1 md:gap-2">
          {isHost ? (
            <>
              <button
                type="button"
                onClick={onPlayPause}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-ink transition hover:scale-105 active:scale-95"
                aria-label={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-0.5" />}
              </button>
              <button type="button" onClick={() => onSkip(-10)} className="icon-btn" aria-label="Back 10 seconds">
                <RotateCcw size={17} />
              </button>
              <button type="button" onClick={() => onSkip(10)} className="icon-btn" aria-label="Forward 10 seconds">
                <RotateCw size={17} />
              </button>
              <button
                type="button"
                onClick={onNext}
                disabled={!hasNext}
                className="icon-btn"
                aria-label="Play next in queue"
                title={hasNext ? 'Play next in queue' : 'Queue is empty'}
              >
                <SkipForward size={17} />
              </button>
            </>
          ) : (
            <span className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-[11px] font-semibold text-app-text/80">
              <Radio size={12} className="text-secondary" />
              Following host
            </span>
          )}

          <span className="ml-1 font-mono text-xs tabular-nums text-app-text/80">
            {formatTime(shownTime)} <span className="text-app-text/40">/</span> {formatTime(safeDuration)}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <SpeedMenu rate={playbackRate} isHost={isHost} onChange={onRateChange} />
          <div className="group/vol flex items-center">
            <button type="button" onClick={onToggleMute} className="icon-btn" aria-label={isMuted ? 'Unmute' : 'Mute'}>
              {isMuted || volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>
            <div className="relative hidden h-4 w-0 overflow-hidden transition-all duration-200 group-hover/vol:w-20 sm:block">
              <div className="absolute inset-x-1 top-1/2 h-1 -translate-y-1/2 rounded-full bg-white/20">
                <div className="h-full rounded-full bg-white" style={{ width: `${(isMuted ? 0 : volume) * 100}%` }} />
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={isMuted ? 0 : volume}
                onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
                className="range absolute inset-0 h-4 w-full"
                aria-label="Volume"
              />
            </div>
          </div>
          <button
            type="button"
            onClick={onToggleFullscreen}
            className={cn('icon-btn')}
            aria-label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
          </button>
        </div>
      </div>
    </div>
  );
}
