'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { SOCKET_EVENTS } from '../lib/constants';

/**
 * Custom hook implementing NTP-style 3-way ping/pong clock synchronization.
 * Computes Round-Trip Time (RTT) and local-to-server clock offset.
 */
export function useClockSync(socket, isConnected) {
  const [clockOffset, setClockOffset] = useState(0);
  const [rtt, setRtt] = useState(0);
  const [isSynced, setIsSynced] = useState(false);

  const offsetRef = useRef(0);
  const rttRef = useRef(0);
  const syncCountRef = useRef(0);

  const syncClock = useCallback(() => {
    if (!socket || !isConnected) return;

    const t0 = Date.now();

    socket.emit(SOCKET_EVENTS.SYNC_CLOCK, { clientSendTime: t0 }, (response) => {
      if (!response) return;

      const t3 = Date.now();
      const { clientSendTime, serverReceiveTime, serverTransmitTime } = response;

      // NTP calculations
      const measuredRtt = Math.max(0, (t3 - clientSendTime) - (serverTransmitTime - serverReceiveTime));
      const measuredOffset = serverReceiveTime - (clientSendTime + measuredRtt / 2);

      // Apply Exponential Moving Average (EMA) to smooth network jitter
      if (syncCountRef.current === 0) {
        offsetRef.current = measuredOffset;
        rttRef.current = measuredRtt;
      } else {
        offsetRef.current = offsetRef.current * 0.7 + measuredOffset * 0.3;
        rttRef.current = rttRef.current * 0.7 + measuredRtt * 0.3;
      }

      syncCountRef.current += 1;
      setClockOffset(Math.round(offsetRef.current));
      setRtt(Math.round(rttRef.current));
      setIsSynced(true);
    });
  }, [socket, isConnected]);

  // Initial synchronization burst (rapid 3 pings) followed by 15s interval
  useEffect(() => {
    if (!isConnected || !socket) {
      setIsSynced(false);
      return;
    }

    // Burst pings for initial calibration
    syncClock();
    const burst1 = setTimeout(syncClock, 800);
    const burst2 = setTimeout(syncClock, 1600);

    // Steady state refresh
    const interval = setInterval(syncClock, 15000);

    return () => {
      clearTimeout(burst1);
      clearTimeout(burst2);
      clearInterval(interval);
    };
  }, [isConnected, socket, syncClock]);

  // High-precision server timestamp getter
  const getServerTime = useCallback(() => {
    return Date.now() + offsetRef.current;
  }, []);

  return {
    clockOffset,
    rtt,
    isSynced,
    getServerTime,
    syncClock,
  };
}
