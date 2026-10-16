import { EVENTS } from '../../constants/events.js';
import { RoomService } from '../../services/roomService.js';
import { resolveSocketRoom, roomTarget, replyError } from '../socketUtils.js';

/**
 * CHANGE_VIDEO (host only) -> VIDEO_CHANGED to the whole room.
 *
 * Payload: { videoUrl?, movie?, queueId?, autoplay? }
 *  - movie:   catalog entry to play now
 *  - queueId: play (and consume) an entry from the shared queue
 *
 * Every client swaps its <video> src and resets to 0 at the same anchor. The room is left
 * PAUSED at 0; when `autoplay` is set, the host's player emits PLAY once it can play, so
 * nobody starts before the stream is ready.
 */
export function registerVideoHandler(io, socket) {
  socket.on(EVENTS.CHANGE_VIDEO, async (payload = {}, callback) => {
    try {
      const { roomCode } = await resolveSocketRoom(socket, payload.roomCode);

      const result = await RoomService.changeVideo(roomCode, socket.id, {
        videoUrl: payload.videoUrl,
        movie: payload.movie,
        queueId: payload.queueId,
      });

      const broadcast = {
        roomCode,
        videoUrl: result.videoUrl,
        movie: result.movie,
        mediaTime: result.mediaTime,
        playbackRate: result.playbackRate,
        playbackState: result.playbackState,
        serverTimestamp: result.serverTimestamp,
        targetTimestamp: result.targetTimestamp,
        autoplay: payload.autoplay !== false,
        issuedBy: socket.id,
      };

      roomTarget(io, roomCode).emit(EVENTS.VIDEO_CHANGED, broadcast);

      if (result.queueChanged) {
        roomTarget(io, roomCode).emit(EVENTS.QUEUE_UPDATED, {
          roomCode,
          queue: result.queue,
          op: 'PLAYED',
          updatedBy: socket.id,
        });
      }

      if (typeof callback === 'function') callback({ success: true, ...broadcast });

      console.log(`[Video] Room ${roomCode}: now playing "${result.movie.title}" (${result.videoUrl})`);
    } catch (err) {
      replyError(socket, callback, err, 'CHANGE_VIDEO');
    }
  });
}
