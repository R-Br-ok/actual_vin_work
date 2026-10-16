import { Router } from 'express';
import { redis } from '../config/redis.js';

const router = Router();

router.get('/health', async (req, res) => {
  let redisStatus = 'disconnected';
  try {
    const pong = await redis.ping();
    redisStatus = pong === 'PONG' ? (redis.isInMemory ? 'connected (in-memory)' : 'connected') : 'error';
  } catch (err) {
    redisStatus = `error: ${err.message}`;
  }

  res.json({
    status: 'ok',
    timestamp: Date.now(),
    redis: redisStatus,
    uptime: process.uptime(),
  });
});

export default router;
