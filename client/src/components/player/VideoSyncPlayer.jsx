'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Play, Loader2, VolumeX, AlertTriangle, Pause } from 'lucide-react';
import { useRoom } from '../../context/RoomContext';
import { useDriftCorrection, computeExpectedMediaTime } from '../../hooks/useDriftCorrection';
import { PlayerControls } from './PlayerControls';
import { DriftIndicator } from './DriftIndicator';
import { ReactionCanvas } from './ReactionCanvas';
import { ReactionBar } from '../social/ReactionBar';
import { PLAYBACK_STATE, CONTROL_TYPE, HEARTBEAT_INTERVAL_MS } from '../../lib/constants';
import { DEFAULT_VIDEO_URL } from '../../data/mockMovies';
import { cn } from '../../lib/utils';

const CONTROLS_HIDE_MS = 3000;
const ALIGN_TOLERANCE_S = 0.25;

function resolveUrl(url) {
  try {
    return new URL(url, window.location.href).href;
  } catch {
    return url;
  }
}

export function VideoSyncPlayer() {
  const {
    roomState,
    syncEpoch,
    lastEvent,
    isHost,
    selfId,
    sendControlAction,
    sendHeartbeat,
    getServerTime,
    clockOffset,
    rtt,
    isSynced,
    triggerReaction,
    queue,
    playNext,
  } = useRoom();

  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const hideTimerRef = useRef(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [mutedByAutoplay, setMutedByAutoplay] = useState(false);
  const [needsGesture, setNeedsGesture] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const videoUrl = roomState?.videoUrl || DEFAULT_VIDEO_URL;
  const roomPlaying = roomState?.playbackState === PLAYBACK_STATE.PLAYING;
  const hasNext = queue.length > 0;

  // Latest values for callbacks that outlive renders (media events, intervals)
  const latest = useRef({});
  const driftInfo = useDriftCorrection({ videoRef, roomState, isHost, getServerTime });
  latest.current = {
    roomState,
    lastEvent,
    isHost,
    selfId,
    sendControlAction,
    sendHeartbeat,
    getServerTime,
    queue,
    playNext,
    needsGesture,
    evaluateNow: driftInfo.evaluateNow,
  };
  const pendingAlignRef = useRef(false);
  const pendingAutoplayRef = useRef(false);

  // ---- playback helpers -------------------------------------------------------------

  /** play() with autoplay-policy fallback: retry muted, else ask for a tap. */
  const safePlay = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return false;
    try {
      await video.play();
      setNeedsGesture(false);
      return true;
    } catch (err) {
      if (err?.name === 'AbortError') return false; // superseded by a new load/pause
      if (err?.name === 'NotAllowedError' && !video.muted) {
        video.muted = true;
        setIsMuted(true);
        try {
          await video.play();
          setMutedByAutoplay(true);
          setNeedsGesture(false);
          return true;
        } catch {
          /* fall through */
        }
      }
      setNeedsGesture(true);
      return false;
    }
  }, []);

  const isCurrentSource = useCallback((video, url) => video && video.src === resolveUrl(url), []);

  /** Host: start playback after a video change once the stream can actually play. */
  const tryHostAutoplay = useCallback(async () => {
    const video = videoRef.current;
    const { isHost: host, sendControlAction: send } = latest.current;
    if (!pendingAutoplayRef.current || !host || !video || video.readyState < 3) return;
    pendingAutoplayRef.current = false;
    if (await safePlay()) send(CONTROL_TYPE.PLAY, video.currentTime);
  }, [safePlay]);

  /**
   * Snap the local player to the room anchor. Runs on join, on every control broadcast
   * and on video changes (syncEpoch). Gradual drift is left to useDriftCorrection.
   */
  const alignToRoom = useCallback(() => {
    const video = videoRef.current;
    const { roomState: state, lastEvent: ev, isHost: host, selfId: self, getServerTime: now } = latest.current;
    if (!video || !state) return;

    if (video.readyState < 1 || !isCurrentSource(video, state.videoUrl)) {
      pendingAlignRef.current = true; // finish once metadata for the new source is in
      return;
    }
    pendingAlignRef.current = false;

    // The host already applied its own control actions locally.
    if (host && ev?.type === 'CONTROL' && ev.issuedBy === self) return;

    if (ev?.type === 'VIDEO') {
      if (video.currentTime > 0.05) video.currentTime = 0;
      if (host && ev.issuedBy === self && ev.autoplay) {
        pendingAutoplayRef.current = true;
        tryHostAutoplay();
      }
      if (state.playbackState !== PLAYBACK_STATE.PLAYING && !video.paused) video.pause();
      return;
    }

    const durationCap = Number.isFinite(video.duration) ? Math.max(0, video.duration - 0.25) : Infinity;
    const target = Math.min(computeExpectedMediaTime(state, now()), durationCap);
    const willSeek = Math.abs(video.currentTime - target) > ALIGN_TOLERANCE_S;
    if (willSeek) {
      video.currentTime = target;
    }
    video.playbackRate = state.playbackRate || 1;

    if (state.playbackState === PLAYBACK_STATE.PLAYING) {
      // Seeking/starting a playing stream lands a little behind (decode + buffer time).
      // Re-measure as soon as frames flow instead of waiting for the next 3s tick.
      if (!host && (willSeek || video.paused)) {
        const followUp = () => setTimeout(() => latest.current.evaluateNow?.(), 300);
        video.addEventListener(video.paused ? 'playing' : 'seeked', followUp, { once: true });
      }
      if (video.paused) safePlay();
    } else {
      if (!video.paused) video.pause();
      setNeedsGesture(false);
    }
  }, [isCurrentSource, safePlay, tryHostAutoplay]);

  useEffect(() => {
    alignToRoom();
  }, [syncEpoch, alignToRoom]);

  // New source: clear per-video UI state (React swaps the src attribute itself)
  useEffect(() => {
    setLoadError(null);
    setCurrentTime(0);
    setDuration(0);
    setBuffered(0);
    setIsBuffering(true);
  }, [videoUrl]);

  // ---- host heartbeat ---------------------------------------------------------------

  useEffect(() => {
    if (!isHost) return undefined;
    const timer = setInterval(() => {
      const video = videoRef.current;
      const { roomState: state, sendHeartbeat: beat, needsGesture: blocked } = latest.current;
      if (!video || !state || video.readyState < 1 || !isCurrentSource(video, state.videoUrl)) return;
      if (blocked || pendingAutoplayRef.current) return;
      // Don't re-anchor the room to a frozen frame while the host is buffering
      if (!video.paused && video.readyState < 3) return;
      beat(video.currentTime, video.paused ? PLAYBACK_STATE.PAUSED : PLAYBACK_STATE.PLAYING);
    }, HEARTBEAT_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [isHost, isCurrentSource]);

  // ---- host controls ----------------------------------------------------------------

  const handlePlayPause = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;

    if (!isHost) {
      // Viewers can only (re)join the room's playback
      if (roomPlaying) {
        alignToRoom();
        await safePlay();
      }
      return;
    }

    pendingAutoplayRef.current = false;
    if (video.paused) {
      if (await safePlay()) sendControlAction(CONTROL_TYPE.PLAY, video.currentTime);
    } else {
      video.pause();
      sendControlAction(CONTROL_TYPE.PAUSE, video.currentTime);
    }
  }, [isHost, roomPlaying, alignToRoom, safePlay, sendControlAction]);

  const handleSeek = useCallback(
    (seconds) => {
      const video = videoRef.current;
      if (!isHost || !video) return;
      const max = Number.isFinite(video.duration) ? video.duration : seconds;
      const target = Math.max(0, Math.min(seconds, max));
      video.currentTime = target;
      setCurrentTime(target);
      sendControlAction(CONTROL_TYPE.SEEK, target);
    },
    [isHost, sendControlAction]
  );

  const handleSkip = useCallback((delta) => handleSeek((videoRef.current?.currentTime || 0) + delta), [handleSeek]);

  const handleEnded = useCallback(() => {
    const { isHost: host, queue: q, playNext: next, sendControlAction: send } = latest.current;
    if (!host) return;
    if (q.length > 0) next();
    else send(CONTROL_TYPE.PAUSE, videoRef.current?.duration || 0);
  }, []);

  // ---- volume / fullscreen / chrome --------------------------------------------------

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = volume;
    video.muted = isMuted;
  }, [volume, isMuted]);

  const handleVolumeChange = (v) => {
    setVolume(v);
    setIsMuted(v === 0);
    setMutedByAutoplay(false);
  };

  const toggleMute = () => {
    setIsMuted((m) => !m);
    setMutedByAutoplay(false);
  };

  useEffect(() => {
    const onChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) containerRef.current.requestFullscreen?.().catch(() => {});
    else document.exitFullscreen?.().catch(() => {});
  };

  const revealControls = useCallback(() => {
    setControlsVisible(true);
    clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => setControlsVisible(false), CONTROLS_HIDE_MS);
  }, []);

  useEffect(() => () => clearTimeout(hideTimerRef.current), []);

  const handleKeyDown = (e) => {
    if (e.target !== containerRef.current) return;
    if (e.key === ' ' || e.key === 'k') {
      e.preventDefault();
      handlePlayPause();
    } else if (isHost && e.key === 'ArrowRight') handleSkip(5);
    else if (isHost && e.key === 'ArrowLeft') handleSkip(-5);
    else if (e.key === 'm') toggleMute();
    else if (e.key === 'f') toggleFullscreen();
    revealControls();
  };

  // ---- media element events ---------------------------------------------------------

  const updateBuffered = () => {
    const video = videoRef.current;
    if (!video || video.buffered.length === 0) return;
    for (let i = 0; i < video.buffered.length; i++) {
      if (video.buffered.start(i) <= video.currentTime + 0.5) setBuffered(video.buffered.end(i));
    }
  };

  const onLoadedMetadata = () => {
    const video = videoRef.current;
    if (!video) return;
    setDuration(video.duration || 0);
    if (pendingAlignRef.current) alignToRoom();
  };

  const onCanPlay = () => {
    setIsBuffering(false);
    if (pendingAlignRef.current) alignToRoom();
    tryHostAutoplay();
  };

  const onError = () => {
    const err = videoRef.current?.error;
    setIsBuffering(false);
    setLoadError(err?.code === 4 ? 'This source format isn’t supported or the URL is unreachable.' : 'The video failed to load.');
  };

  const showControls = controlsVisible || !isPlaying;
  // Only spin while something is supposed to be moving (preload may legitimately idle when paused)
  const showSpinner = isBuffering && !loadError && (isPlaying || roomPlaying);
  const viewerNeedsJoin = !isHost && roomPlaying && !isPlaying && !showSpinner && !loadError;
  const hostCanStart = isHost && !isPlaying && !loadError && !needsGesture;
  const title = roomState?.currentMovie?.title || 'Untitled stream';

  return (
    <div className="flex flex-col gap-3">
      <div
        ref={containerRef}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onMouseMove={revealControls}
        onMouseLeave={() => isPlaying && setControlsVisible(false)}
        onTouchStart={revealControls}
        className={cn(
          'group relative aspect-video w-full overflow-hidden rounded-2xl border border-white/[0.08] bg-black shadow-stage outline-none ring-accent/50 focus-visible:ring-2',
          isFullscreen && 'rounded-none border-0',
          !showControls && 'cursor-none'
        )}
      >
        <video
          ref={videoRef}
          src={videoUrl}
          preload="auto"
          playsInline
          onLoadedMetadata={onLoadedMetadata}
          onDurationChange={() => setDuration(videoRef.current?.duration || 0)}
          onCanPlay={onCanPlay}
          onWaiting={() => setIsBuffering(true)}
          onPlaying={() => setIsBuffering(false)}
          onSeeked={() => setIsBuffering(false)}
          onTimeUpdate={() => setCurrentTime(videoRef.current?.currentTime || 0)}
          onProgress={updateBuffered}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onEnded={handleEnded}
          onError={onError}
          onClick={handlePlayPause}
          className="h-full w-full bg-black object-contain"
        />

        <ReactionCanvas />

        {/* Top overlay: now playing + telemetry */}
        <div
          className={cn(
            'pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-end gap-3 sm:justify-between bg-gradient-to-b from-black/70 to-transparent p-3 transition-opacity duration-300 md:p-4',
            showControls ? 'opacity-100' : 'opacity-0'
          )}
        >
          <div className="glass-overlay hidden min-w-0 items-center gap-2 rounded-full px-3 py-1.5 sm:flex">
            <span
              className={cn(
                'flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-bold tracking-wider',
                roomPlaying ? 'bg-rose-500/90 text-white' : 'bg-white/15 text-app-text/80'
              )}
            >
              {roomPlaying ? 'LIVE' : 'PAUSED'}
            </span>
            <span className="truncate text-xs font-semibold text-app-text">{title}</span>
          </div>
          <DriftIndicator rtt={rtt} clockOffset={clockOffset} driftInfo={driftInfo} isHost={isHost} isSynced={isSynced} />
        </div>

        {/* Centre states */}
        {showSpinner && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
            <Loader2 size={44} className="animate-spin text-white/80" />
          </div>
        )}

        {hostCanStart && (
          <button
            type="button"
            onClick={handlePlayPause}
            className="absolute inset-0 z-10 flex items-center justify-center bg-black/30"
            aria-label="Play for everyone"
          >
            <span className="pulse-accent flex h-20 w-20 items-center justify-center rounded-full bg-accent text-white shadow-glow transition hover:scale-105">
              <Play size={30} fill="currentColor" className="ml-1" />
            </span>
          </button>
        )}

        {(viewerNeedsJoin || needsGesture) && (
          <button
            type="button"
            onClick={handlePlayPause}
            className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-black/55 backdrop-blur-[2px]"
          >
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-accent text-white shadow-glow">
              <Play size={26} fill="currentColor" className="ml-1" />
            </span>
            <span className="text-sm font-semibold text-white">Join the watch party</span>
            <span className="text-xs text-white/60">Your browser needs one tap before it can play</span>
          </button>
        )}

        {!isHost && !roomPlaying && !loadError && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
            <span className="glass-overlay flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold text-app-text/90">
              <Pause size={14} /> Paused by host
            </span>
          </div>
        )}

        {mutedByAutoplay && isMuted && (
          <button
            type="button"
            onClick={toggleMute}
            className="glass-overlay absolute left-1/2 top-16 z-30 flex -translate-x-1/2 items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold text-white transition hover:border-white/30"
          >
            <VolumeX size={14} /> Tap to unmute
          </button>
        )}

        {loadError && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-black/80 p-6 text-center">
            <AlertTriangle size={28} className="text-amber-400" />
            <p className="text-sm font-semibold text-white">{loadError}</p>
            <p className="max-w-md break-all font-mono text-[11px] text-white/50">{videoUrl}</p>
            {isHost && hasNext && (
              <button type="button" onClick={playNext} className="btn-primary mt-2">
                Skip to next in queue
              </button>
            )}
          </div>
        )}

        {/* Bottom controls */}
        <div
          className={cn(
            'absolute inset-x-0 bottom-0 z-20 transition-opacity duration-300',
            showControls ? 'opacity-100' : 'pointer-events-none opacity-0'
          )}
        >
          <PlayerControls
            isPlaying={isPlaying}
            currentTime={currentTime}
            duration={duration}
            buffered={buffered}
            isHost={isHost}
            volume={volume}
            isMuted={isMuted}
            isFullscreen={isFullscreen}
            hasNext={hasNext}
            onPlayPause={handlePlayPause}
            onSeek={handleSeek}
            onSkip={handleSkip}
            onNext={playNext}
            onVolumeChange={handleVolumeChange}
            onToggleMute={toggleMute}
            onToggleFullscreen={toggleFullscreen}
          />
        </div>
      </div>

      {/* Quick emoji bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ReactionBar onReact={triggerReaction} />
        {hasNext && (
          <p className="truncate text-xs text-muted">
            Up next: <span className="font-semibold text-app-text">{queue[0].title}</span>
          </p>
        )}
      </div>
    </div>
  );
}
