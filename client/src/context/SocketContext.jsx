'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { getSocket } from '../lib/socket';

const SocketContext = createContext({
  socket: null,
  isConnected: false,
  connectionError: null,
});

export function SocketProvider({ children }) {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState(null);

  useEffect(() => {
    const instance = getSocket();
    if (!instance) return;
    setSocket(instance);
    setIsConnected(instance.connected);

    const onConnect = () => {
      setIsConnected(true);
      setConnectionError(null);
    };
    const onDisconnect = () => setIsConnected(false);
    const onConnectError = (err) => {
      setIsConnected(false);
      setConnectionError(err?.message || 'Unable to reach the sync server');
    };

    instance.on('connect', onConnect);
    instance.on('disconnect', onDisconnect);
    instance.on('connect_error', onConnectError);

    // Listeners only — the singleton connection outlives this provider's effects.
    return () => {
      instance.off('connect', onConnect);
      instance.off('disconnect', onDisconnect);
      instance.off('connect_error', onConnectError);
    };
  }, []);

  return (
    <SocketContext.Provider value={{ socket, isConnected, connectionError }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  return useContext(SocketContext);
}
