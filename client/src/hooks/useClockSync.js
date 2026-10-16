'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { SOCKET_EVENTS, CLOCK_SYNC } from '../lib/constants';

/**
 * NTP-style ping/pong clock synchronisation against the Socket.io server.
 *
 * One exchange (3 legs: client ping -> server stamps -> client receive):
 *   t0  client send time          (client clock)
 *   t1  server receive time       (server clock)
 *   t2  server transmit time      (server clock)
 *   t3  client receive time       (client clock)
 *
 *   RTT  = (t3 - t0) - (t2 - t1)
 *   θ    = ((t1 - t0) + (t2 - t3)) / 2         // server clock − client clock
 *   serverNow ≈ Date.now() + θ
 *
 * Samples are smoothed with a continuous exponential moving average:
 *   θ̂ ← α·θ + (1 − α)·θ̂
 * Samples whose RTT is far above the best recent RTT (queueing / jitter spikes, where the
 * symmetric-latency assumption is weakest) get a quarter of the weight.
 */
export function useClockSync(socket, isConnected) {
  const [clockOffset, setClockOffset] = useState(0);
  const [rtt, setRtt] = useState(0);
  const [isSynced, setIsSynced] = useState(false);
  const [sampleCount, setSampleCount] = useState(0);

  const offsetRef = useRef(0);
  const rttRef = useRef(0);
  const samplesRef = useRef(0);
  const recentRttsRef = useRef([]);

  const syncClock = useCallback(() => {
    if (!socket || !socket.connected) return;

    const t0 = Date.now();

    socket.timeout(5000).emit(SOCKET_EVENTS.SYNC_CLOCK, { clientSendTime: t0 }, (err, response) => {
      if (err || !response) return; // lost ping — the next one will do

      const t3 = Date.now();
      const t1 = Number(response.serverReceiveTime);
      const t2 = Number(response.serverTransmitTime);
      if (!Number.isFinite(t1) || !Number.isFinite(t2)) return;

      const sampleRtt = Math.max(0, t3 - t0 - (t2 - t1));
      const sampleOffset = (t1 - t0 + (t2 - t3)) / 2;

      // Track the best RTT among the last few samples to judge sample quality
      const recent = recentRttsRef.current;
      recent.push(sampleRtt);
      if (recent.length > 8) recent.shift();
      const bestRtt = Math.min(...recent);
      const isNoisy = sampleRtt > bestRtt * 2 + 30;

      if (samplesRef.current === 0) {
        offsetRef.current = sampleOffset;
        rttRef.current = sampleRtt;
      } else {
        const alpha = isNoisy ? CLOCK_SYNC.EMA_ALPHA / 4 : CLOCK_SYNC.EMA_ALPHA;
        offsetRef.current = alpha * sampleOffset + (1 - alpha) * offsetRef.current;
        rttRef.current = CLOCK_SYNC.EMA_ALPHA * sampleRtt + (1 - CLOCK_SYNC.EMA_ALPHA) * rttRef.current;
      }

      samplesRef.current += 1;
      setClockOffset(Math.round(offsetRef.current));
      setRtt(Math.round(rttRef.current));
      setSampleCount(samplesRef.current);
      setIsSynced(true);
    });
  }, [socket]);

  // Burst of pings right after (re)connecting, then a steady refresh
  useEffect(() => {
    if (!isConnected || !socket) {
      setIsSynced(false);
      return undefined;
    }

    const timers = [];
    for (let i = 0; i < CLOCK_SYNC.BURST_SAMPLES; i++) {
      timers.push(setTimeout(syncClock, i * CLOCK_SYNC.BURST_SPACING_MS));
    }
    const interval = setInterval(syncClock, CLOCK_SYNC.STEADY_INTERVAL_MS);

    return () => {
      timers.forEach(clearTimeout);
      clearInterval(interval);
    };
  }, [isConnected, socket, syncClock]);

  // Current server time estimate. Stable identity; always reads the latest offset.
  const getServerTime = useCallback(() => Date.now() + offsetRef.current, []);

  return {
    clockOffset,
    rtt,
    isSynced,
    sampleCount,
    offsetRef,
    getServerTime,
    syncClock,
  };
}
