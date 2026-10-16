import { EVENTS } from '../../constants/events.js';
import { RoomService } from '../../services/roomService.js';
import { redis } from '../../config/redis.js';

export function registerHeartbeatHandler(io, socket) {
  socket.on(EVENTS.HEARTBEAT, async (payload = {}, callback) => {
    try {
      let { roomCode, mediaTime, playbackState } = payload;

      // Fallback room code lookup from socket session
      if (!roomCode) {
        const socketData = await redis.hgetall(`socket:${socket.id}`);
        roomCode = socketData?.roomCode;
      }

      if (!roomCode) {
        return;
      }

      const parsedMediaTime = parseFloat(mediaTime ?? 0);

      const result = await RoomService.handleHeartbeat(roomCode, socket.id, {
        mediaTime: isNaN(parsedMediaTime) ? 0 : parsedMediaTime,
        playbackState,
      });

      const response = {
        success: true,
        roomCode: roomCode.toUpperCase(),
        ...result,
      };

      socket.emit(EVENTS.HEARTBEAT_ACK, response);
      if (typeof callback === 'function') {
        callback(response);
      }
    } catch (err) {
      // Avoid spamming client on periodic ping error, but report if needed
      if (typeof callback === 'function') {
        callback({ success: false, message: err.message });
      }
    }
  });
}
