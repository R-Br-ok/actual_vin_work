import { EVENTS } from '../../constants/events.js';
import { redis } from '../../config/redis.js';

export function registerSocialHandler(io, socket) {
  // 1. Chat Message Handler: SEND_MESSAGE -> NEW_MESSAGE
  socket.on(EVENTS.SEND_MESSAGE, async (payload = {}, callback) => {
    try {
      let { roomCode, message, username } = payload;

      // Fallback roomCode from socket session if omitted
      if (!roomCode) {
        const socketData = await redis.hgetall(`socket:${socket.id}`);
        roomCode = socketData?.roomCode;
      }

      if (!roomCode || !message || typeof message !== 'string' || message.trim() === '') {
        return;
      }

      const cleanCode = roomCode.trim().toUpperCase();
      const senderName = username?.trim() || 'Anonymous';

      const messagePayload = {
        id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        roomCode: cleanCode,
        message: message.trim(),
        text: message.trim(), // support both message and text
        username: senderName,
        sender: senderName,
        timestamp: Date.now(),
        socketId: socket.id,
      };

      // Broadcast NEW_MESSAGE to all participants in the room
      io.to(cleanCode).to(`room:${cleanCode}`).emit(EVENTS.NEW_MESSAGE, messagePayload);

      if (typeof callback === 'function') {
        callback({ success: true, ...messagePayload });
      }

      console.log(`[Chat] [${cleanCode}] ${senderName}: ${message.trim()}`);
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
      let { roomCode, emoji, username } = payload;

      // Fallback roomCode from socket session if omitted
      if (!roomCode) {
        const socketData = await redis.hgetall(`socket:${socket.id}`);
        roomCode = socketData?.roomCode;
      }

      if (!roomCode || !emoji) {
        return;
      }

      const cleanCode = roomCode.trim().toUpperCase();
      const senderName = username?.trim() || 'Anonymous';

      const reactionPayload = {
        id: `react-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        roomCode: cleanCode,
        emoji,
        username: senderName,
        sender: senderName,
        timestamp: Date.now(),
        x: Math.random() * 80 + 10, // percentage offset across player
      };

      // Broadcast REACTION_BROADCAST to all participants in the room
      io.to(cleanCode).to(`room:${cleanCode}`).emit(EVENTS.REACTION_BROADCAST, reactionPayload);

      if (typeof callback === 'function') {
        callback({ success: true, ...reactionPayload });
      }

      console.log(`[Reaction] [${cleanCode}] ${senderName}: ${emoji}`);
    } catch (err) {
      console.error('[Reaction] EMIT_REACTION error:', err.message);
      if (typeof callback === 'function') {
        callback({ success: false, message: err.message });
      }
    }
  });
}
