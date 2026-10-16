import { EVENTS } from '../../constants/events.js';
import { RoomService, sanitizeRoomCode } from '../../services/roomService.js';
import { replyError } from '../socketUtils.js';

export function registerRoomHandler(io, socket) {
  socket.on(EVENTS.JOIN_ROOM, async (payload = {}, callback) => {
    try {
      let roomCode = sanitizeRoomCode(payload.roomCode);
      const { username } = payload;

      // If no room code provided, generate a new one
      if (!roomCode) {
        roomCode = await RoomService.generateUniqueRoomCode();
      }

      const sanitizedUsername =
        username && typeof username === 'string' && username.trim() ? username.trim().slice(0, 32) : 'Anonymous';

      // A socket belongs to one room at a time: leave any previous room first
      const previous = await RoomService.getSocketSession(socket.id);
      if (previous?.roomCode && previous.roomCode !== roomCode) {
        const left = await RoomService.handleDisconnect(socket.id);
        socket.leave(previous.roomCode);
        socket.leave(`room:${previous.roomCode}`);
        if (left) {
          io.to(`room:${left.roomCode}`).emit(EVENTS.USER_LEFT, {
            socketId: socket.id,
            username: left.username,
            totalUsers: left.remainingCount,
            users: left.users,
          });
          if (left.hostChanged) io.to(`room:${left.roomCode}`).emit(EVENTS.HOST_CHANGED, left.hostChanged);
        }
      }

      const result = await RoomService.addUserToRoom(roomCode, socket.id, sanitizedUsername);
      const roomChannel = `room:${roomCode}`;

      // Join socket.io channels (support both direct code and room:code)
      socket.join(roomChannel);
      socket.join(roomCode);

      // Late-joiner snapshot: media anchor + expected position now, queue, participants, chat
      const snapshot = await RoomService.getRoomSnapshot(roomCode);

      const response = {
        success: true,
        roomCode,
        selfSocketId: socket.id,
        isHost: result.isHost,
        roomState: snapshot.roomState,
        queue: snapshot.queue,
        users: snapshot.users,
        messages: snapshot.messages,
        serverTimestamp: snapshot.serverTimestamp,
        currentMediaTime: snapshot.currentMediaTime,
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
        isHost: result.isHost,
        totalUsers: snapshot.users.length,
        users: snapshot.users,
      });

      console.log(`[Room] Socket ${socket.id} (${sanitizedUsername}) joined room ${roomCode}. Host: ${result.isHost}`);
    } catch (err) {
      replyError(socket, callback, err, 'JOIN_ROOM');
    }
  });
}
