import { EVENTS } from '../../constants/events.js';
import { RoomService } from '../../services/roomService.js';
import { resolveSocketRoom, replyError } from '../socketUtils.js';

/**
 * CHANGE_PLAYBACK_RATE (host only) -> PLAYBACK_RATE_CHANGED to the whole room.
 *
 * Payload: { roomCode, rate, mediaTime?, clientTimestamp? }
 *   rate ∈ 0.5 | 0.75 | 1 | 1.25 | 1.5 | 2
 *
 * The server stores the new base speed (room.playbackRate, broadcast as basePlaybackRate) and
 * re-anchors the timeline at the moment of the change. Viewers set video.playbackRate to the
 * new base; drift correction then nudges relative to it (base × 1.05 / base × 0.95).
 */
export function registerPlaybackRateHandler(io, socket) {
  socket.on(EVENTS.CHANGE_PLAYBACK_RATE, async (payload = {}, callback) => {
    try {
      const { roomCode } = await resolveSocketRoom(socket, payload.roomCode);

      const result = await RoomService.changePlaybackRate(roomCode, socket.id, {
        rate: payload.rate,
        mediaTime: payload.mediaTime,
        clientTimestamp: payload.clientTimestamp,
      });

      const broadcast = { roomCode, ...result };
      io.to(roomCode).emit(EVENTS.PLAYBACK_RATE_CHANGED, broadcast);
      if (typeof callback === 'function') callback({ success: true, ...broadcast });

      console.log(`[Rate] Room ${roomCode}: ${result.previousRate}× -> ${result.rate}× at ${result.mediaTime.toFixed(2)}s`);
    } catch (err) {
      replyError(socket, callback, err, 'CHANGE_PLAYBACK_RATE');
    }
  });
}
