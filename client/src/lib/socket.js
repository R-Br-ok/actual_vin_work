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
 *
 * Created with autoConnect: false — the room page validates the room code over REST first
 * and only then calls socket.connect() (see RoomProvider).
 */
export function getSocket() {
  if (typeof window === 'undefined') return null;
  if (!socketSingleton) {
    socketSingleton = io(getServerUrl(), {
      autoConnect: false,
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

/**
 * GET /api/rooms/:code — does this room exist?
 * Resolves to { status: 'ok', room } | { status: 'not_found' } | { status: 'unreachable' }.
 */
export async function validateRoom(code, { timeoutMs = 6000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${getServerUrl()}/api/rooms/${encodeURIComponent(code)}`, {
      signal: controller.signal,
      cache: 'no-store',
    });
    if (res.status === 404) return { status: 'not_found' };
    if (!res.ok) return { status: 'unreachable' };
    const body = await res.json();
    return body?.success ? { status: 'ok', room: body.room } : { status: 'not_found' };
  } catch {
    return { status: 'unreachable' };
  } finally {
    clearTimeout(timer);
  }
}
