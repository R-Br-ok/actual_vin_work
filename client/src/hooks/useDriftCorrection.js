'use client';

import { useState, useEffect, useRef } from 'react';
import { DRIFT_THRESHOLDS, PLAYBACK_STATE } from '../lib/constants';

/**
 * Custom hook implementing dynamic 3-second playback drift correction.
 *
 * Rules:
 * - If drift > 500ms: direct hard seek (player.currentTime = target)
 * - If 100ms <= drift <= 500ms: smooth playbackRate nudge (1.05x or 0.95x)
 * - If drift < 100ms: normal playbackRate (1.0x)
 */
export function useDriftCorrection({
  videoRef,
  roomState,
  isHost,
  getServerTime,
}) {
  const [driftInfo, setDriftInfo] = useState({
    driftSeconds: 0,
    currentRate: 1.0,
    action: 'IN_SYNC',
    targetTime: 0,
  });

  const isSeekingRef = useRef(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !roomState) return;

    const interval = setInterval(() => {
      // Hosts dictate time and do not drift correct against themselves
      if (isHost || isSeekingRef.current) return;

      const currentServerTime = getServerTime();
      let targetTime = roomState.mediaTime;

      if (roomState.playbackState === PLAYBACK_STATE.PLAYING) {
        const elapsedSeconds = Math.max(0, (currentServerTime - (roomState.targetTimestamp || currentServerTime)) / 1000);
        targetTime = roomState.mediaTime + elapsedSeconds;
      }

      const clientTime = video.currentTime;
      const drift = targetTime - clientTime; // positive = behind server, negative = ahead of server
      const absDrift = Math.abs(drift);

      let action = 'IN_SYNC';
      let nextRate = DRIFT_THRESHOLDS.NORMAL_RATE;

      if (absDrift > DRIFT_THRESHOLDS.HARD_SEEK_SECONDS) {
        // Severe drift (> 500ms): execute direct hard seek
        action = 'HARD_SEEK';
        isSeekingRef.current = true;
        video.currentTime = targetTime;
        video.playbackRate = DRIFT_THRESHOLDS.NORMAL_RATE;
        nextRate = DRIFT_THRESHOLDS.NORMAL_RATE;

        setTimeout(() => {
          isSeekingRef.current = false;
        }, 150);
      } else if (absDrift > DRIFT_THRESHOLDS.SMOOTH_TOLERANCE_SECONDS) {
        // Moderate drift (100ms - 500ms): smooth rate nudge without audio pop
        if (drift > 0) {
          // Client is lagging behind -> nudge speed up
          action = 'SPEED_UP (1.05x)';
          nextRate = DRIFT_THRESHOLDS.SPEED_UP_RATE;
        } else {
          // Client is running ahead -> nudge slow down
          action = 'SLOW_DOWN (0.95x)';
          nextRate = DRIFT_THRESHOLDS.SLOW_DOWN_RATE;
        }
        video.playbackRate = nextRate;
      } else {
        // Within 100ms tolerance: perfect sync
        action = 'IN_SYNC';
        if (video.playbackRate !== DRIFT_THRESHOLDS.NORMAL_RATE) {
          video.playbackRate = DRIFT_THRESHOLDS.NORMAL_RATE;
        }
        nextRate = DRIFT_THRESHOLDS.NORMAL_RATE;
      }

      setDriftInfo({
        driftSeconds: Number(drift.toFixed(3)),
        currentRate: nextRate,
        action,
        targetTime: Number(targetTime.toFixed(2)),
      });
    }, DRIFT_THRESHOLDS.CORRECTION_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [videoRef, roomState, isHost, getServerTime]);

  return driftInfo;
}
