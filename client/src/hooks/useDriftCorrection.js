'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { DRIFT_THRESHOLDS, PLAYBACK_STATE } from '../lib/constants';

export const DRIFT_STATUS = {
  ALIGNED: 'ALIGNED',
  SPEED_UP: 'SPEED_UP',
  SLOW_DOWN: 'SLOW_DOWN',
  HARD_SEEK: 'HARD_SEEK',
  BUFFERING: 'BUFFERING',
  PAUSED: 'PAUSED',
  BLOCKED: 'BLOCKED', // room is playing but the browser blocked autoplay
  MASTER: 'MASTER', // host: authoritative clock, never corrected
  IDLE: 'IDLE',
};

/**
 * Expected media position right now, from the room's anchor:
 *   Δt         = (Date.now() + θ − targetTimestamp) / 1000 × playbackRate
 *   M_expected = mediaTime + Δt
 * `serverNow` is Date.now() + θ (see useClockSync). Paused rooms don't advance.
 */
export function computeExpectedMediaTime(roomState, serverNow) {
  if (!roomState) return 0;
  const mediaTime = Number(roomState.mediaTime) || 0;
  if (roomState.playbackState !== PLAYBACK_STATE.PLAYING) return mediaTime;
  const rate = Number(roomState.playbackRate) || 1;
  const deltaT = ((serverNow - Number(roomState.targetTimestamp || serverNow)) / 1000) * rate;
  return Math.max(0, mediaTime + deltaT);
}

/**
 * Correction policy for Drift = M_expected − video.currentTime (seconds).
 *   |Drift| > 0.50          -> hard seek to M_expected
 *   0.10 ≤ Drift ≤ 0.50     -> client behind: playbackRate 1.05
 *  −0.50 ≤ Drift ≤ −0.10    -> client ahead:  playbackRate 0.95
 *   |Drift| < 0.10          -> aligned:       playbackRate 1.00
 */
export function classifyDrift(drift, baseRate = 1) {
  const abs = Math.abs(drift);
  if (abs > DRIFT_THRESHOLDS.HARD_SEEK_SECONDS) {
    return { status: DRIFT_STATUS.HARD_SEEK, rate: baseRate * DRIFT_THRESHOLDS.NORMAL_RATE };
  }
  if (drift >= DRIFT_THRESHOLDS.SMOOTH_TOLERANCE_SECONDS) {
    return { status: DRIFT_STATUS.SPEED_UP, rate: baseRate * DRIFT_THRESHOLDS.SPEED_UP_RATE };
  }
  if (drift <= -DRIFT_THRESHOLDS.SMOOTH_TOLERANCE_SECONDS) {
    return { status: DRIFT_STATUS.SLOW_DOWN, rate: baseRate * DRIFT_THRESHOLDS.SLOW_DOWN_RATE };
  }
  return { status: DRIFT_STATUS.ALIGNED, rate: baseRate * DRIFT_THRESHOLDS.NORMAL_RATE };
}

const INITIAL_INFO = {
  drift: 0,
  driftMs: 0,
  expected: 0,
  actual: 0,
  rate: 1,
  status: DRIFT_STATUS.IDLE,
  lastCheckedAt: 0,
};

/**
 * Periodic (3 s) drift evaluation + correction for viewers. The host is the master clock:
 * its drift is measured for telemetry but never corrected.
 */
export function useDriftCorrection({ videoRef, roomState, isHost, getServerTime, enabled = true }) {
  const [driftInfo, setDriftInfo] = useState(INITIAL_INFO);

  const roomStateRef = useRef(roomState);
  const isHostRef = useRef(isHost);
  roomStateRef.current = roomState;
  isHostRef.current = isHost;

  // A seek on a playing video takes time (decode/buffer), so a hard seek to M_expected lands
  // behind. We learn that latency from each 'seeked' and lead future hard seeks by it.
  const seekLeadRef = useRef(0);

  const hardSeek = useCallback(
    (video, expected) => {
      const lead = Math.min(Math.max(seekLeadRef.current, 0), 1);
      video.currentTime = expected + lead;

      const onSeeked = () => {
        const state = roomStateRef.current;
        if (!state || state.playbackState !== PLAYBACK_STATE.PLAYING || isHostRef.current) return;
        const residual = computeExpectedMediaTime(state, getServerTime()) - video.currentTime;
        seekLeadRef.current = Math.min(Math.max(seekLeadRef.current + residual * 0.6, 0), 1);
        // Mop up what's left with a rate nudge right away instead of waiting a full cycle
        if (Math.abs(residual) <= DRIFT_THRESHOLDS.HARD_SEEK_SECONDS) {
          const { rate } = classifyDrift(residual, Number(state.playbackRate) || 1);
          video.playbackRate = rate;
        }
      };
      video.addEventListener('seeked', onSeeked, { once: true });
    },
    [getServerTime]
  );

  const evaluate = useCallback(() => {
    const video = videoRef.current;
    const state = roomStateRef.current;
    if (!video || !state || video.readyState < 1 /* HAVE_METADATA */) {
      setDriftInfo((prev) => ({ ...prev, status: DRIFT_STATUS.IDLE }));
      return;
    }

    const baseRate = Number(state.playbackRate) || 1;
    const duration = Number.isFinite(video.duration) ? video.duration : Infinity;
    const expected = Math.min(computeExpectedMediaTime(state, getServerTime()), duration);
    const actual = video.currentTime;
    const drift = expected - actual;
    const isPlayingRoom = state.playbackState === PLAYBACK_STATE.PLAYING;

    const report = (status, rate) =>
      setDriftInfo({
        drift,
        driftMs: Math.round(drift * 1000),
        expected,
        actual,
        rate,
        status,
        lastCheckedAt: Date.now(),
      });

    // Host = authority. Measure only.
    if (isHostRef.current) {
      if (video.playbackRate !== baseRate) video.playbackRate = baseRate;
      report(DRIFT_STATUS.MASTER, video.playbackRate);
      return;
    }

    // Paused room: just make sure we're parked on the right frame.
    if (!isPlayingRoom) {
      if (!video.paused) video.pause();
      if (video.playbackRate !== baseRate) video.playbackRate = baseRate;
      if (Math.abs(drift) > DRIFT_THRESHOLDS.HARD_SEEK_SECONDS && !video.seeking) {
        video.currentTime = expected;
        report(DRIFT_STATUS.HARD_SEEK, baseRate);
      } else {
        report(DRIFT_STATUS.PAUSED, baseRate);
      }
      return;
    }

    // Room is playing but this tab is paused (autoplay blocked) — the player shows a prompt.
    if (video.paused) {
      report(DRIFT_STATUS.BLOCKED, video.playbackRate);
      return;
    }

    // Mid-seek or starved for data: correcting now would just cause seek loops.
    if (video.seeking || video.readyState < 3 /* HAVE_FUTURE_DATA */) {
      report(DRIFT_STATUS.BUFFERING, video.playbackRate);
      return;
    }

    const { status, rate } = classifyDrift(drift, baseRate);

    if (video.playbackRate !== rate) {
      video.playbackRate = rate;
    }
    if (status === DRIFT_STATUS.HARD_SEEK) {
      hardSeek(video, expected);
    }
    report(status, rate);
  }, [videoRef, getServerTime, hardSeek]);

  useEffect(() => {
    if (!enabled) return undefined;
    const interval = setInterval(evaluate, DRIFT_THRESHOLDS.CORRECTION_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [enabled, evaluate]);

  return { ...driftInfo, evaluateNow: evaluate };
}
