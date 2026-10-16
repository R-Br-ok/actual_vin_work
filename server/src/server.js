import http from 'http';
import app from './app.js';
import { ENV } from './config/env.js';
import { connectRedis, redis } from './config/redis.js';
import { initializeSockets } from './sockets/index.js';

const httpServer = http.createServer(app);

// Initialize Socket.io
const io = initializeSockets(httpServer);

async function startServer() {
  console.log('[Server] Connecting to Redis...');
  const isRedisConnected = await connectRedis();

  httpServer.listen(ENV.PORT, () => {
    console.log(`Sync Server running on http://localhost:${ENV.PORT}`);
    console.log(`Environment: ${ENV.NODE_ENV}`);
    console.log(`Socket.io:   Active on /socket.io/`);
  });
}

// Graceful shutdown
async function gracefulShutdown(signal) {
  console.log(`\n[Server] Received ${signal}. Initiating graceful shutdown...`);

  httpServer.close(async () => {
    console.log('[Server] HTTP and Socket server closed.');
    try {
      await redis.quit();
      console.log('[Redis] Client connection gracefully closed.');
    } catch (err) {
      console.error('[Redis] Error during disconnect:', err.message);
    }
    process.exit(0);
  });

  // Force close if stuck
  setTimeout(() => {
    console.error('[Server] Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 5000);
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

startServer().catch((err) => {
  console.error('[Server] Fatal startup error:', err);
  process.exit(1);
});
