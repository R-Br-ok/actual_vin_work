import { customAlphabet } from 'nanoid';
import { redis } from '../config/redis.js';
import { ENV } from '../config/env.js';
import { PLAYBACK_STATE, CONTROL_TYPE } from '../constants/playback.js';

// 6-character uppercase alphanumeric excluding easily confusable characters (0, O, 1, I)
const generateCode = customAlphabet('23456789ABCDEFGHJKLMNPQRSTUVWXYZ', ENV.ROOM_CODE_LENGTH);

// Default open-access CORS-enabled public test stream
export const DEFAULT_VIDEO_URL = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';

const ROOM_KEY_PREFIX = 'room:';
const ROOM_USERS_PREFIX = 'room:users:';
const SOCKET_KEY_PREFIX = 'socket:';

function getRoomKey(roomCode) {
  return `${ROOM_KEY_PREFIX}${roomCode.toUpperCase()}`;
}

function getRoomUsersKey(roomCode) {
  return `${ROOM_USERS_PREFIX}${roomCode.toUpperCase()}`;
}

function getSocketKey(socketId) {
  return `${SOCKET_KEY_PREFIX}${socketId}`;
}

export class RoomService {
  /**
   * Generates a unique 6-character room code that doesn't collide in Redis.
   */
  static async generateUniqueRoomCode() {
    let attempts = 0;
    while (attempts < 10) {
      const code = generateCode();
      try {
        const exists = await redis.exists(getRoomKey(code));
        if (!exists) {
          return code;
        }
      } catch (err) {
        // Fallback gracefully if Redis is currently offline or connecting
        return code;
      }
      attempts++;
    }
    // Fallback if nanoid collisions occur
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  }

  /**
   * Creates a new room in Redis.
   */
  static async createRoom({ roomCode, videoUrl = '', hostSocketId = null } = {}) {
    const code = roomCode ? roomCode.toUpperCase() : await this.generateUniqueRoomCode();
    const roomKey = getRoomKey(code);
    const now = Date.now();
    const resolvedVideoUrl = videoUrl && videoUrl.trim() !== '' ? videoUrl.trim() : DEFAULT_VIDEO_URL;

    const roomState = {
      code,
      videoUrl: resolvedVideoUrl,
      playbackState: PLAYBACK_STATE.PAUSED,
      mediaTime: '0.0',
      targetTimestamp: String(now),
      hostSocketId: hostSocketId || '',
      createdAt: String(now),
      updatedAt: String(now),
    };

    await redis.hset(roomKey, roomState);
    await redis.expire(roomKey, ENV.ROOM_EXPIRY_SECONDS);

    return this.getRoom(code);
  }

  /**
   * Retrieves parsed room state by code.
   */
  static async getRoom(roomCode) {
    if (!roomCode) return null;
    const roomKey = getRoomKey(roomCode);
    const data = await redis.hgetall(roomKey);

    if (!data || Object.keys(data).length === 0) {
      return null;
    }

    return {
      code: data.code,
      videoUrl: data.videoUrl || '',
      playbackState: data.playbackState || PLAYBACK_STATE.PAUSED,
      mediaTime: parseFloat(data.mediaTime || '0'),
      targetTimestamp: parseInt(data.targetTimestamp || '0', 10),
      hostSocketId: data.hostSocketId || null,
      createdAt: parseInt(data.createdAt || '0', 10),
      updatedAt: parseInt(data.updatedAt || '0', 10),
    };
  }

  /**
   * Adds or registers a user inside a room.
   * If the room has no host, this user becomes the host.
   */
  static async addUserToRoom(roomCode, socketId, username = 'Anonymous') {
    const code = roomCode.toUpperCase();
    const roomKey = getRoomKey(code);
    const usersKey = getRoomUsersKey(code);
    const socketKey = getSocketKey(socketId);
    const joinedAt = Date.now();

    let room = await this.getRoom(code);

    // If room does not exist yet, auto-create it
    if (!room) {
      await this.createRoom({ roomCode: code, hostSocketId: socketId });
      room = await this.getRoom(code);
    } else if (!room.hostSocketId) {
      // Assign host if none currently exists
      await redis.hset(roomKey, 'hostSocketId', socketId);
      room.hostSocketId = socketId;
    }

    const isHost = room.hostSocketId === socketId;

    // Add user to Redis sorted set with joinedAt as score
    await redis.zadd(usersKey, joinedAt, socketId);
    await redis.expire(usersKey, ENV.ROOM_EXPIRY_SECONDS);

    // Save socket session reverse mapping
    await redis.hset(socketKey, {
      roomCode: code,
      socketId,
      username,
      joinedAt: String(joinedAt),
    });
    await redis.expire(socketKey, ENV.ROOM_EXPIRY_SECONDS);

    const activeUsers = await this.getActiveUsers(code);

    return {
      room,
      isHost,
      joinedAt,
      users: activeUsers,
    };
  }

