'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useRoom } from '../../context/RoomContext';
import { useSocket } from '../../hooks/useSocket';
import { useDriftCorrection } from '../../hooks/useDriftCorrection';
import { PlayerControls } from './PlayerControls';
import { DriftIndicator } from './DriftIndicator';
import { ReactionCanvas } from '../social/ReactionCanvas';
import { ReactionBar } from '../social/ReactionBar';
import { PLAYBACK_STATE, CONTROL_TYPE, SOCKET_EVENTS } from '../../lib/constants';

export function VideoSyncPlayer() {
  const {
    roomState,
    isHost,
    sendControlAction,
    sendHeartbeat,
    getServerTime,
    clockOffset,
    rtt,
    reactions,
    triggerReaction,
  } = useRoom();

  const { socket } = useSocket();
  const videoRef = useRef(null);
  const containerRef = useRef(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [controlsVisible, setControlsVisible] = useState(true);
  const hideControlsTimeout = useRef(null);

  // Dynamic drift correction engine hook
  const driftInfo = useDriftCorrection({
    videoRef,
    roomState,
    isHost,
    getServerTime,
  });

  // 1. Synchronize Video Source
  const currentVideoUrl = roomState?.videoUrl || 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';

  // 2. Late-Join & Remote State Consumption (PLAY / PAUSE / SEEK)
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !roomState) return;

    const shouldPlay = roomState.playbackState === PLAYBACK_STATE.PLAYING;

    if (shouldPlay && video.paused) {
      video.play().catch((err) => {
        console.warn('[Player] Autoplay prevented, requires user interaction:', err.message);
      });
      setIsPlaying(true);
    } else if (!shouldPlay && !video.paused) {
      video.pause();
      setIsPlaying(false);
    }
  }, [roomState?.playbackState, roomState?.targetTimestamp]);

  // 3. Remote Viewer Control Action Execution
  useEffect(() => {
    if (!socket) return;

    const handleRemoteControl = (payload) => {
      console.log('[VideoSyncPlayer] Remote CONTROL_ACTION_BROADCAST:', payload);
      const video = videoRef.current;
      if (!video) return;

      // a. If videoUrl changed, update video element src
      if (payload.videoUrl && video.src !== payload.videoUrl && !video.src.endsWith(payload.videoUrl)) {
        console.log('[VideoSyncPlayer] Switching video source to:', payload.videoUrl);
        video.src = payload.videoUrl;
        video.load();
      }

      // d. If action === 'SEEK', set videoRef.current.currentTime = mediaTime
      if (payload.action === CONTROL_TYPE.SEEK) {
        video.currentTime = payload.mediaTime;
        setCurrentTime(payload.mediaTime);
      }

      // b. If action === 'PLAY', call videoRef.current.play()
      if (payload.action === CONTROL_TYPE.PLAY) {
        if (Math.abs(video.currentTime - payload.mediaTime) > 0.3) {
          video.currentTime = payload.mediaTime;
        }
        video.play().catch((err) => {
          console.warn('[VideoSyncPlayer] Autoplay prevented on remote play:', err.message);
        });
        setIsPlaying(true);
      } else if (payload.action === CONTROL_TYPE.PAUSE) {
        // c. If action === 'PAUSE', call videoRef.current.pause()
        if (Math.abs(video.currentTime - payload.mediaTime) > 0.3) {
          video.currentTime = payload.mediaTime;
        }
        video.pause();
        setIsPlaying(false);
      }
    };

    socket.on(SOCKET_EVENTS.CONTROL_ACTION_BROADCAST, handleRemoteControl);

    return () => {
      socket.off(SOCKET_EVENTS.CONTROL_ACTION_BROADCAST, handleRemoteControl);
    };
  }, [socket]);

  // Handle video events
  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);

      // On initial metadata load (late join), jump directly to expected server position
      if (roomState) {
        let initialTarget = roomState.mediaTime || 0;
        if (roomState.playbackState === PLAYBACK_STATE.PLAYING && roomState.targetTimestamp) {
          const elapsed = Math.max(0, (getServerTime() - roomState.targetTimestamp) / 1000);
          initialTarget += elapsed;
        }
        videoRef.current.currentTime = initialTarget;
        if (roomState.playbackState === PLAYBACK_STATE.PLAYING) {
          videoRef.current.play().catch(() => {});
          setIsPlaying(true);
        }
      }
    }
  };

  // 4. Periodic Host Heartbeat (Every 3 seconds)
  useEffect(() => {
    if (!isHost) return;

    const heartbeatTimer = setInterval(() => {
      if (videoRef.current) {
        sendHeartbeat(
          videoRef.current.currentTime,
          videoRef.current.paused ? PLAYBACK_STATE.PAUSED : PLAYBACK_STATE.PLAYING
        );
      }
    }, 3000);

    return () => clearInterval(heartbeatTimer);
  }, [isHost, sendHeartbeat]);

  // 5. Host Control Handlers
  const handlePlayPause = useCallback(() => {
    if (!isHost || !videoRef.current) return;
    const video = videoRef.current;

    if (video.paused) {
      video.play().catch(() => {});
      setIsPlaying(true);
      sendControlAction(CONTROL_TYPE.PLAY, video.currentTime, currentVideoUrl);
    } else {
      video.pause();
      setIsPlaying(false);
      sendControlAction(CONTROL_TYPE.PAUSE, video.currentTime, currentVideoUrl);
    }
  }, [isHost, sendControlAction, currentVideoUrl]);

  const handleSeek = useCallback(
    (targetSeconds) => {
      if (!isHost || !videoRef.current) return;
      videoRef.current.currentTime = targetSeconds;
      setCurrentTime(targetSeconds);
      sendControlAction(CONTROL_TYPE.SEEK, targetSeconds, currentVideoUrl);
    },
    [isHost, sendControlAction, currentVideoUrl]
  );

  const handleToggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  // Auto-hide controls during playback
  const handleMouseMove = () => {
    setControlsVisible(true);
    if (hideControlsTimeout.current) clearTimeout(hideControlsTimeout.current);
    if (isPlaying) {
      hideControlsTimeout.current = setTimeout(() => {
        setControlsVisible(false);
      }, 3500);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Telemetry and Drift Header */}
      <div className="flex items-center justify-between px-1">
        <DriftIndicator
          rtt={rtt}
          clockOffset={clockOffset}
          driftInfo={driftInfo}
          isHost={isHost}
        />
        <ReactionBar onReact={triggerReaction} />
      </div>

      {/* Main Cinema Player Container */}
      <div
        ref={containerRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => isPlaying && setControlsVisible(false)}
        className="relative group aspect-video w-full overflow-hidden rounded-lg border border-line bg-panel shadow-2xl transition-all"
      >
        {/* Floating Emoji Canvas Overlay */}
        <ReactionCanvas reactions={reactions} />

        {/* HTML5 Video Element */}
        <video
          ref={videoRef}
          src={currentVideoUrl}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          playsInline
          className="w-full h-full object-contain bg-black cursor-pointer"
          onClick={isHost ? handlePlayPause : undefined}
        />

        {/* Big Center Play Indicator on Pause (Host only) */}
        {!isPlaying && isHost && (
          <div
            onClick={handlePlayPause}
            className="absolute inset-0 flex items-center justify-center bg-black/40 cursor-pointer z-10 transition-opacity"
          >
            <div className="w-16 h-16 rounded-full bg-accent text-accent-ink flex items-center justify-center pulse-accent hover:scale-110 transition shadow-2xl">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          </div>
        )}

        {/* Player Controls Overlay */}
        <div className={`transition-opacity duration-300 ${controlsVisible ? 'opacity-100' : 'opacity-0'}`}>
          <PlayerControls
            isPlaying={isPlaying}
            currentTime={currentTime}
            duration={duration}
            isHost={isHost}
            onPlayPause={handlePlayPause}
            onSeek={handleSeek}
            onToggleFullscreen={handleToggleFullscreen}
          />
        </div>
      </div>
    </div>
  );
}
