import { EVENTS } from '../../constants/events.js';
import { RoomService } from '../../services/roomService.js';

export function registerDisconnectHandler(io, socket) {
  socket.on(EVENTS.DISCONNECT, async (reason) => {
    try {
      console.log(`[Socket] Disconnect: ${socket.id} (reason: ${reason})`);
      const result = await RoomService.handleDisconnect(socket.id);

      if (!result) {
        return;
      }

      const roomChannel = `room:${result.roomCode}`;

      // Notify remaining users that participant left
      io.to(roomChannel).emit(EVENTS.USER_LEFT, {
        socketId: socket.id,
        totalUsers: result.remainingCount,
      });

      // If host disconnected and a successor was chosen based on session longevity
      if (result.hostChanged) {
        console.log(`[Host] Host changed in ${result.roomCode}: ${result.hostChanged.previousHostSocketId} -> ${result.hostChanged.newHostSocketId}`);
        io.to(roomChannel).emit(EVENTS.HOST_CHANGED, result.hostChanged);
      }
    } catch (err) {
      console.error('[Socket] Disconnect handler error:', err.message);
    }
  });
}
