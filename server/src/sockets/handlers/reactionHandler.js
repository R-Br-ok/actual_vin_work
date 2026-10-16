import { EVENTS } from '../../constants/events.js';
import { resolveSocketRoom } from '../socketUtils.js';

const REACTION_WINDOW_MS = 1000;
const MAX_REACTIONS_PER_WINDOW = 8;
const MAX_EMOJI_LENGTH = 16;

/**
 * EMIT_REACTION -> REACTION_BROADCAST
 *
 * Broadcast with io.to(roomCode) — NOT socket.to() — so the whole room gets it:
 * the sender sees their own emoji float up, and the host sees viewers' reactions (and vice versa).
 *
 * Payload: { id: Date.now() + Math.random(), emoji, senderId, senderName, timestamp: Date.now(), roomCode, x }
 */
export function registerReactionHandler(io, socket) {
  // Per-socket throttle so one person can't flood everyone's overlay
  let windowStart = 0;
  let countInWindow = 0;

  socket.on(EVENTS.EMIT_REACTION, async (payload = {}, callback) => {
    const ack = (body) => typeof callback === 'function' && callback(body);

    try {
      const { emoji } = payload;
      if (!emoji || typeof emoji !== 'string' || emoji.length > MAX_EMOJI_LENGTH) {
        ack({ success: false, message: 'Invalid emoji' });
        return;
      }

      const now = Date.now();
      if (now - windowStart > REACTION_WINDOW_MS) {
        windowStart = now;
        countInWindow = 0;
      }
      if (++countInWindow > MAX_REACTIONS_PER_WINDOW) {
        ack({ success: false, message: 'Slow down a little' });
        return;
      }

      const { roomCode, username, hasSession } = await resolveSocketRoom(socket, payload.roomCode);

      // Must actually be in the room's channel (i.e. JOIN_ROOM succeeded)
      if (!socket.rooms.has(roomCode)) {
        ack({ success: false, message: 'Join the room before reacting' });
        return;
      }

      const senderName = hasSession ? username : payload.username?.trim()?.slice(0, 32) || 'Anonymous';

      const reaction = {
        id: Date.now() + Math.random(), // unique per broadcast; used as the particle key
        emoji,
        senderId: socket.id,
        senderName,
        timestamp: Date.now(),
        roomCode,
        x: Math.random() * 80 + 10, // horizontal launch point (% of player width)
        // legacy aliases
        username: senderName,
        sender: senderName,
        socketId: socket.id,
      };

      io.to(roomCode).emit(EVENTS.REACTION_BROADCAST, reaction);
      ack({ success: true, ...reaction });
    } catch (err) {
      console.error('[Reaction] EMIT_REACTION error:', err.message);
      ack({ success: false, message: err.message });
    }
  });
}
