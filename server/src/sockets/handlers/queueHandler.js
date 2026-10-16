import { EVENTS } from '../../constants/events.js';
import { RoomService } from '../../services/roomService.js';
import { resolveSocketRoom, roomTarget, replyError } from '../socketUtils.js';

/**
 * UPDATE_QUEUE -> QUEUE_UPDATED.
 *
 * Clients send operations ({ op: 'ADD' | 'REMOVE' | 'MOVE' | 'CLEAR' | 'SET', ... }) rather
 * than whole arrays, the server applies them under a per-room lock and broadcasts the
 * authoritative array, so concurrent edits never clobber each other and every participant
 * holds the exact same queue.
 */
export function registerQueueHandler(io, socket) {
  socket.on(EVENTS.UPDATE_QUEUE, async (payload = {}, callback) => {
    try {
      const { roomCode, username } = await resolveSocketRoom(socket, payload.roomCode);

      const queue = await RoomService.updateQueue(roomCode, socket.id, payload, username);

      const broadcast = {
        roomCode,
        queue,
        op: typeof payload.op === 'string' ? payload.op.toUpperCase() : null,
        updatedBy: socket.id,
        updatedByName: username,
      };

      roomTarget(io, roomCode).emit(EVENTS.QUEUE_UPDATED, broadcast);
      if (typeof callback === 'function') callback({ success: true, ...broadcast });

      console.log(`[Queue] Room ${roomCode}: ${broadcast.op} by ${username} -> ${queue.length} item(s)`);
    } catch (err) {
      replyError(socket, callback, err, 'UPDATE_QUEUE');
    }
  });
}
