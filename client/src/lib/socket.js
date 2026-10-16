'use client';

import { io } from 'socket.io-client';

const SERVER_PORT = process.env.NEXT_PUBLIC_SERVER_PORT || '5000';

/**
 * Base URL of the Express / Socket.io server.
 * NEXT_PUBLIC_SOCKET_URL wins; otherwise we reuse whatever host the page was opened on
 * (localhost on this machine, 192.168.x.x from a phone on the LAN) with port 5000.
 */
export function getServerUrl() {
  if (process.env.NEXT_PUBLIC_SOCKET_URL) return process.env.NEXT_PUBLIC_SOCKET_URL;
  if (typeof window === 'undefined') return `http://localhost:${SERVER_PORT}`;
  const { protocol, hostname } = window.location;
  return `${protocol === 'https:' ? 'https:' : 'http:'}//${hostname}:${SERVER_PORT}`;
}

let socketSingleton = null;

/**
 * One Socket.io connection per browser tab, shared by every component.
 * Living at module scope means React StrictMode's double-mounted effects and
 * client-side navigations never open a second connection.
 */
export function getSocket() {
  if (typeof window === 'undefined') return null;
  if (!socketSingleton) {
    socketSingleton = io(getServerUrl(), {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 8000,
    });
  }
  return socketSingleton;
}
