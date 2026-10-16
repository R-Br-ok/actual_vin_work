import { Server } from 'socket.io';
import { resolveCorsOrigin } from '../config/env.js';
import { registerClockHandler } from './handlers/clockHandler.js';
import { registerRoomHandler } from './handlers/roomHandler.js';
import { registerControlHandler } from './handlers/controlHandler.js';
import { registerHeartbeatHandler } from './handlers/heartbeatHandler.js';
import { registerDisconnectHandler } from './handlers/disconnectHandler.js';
import { registerSocialHandler } from './handlers/socialHandler.js';
import { registerVideoHandler } from './handlers/videoHandler.js';
import { registerQueueHandler } from './handlers/queueHandler.js';
import { registerReactionHandler } from './handlers/reactionHandler.js';

export function initializeSockets(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: resolveCorsOrigin(),
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
    registerVideoHandler(io, socket);
    registerQueueHandler(io, socket);
    registerReactionHandler(io, socket);
  });

  return io;
}