  /**
   * Retrieves active users in a room sorted by session start time.
   */
  static async getActiveUsers(roomCode) {
    const code = roomCode.toUpperCase();
    const usersKey = getRoomUsersKey(code);
    const room = await this.getRoom(code);

    // Fetch socket IDs ordered by joinedAt ascending (oldest first)
    const socketIds = await redis.zrange(usersKey, 0, -1);
    if (!socketIds || socketIds.length === 0) {
      return [];
    }

    const pipeline = redis.pipeline();
    for (const socketId of socketIds) {
      pipeline.hgetall(getSocketKey(socketId));
    }
    const results = await pipeline.exec();

    const users = [];
    for (let i = 0; i < socketIds.length; i++) {
      const socketId = socketIds[i];
      const err = results[i][0];
      const data = results[i][1];

      if (!err && data && Object.keys(data).length > 0) {
        users.push({
          socketId,
          username: data.username || 'Anonymous',
          joinedAt: parseInt(data.joinedAt || '0', 10),
          isHost: room ? room.hostSocketId === socketId : false,
        });
      } else {
        // Fallback if socket metadata expired but ZSET still has entry
        users.push({
          socketId,
          username: 'User',
          joinedAt: 0,
          isHost: room ? room.hostSocketId === socketId : false,
        });
      }
    }

    return users;
  }

  /**
   * Updates media playback state from host CONTROL_ACTION.
   */
  static async handleControlAction(roomCode, socketId, { action, mediaTime, playbackRate = 1.0, videoUrl }) {
    const code = roomCode.toUpperCase();
    const room = await this.getRoom(code);

    if (!room) {
      throw new Error(`Room ${code} not found`);
    }

    if (room.hostSocketId !== socketId) {
      throw new Error('Unauthorized: Only the room host can execute control actions');
    }

    const serverTimestamp = Date.now();
    let nextPlaybackState = room.playbackState;

    if (action === CONTROL_TYPE.PLAY) {
      nextPlaybackState = PLAYBACK_STATE.PLAYING;
    } else if (action === CONTROL_TYPE.PAUSE) {
      nextPlaybackState = PLAYBACK_STATE.PAUSED;
    } else if (action === CONTROL_TYPE.SEEK) {
      // Seek retains current playing/paused status unless specified
      nextPlaybackState = room.playbackState;
    }

    const roomUpdates = {
      playbackState: nextPlaybackState,
      mediaTime: String(mediaTime),
      targetTimestamp: String(serverTimestamp),
      updatedAt: String(serverTimestamp),
    };

    if (videoUrl && typeof videoUrl === 'string' && videoUrl.trim() !== '') {
      roomUpdates.videoUrl = videoUrl.trim();
    }

    const roomKey = getRoomKey(code);
    await redis.hset(roomKey, roomUpdates);

    return {
      action,
      mediaTime: parseFloat(mediaTime),
      playbackRate: parseFloat(playbackRate),
      playbackState: nextPlaybackState,
      videoUrl: roomUpdates.videoUrl || room.videoUrl || DEFAULT_VIDEO_URL,
      serverTimestamp,
      issuedBy: socketId,
    };
  }

  /**
   * Periodic heartbeat handler updating media time in Redis.
   */
  static async handleHeartbeat(roomCode, socketId, { mediaTime, playbackState }) {
    const code = roomCode.toUpperCase();
    const room = await this.getRoom(code);

    if (!room) {
      throw new Error(`Room ${code} not found`);
    }

    if (room.hostSocketId !== socketId) {
      throw new Error('Unauthorized: Only the host can send heartbeats');
    }

    const now = Date.now();
    const roomKey = getRoomKey(code);
    const updates = {
      mediaTime: String(mediaTime),
      updatedAt: String(now),
    };

    if (playbackState) {
      updates.playbackState = playbackState;
    }

    await redis.hset(roomKey, updates);

    return {
      mediaTime: parseFloat(mediaTime),
      updatedAt: now,
    };
  }

  /**
   * Handles user disconnection:
   * - Cleans up user session and room set
   * - If host disconnected, automatically reassigns host status to participant with longest active session
   */
  static async handleDisconnect(socketId) {
    const socketKey = getSocketKey(socketId);
    const socketData = await redis.hgetall(socketKey);

    if (!socketData || !socketData.roomCode) {
      return null;
    }

    const roomCode = socketData.roomCode.toUpperCase();
    const roomKey = getRoomKey(roomCode);
    const usersKey = getRoomUsersKey(roomCode);

    // Remove user from sorted set & clean socket key
    await redis.zrem(usersKey, socketId);
    await redis.del(socketKey);

    const room = await this.getRoom(roomCode);
    if (!room) {
      return null;
    }

    const remainingCount = await redis.zcard(usersKey);
    let hostChanged = null;

    if (room.hostSocketId === socketId) {
      if (remainingCount > 0) {
        // Find user with smallest joinedAt score (longest active session)
        const [longestActiveSocketId] = await redis.zrange(usersKey, 0, 0);

        if (longestActiveSocketId) {
          await redis.hset(roomKey, 'hostSocketId', longestActiveSocketId);
          hostChanged = {
            previousHostSocketId: socketId,
            newHostSocketId: longestActiveSocketId,
            reassignedAt: Date.now(),
          };
        }
      } else {
        // No participants remaining in room - clear host or set cleanup TTL
        await redis.hset(roomKey, 'hostSocketId', '');
        await redis.expire(roomKey, 3600); // 1 hour grace period
      }
    }

    return {
      roomCode,
      socketId,
      remainingCount,
      hostChanged,
    };
  }
}
