import { EVENTS } from '../../constants/events.js';
import { RoomService } from '../../services/roomService.js';
import { resolveSocketRoom, roomTarget, replyError } from '../socketUtils.js';

/**
 * CONTROL_ACTION (host only): PLAY / PAUSE / SEEK.
 * The new media anchor is broadcast to everyone in the room (host included) as
 * CONTROL_ACTION_BROADCAST so each client can compute
 *   expected = mediaTime + (serverNow - targetTimestamp) / 1000 * playbackRate
 */
export function registerControlHandler(io, socket) {
  socket.on(EVENTS.CONTROL_ACTION, async (payload = {}, callback) => {
    try {
      const { action, mediaTime, playbackRate, videoUrl, clientTimestamp } = payload;
      const { roomCode } = await resolveSocketRoom(socket, payload.roomCode);

      if (!action || typeof action !== 'string' || !['PLAY', 'PAUSE', 'SEEK'].includes(action.toUpperCase())) {
        throw new Error('Invalid control action. Must be PLAY, PAUSE, or SEEK');
      }

      const parsedMediaTime = parseFloat(mediaTime ?? 0);
      // Omitted rate = keep the room's current base speed
      const parsedRate = playbackRate === undefined || playbackRate === null ? undefined : parseFloat(playbackRate);

      const controlResult = await RoomService.handleControlAction(roomCode, socket.id, {
        action: action.toUpperCase(),
        mediaTime: Number.isFinite(parsedMediaTime) ? parsedMediaTime : 0,
        playbackRate: Number.isFinite(parsedRate) ? parsedRate : undefined,
        videoUrl,
        clientTimestamp,
      });

      // Broadcast action with authoritative anchor timestamp to all room members
      roomTarget(io, roomCode).emit(EVENTS.CONTROL_ACTION_BROADCAST, controlResult);

      if (typeof callback === 'function') {
        callback({ success: true, ...controlResult });
      }

      console.log(`[Control] Room ${roomCode}: ${controlResult.action} at ${controlResult.mediaTime.toFixed(2)}s by ${socket.id}`);
    } catch (err) {
      replyError(socket, callback, err, 'CONTROL_ACTION');
    }
  });
}
