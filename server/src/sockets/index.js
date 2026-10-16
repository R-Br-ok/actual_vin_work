import { Server } from 'socket.io';
import { ENV } from '../config/env.js';
import { registerClockHandler } from './handlers/clockHandler.js';
import { registerRoomHandler } from './handlers/roomHandler.js';
import { registerControlHandler } from './handlers/controlHandler.js';
import { registerHeartbeatHandler } from './handlers/heartbeatHandler.js';
import { registerDisconnectHandler } from './handlers/disconnectHandler.js';
import { registerSocialHandler } from './handlers/socialHandler.js';

export function initializeSockets(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: ENV.CORS_ORIGIN,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  io.on('connection', (socket) => {
    console.log(`[Socket] Connection established: ${socket.id}`);

    // Register all modular handlers
    registerClockHandler(io, socket);
    registerRoomHandler(io, socket);
    registerControlHandler(io, socket);
    registerHeartbeatHandler(io, socket);
    registerDisconnectHandler(io, socket);
    registerSocialHandler(io, socket);
  });

  return io;
}
