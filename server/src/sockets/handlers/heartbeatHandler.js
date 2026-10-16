import { EVENTS } from '../../constants/events.js';
import { RoomService } from '../../services/roomService.js';
import { resolveSocketRoom, roomTarget } from '../socketUtils.js';

/**
 * HEARTBEAT (host only, every ~3s).
 * Re-anchors the room to the host's real player position and relays it to the room as
 * STATE_SYNC, so viewers follow the host even if the host's stream stalled to buffer.
 */
export function registerHeartbeatHandler(io, socket) {
  socket.on(EVENTS.HEARTBEAT, async (payload = {}, callback) => {
    try {
      const { mediaTime, playbackState, clientTimestamp } = payload;
      const { roomCode } = await resolveSocketRoom(socket, payload.roomCode);

      const parsedMediaTime = parseFloat(mediaTime ?? 0);

      const result = await RoomService.handleHeartbeat(roomCode, socket.id, {
        mediaTime: Number.isFinite(parsedMediaTime) ? parsedMediaTime : 0,
        playbackState,
        clientTimestamp,
      });

      const response = {
        success: true,
        roomCode,
        ...result,
      };

      socket.emit(EVENTS.HEARTBEAT_ACK, response);
      roomTarget(io, roomCode).except(socket.id).emit(EVENTS.STATE_SYNC, {
        roomCode,
        mediaTime: result.mediaTime,
        targetTimestamp: result.targetTimestamp,
        playbackState: result.playbackState,
        playbackRate: result.playbackRate,
        videoUrl: result.videoUrl,
      });

      if (typeof callback === 'function') {
        callback(response);
      }
    } catch (err) {
      // Avoid spamming the client on periodic ping errors (e.g. host just changed)
      if (typeof callback === 'function') {
        callback({ success: false, message: err.message });
      }
    }
  });
}
