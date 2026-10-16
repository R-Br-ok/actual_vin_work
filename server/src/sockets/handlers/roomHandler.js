import { EVENTS } from '../../constants/events.js';
import { RoomService } from '../../services/roomService.js';

export function registerRoomHandler(io, socket) {
  socket.on(EVENTS.JOIN_ROOM, async (payload = {}, callback) => {
    try {
      let { roomCode, username } = payload;

      // If no room code provided, generate a new one
      if (!roomCode || typeof roomCode !== 'string' || roomCode.trim() === '') {
        roomCode = await RoomService.generateUniqueRoomCode();
      }

      roomCode = roomCode.trim().toUpperCase();
      const sanitizedUsername = username && typeof username === 'string' ? username.trim() : 'Anonymous';

      const result = await RoomService.addUserToRoom(roomCode, socket.id, sanitizedUsername);
      const roomChannel = `room:${roomCode}`;

      // Join socket.io channels (support both direct code and room:code)
      socket.join(roomChannel);
      socket.join(roomCode);

      const response = {
        success: true,
        roomCode,
        isHost: result.isHost,
        roomState: result.room,
        users: result.users,
      };

      // Notify caller
      socket.emit(EVENTS.ROOM_JOINED, response);
      if (typeof callback === 'function') {
        callback(response);
      }

      // Notify other participants in the room
      socket.to(roomChannel).emit(EVENTS.USER_JOINED, {
        socketId: socket.id,
        username: sanitizedUsername,
        joinedAt: result.joinedAt,
        totalUsers: result.users.length,
      });

      console.log(`[Room] Socket ${socket.id} (${sanitizedUsername}) joined room ${roomCode}. Host: ${result.isHost}`);
    } catch (err) {
      console.error('[Room] JOIN_ROOM error:', err.message);
      const errorResponse = {
        success: false,
        message: err.message || 'Failed to join room',
      };
      socket.emit(EVENTS.ERROR, errorResponse);
      if (typeof callback === 'function') {
        callback(errorResponse);
      }
    }
  });
}
