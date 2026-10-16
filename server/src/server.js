import http from 'http';
import os from 'os';
import app from './app.js';
import { ENV } from './config/env.js';
import { connectRedis, redis } from './config/redis.js';
import { initializeSockets } from './sockets/index.js';

const httpServer = http.createServer(app);

// Initialize Socket.io
const io = initializeSockets(httpServer);

/** Lists this machine's LAN IPv4 addresses so other devices know where to connect. */
function getLanAddresses() {
  const addresses = [];
  for (const iface of Object.values(os.networkInterfaces())) {
    for (const addr of iface || []) {
      if (addr.family === 'IPv4' && !addr.internal) addresses.push(addr.address);
    }
  }
  return addresses;
}

async function startServer() {
  console.log('[Server] Connecting to Redis...');
  await connectRedis();

  // Bind to 0.0.0.0 so phones / other laptops on the LAN can reach the server
  httpServer.listen(ENV.PORT, ENV.HOST, () => {
    console.log(`Sync Server listening on http://${ENV.HOST}:${ENV.PORT}`);
    console.log(`  Local:     http://localhost:${ENV.PORT}`);
    for (const ip of getLanAddresses()) {
      console.log(`  Network:   http://${ip}:${ENV.PORT}`);
    }
    console.log(`Environment: ${ENV.NODE_ENV}`);
    console.log(`Socket.io:   Active on /socket.io/`);
  });
}

// Graceful shutdown
async function gracefulShutdown(signal) {
  console.log(`\n[Server] Received ${signal}. Initiating graceful shutdown...`);

  io.close();
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
