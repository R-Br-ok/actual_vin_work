import { Router } from 'express';
import { RoomService } from '../services/roomService.js';

const router = Router();

/**
 * POST /api/rooms
 * Generates and initializes a new 6-character room.
 */
router.post('/rooms', async (req, res) => {
  try {
    const { videoUrl, roomCode } = req.body || {};
    const room = await RoomService.createRoom({ roomCode, videoUrl });

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
 * Resolves direct-link joins and inspects room state.
 */
router.get('/rooms/:code', async (req, res) => {
  try {
    const { code } = req.params;
    const room = await RoomService.getRoom(code);

    if (!room) {
      return res.status(404).json({
        success: false,
        message: `Room with code '${code.toUpperCase()}' not found`,
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
      message: err.message || 'Failed to fetch room info',
    });
  }
});

export default router;
