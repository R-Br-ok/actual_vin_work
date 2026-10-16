import { EVENTS } from '../constants/events.js';
import { RoomService, sanitizeRoomCode } from '../services/roomService.js';

/**
 * Resolves which room a socket is acting on.
 * The socket's own session (written on JOIN_ROOM) is authoritative; the payload's
 * roomCode is only used when no session exists yet.
 */
export async function resolveSocketRoom(socket, payloadRoomCode) {
  const session = await RoomService.getSocketSession(socket.id);
  const sessionCode = session?.roomCode ? sanitizeRoomCode(session.roomCode) : '';
  const payloadCode = sanitizeRoomCode(payloadRoomCode || '');

  if (sessionCode && payloadCode && sessionCode !== payloadCode) {
    throw new Error(`You are not a member of room ${payloadCode}`);
  }

  const roomCode = sessionCode || payloadCode;
  if (!roomCode) {
    throw new Error('Join a room first');
  }

  return {
    roomCode,
    username: session?.username || 'Anonymous',
    hasSession: Boolean(session),
  };
}

/** Socket.io channel names a room broadcasts to (both legacy and prefixed). */
export function roomTarget(io, roomCode) {
  return io.to(roomCode).to(`room:${roomCode}`);
}

/** Reports a handler failure to the caller via ack (if any) and the ERROR event. */
export function replyError(socket, callback, err, context) {
  const message = err?.message || 'Request failed';
  console.error(`[${context}] ${message}`);
  const payload = { success: false, message, context };
  socket.emit(EVENTS.ERROR, payload);
  if (typeof callback === 'function') callback(payload);
}
