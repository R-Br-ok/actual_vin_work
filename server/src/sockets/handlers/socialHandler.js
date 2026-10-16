import { EVENTS } from '../../constants/events.js';
import { RoomService } from '../../services/roomService.js';
import { resolveSocketRoom, roomTarget } from '../socketUtils.js';

const MAX_MESSAGE_LENGTH = 500;
const REACTION_WINDOW_MS = 1000;
const MAX_REACTIONS_PER_WINDOW = 8;

export function registerSocialHandler(io, socket) {
  // Simple per-socket reaction throttle so one user can't flood the overlay
  let reactionWindowStart = 0;
  let reactionCount = 0;

  // 1. Chat Message Handler: SEND_MESSAGE -> NEW_MESSAGE
  socket.on(EVENTS.SEND_MESSAGE, async (payload = {}, callback) => {
    try {
      const { message } = payload;
      if (!message || typeof message !== 'string' || message.trim() === '') {
        return;
      }

      const { roomCode, username, hasSession } = await resolveSocketRoom(socket, payload.roomCode);
      const room = await RoomService.getRoom(roomCode);
      const senderName = hasSession ? username : payload.username?.trim()?.slice(0, 32) || 'Anonymous';
      const text = message.trim().slice(0, MAX_MESSAGE_LENGTH);

      const messagePayload = {
        id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        roomCode,
        message: text,
        text, // support both message and text
        username: senderName,
        sender: senderName,
        isHost: room?.hostSocketId === socket.id,
        timestamp: Date.now(),
        socketId: socket.id,
      };

      await RoomService.addChatMessage(roomCode, messagePayload);

      // Broadcast NEW_MESSAGE to all participants in the room
      roomTarget(io, roomCode).emit(EVENTS.NEW_MESSAGE, messagePayload);

      if (typeof callback === 'function') {
        callback({ success: true, ...messagePayload });
      }

      console.log(`[Chat] [${roomCode}] ${senderName}: ${text}`);
    } catch (err) {
      console.error('[Chat] SEND_MESSAGE error:', err.message);
      if (typeof callback === 'function') {
        callback({ success: false, message: err.message });
      }
    }
  });

  // 2. Emoji Reaction Handler: EMIT_REACTION -> REACTION_BROADCAST
  socket.on(EVENTS.EMIT_REACTION, async (payload = {}, callback) => {
    try {
      const { emoji } = payload;
      if (!emoji || typeof emoji !== 'string' || emoji.length > 16) {
        return;
      }

      const now = Date.now();
      if (now - reactionWindowStart > REACTION_WINDOW_MS) {
        reactionWindowStart = now;
        reactionCount = 0;
      }
      if (++reactionCount > MAX_REACTIONS_PER_WINDOW) {
        if (typeof callback === 'function') callback({ success: false, message: 'Slow down a little' });
        return;
      }

      const { roomCode, username, hasSession } = await resolveSocketRoom(socket, payload.roomCode);
      const senderName = hasSession ? username : payload.username?.trim()?.slice(0, 32) || 'Anonymous';

      const reactionPayload = {
        id: `react-${now}-${Math.random().toString(36).substring(2, 7)}`,
        roomCode,
        emoji,
        username: senderName,
        sender: senderName,
        socketId: socket.id,
        timestamp: now,
        x: Math.random() * 80 + 10, // percentage offset across player
      };

      // Broadcast REACTION_BROADCAST to all participants in the room
      roomTarget(io, roomCode).emit(EVENTS.REACTION_BROADCAST, reactionPayload);

      if (typeof callback === 'function') {
        callback({ success: true, ...reactionPayload });
      }
    } catch (err) {
      console.error('[Reaction] EMIT_REACTION error:', err.message);
      if (typeof callback === 'function') {
        callback({ success: false, message: err.message });
      }
    }
  });
}
