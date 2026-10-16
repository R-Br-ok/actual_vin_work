import { EVENTS } from '../../constants/events.js';
import { RoomService } from '../../services/roomService.js';
import { redis } from '../../config/redis.js';

export function registerControlHandler(io, socket) {
  socket.on(EVENTS.CONTROL_ACTION, async (payload = {}, callback) => {
    try {
      let { roomCode, action, mediaTime, playbackRate, videoUrl } = payload;

      // If roomCode not explicitly sent, retrieve from socket session
      if (!roomCode) {
        const socketData = await redis.hgetall(`socket:${socket.id}`);
        roomCode = socketData?.roomCode;
      }

      if (!roomCode) {
        throw new Error('Room code is required for control actions');
      }

      if (!action || !['PLAY', 'PAUSE', 'SEEK'].includes(action.toUpperCase())) {
        throw new Error('Invalid control action. Must be PLAY, PAUSE, or SEEK');
      }

      const parsedMediaTime = parseFloat(mediaTime ?? 0);
      const parsedRate = parseFloat(playbackRate ?? 1.0);
      const cleanCode = roomCode.toUpperCase();

      const controlResult = await RoomService.handleControlAction(cleanCode, socket.id, {
        action: action.toUpperCase(),
        mediaTime: isNaN(parsedMediaTime) ? 0 : parsedMediaTime,
        playbackRate: isNaN(parsedRate) ? 1.0 : parsedRate,
        videoUrl,
      });

      // Broadcast action with atomic server timestamp to all room members
      io.to(cleanCode).to(`room:${cleanCode}`).emit(EVENTS.CONTROL_ACTION_BROADCAST, controlResult);

      if (typeof callback === 'function') {
        callback({ success: true, ...controlResult });
      }

      console.log(`[Control] Room ${roomCode}: ${controlResult.action} at ${controlResult.mediaTime}s by ${socket.id}`);
    } catch (err) {
      console.error('[Control] CONTROL_ACTION error:', err.message);
      const errorResponse = {
        success: false,
        message: err.message || 'Failed to process control action',
      };
      socket.emit(EVENTS.ERROR, errorResponse);
      if (typeof callback === 'function') {
        callback(errorResponse);
      }
    }
  });
}
