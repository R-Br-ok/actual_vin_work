import { EVENTS } from '../../constants/events.js';
import { RoomService } from '../../services/roomService.js';
import { resolveSocketRoom, roomTarget } from '../socketUtils.js';

const MAX_MESSAGE_LENGTH = 500;

export function registerSocialHandler(io, socket) {
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

  // Emoji reactions live in reactionHandler.js
}
