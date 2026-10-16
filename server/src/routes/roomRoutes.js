import { Router } from 'express';
import { RoomService, sanitizeRoomCode } from '../services/roomService.js';

const router = Router();

/**
 * POST /api/rooms
 * Generates and initializes a new 6-character room. This is the only way a room comes into
 * existence — joining an unknown code via URL or socket is rejected.
 */
router.post('/rooms', async (req, res) => {
  try {
    const { videoUrl, roomCode, movie } = req.body || {};
    const room = await RoomService.createRoom({ roomCode, videoUrl, movie });

    res.status(201).json({
      success: true,
      room,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message || 'Failed to create room',
    });
  }
});

/**
 * GET /api/rooms/:code
 * Validates a room before the client connects its socket (direct-link joins).
 * 404 { success: false, error: "Room does not exist" } for unknown / expired codes.
 */
router.get('/rooms/:code', async (req, res) => {
  try {
    const code = sanitizeRoomCode(req.params.code);
    const room = code ? await RoomService.getRoom(code) : null;

    if (!room) {
      return res.status(404).json({
        success: false,
        error: 'Room does not exist',
        roomCode: code || null,
      });
    }

    const users = await RoomService.getActiveUsers(code);

    res.json({
      success: true,
      room,
      totalUsers: users.length,
      users,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message || 'Failed to fetch room info',
    });
  }
});

export default router;
