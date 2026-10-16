import { customAlphabet } from 'nanoid';
import { redis } from '../config/redis.js';
import { ENV } from '../config/env.js';
import { PLAYBACK_STATE, CONTROL_TYPE } from '../constants/playback.js';

// 6-character uppercase alphanumeric excluding easily confusable characters (0, O, 1, I)
const generateCode = customAlphabet('23456789ABCDEFGHJKLMNPQRSTUVWXYZ', ENV.ROOM_CODE_LENGTH);
const generateQueueId = customAlphabet('abcdefghijkmnpqrstuvwxyz23456789', 10);

// Default open-access CORS-enabled public test stream
export const DEFAULT_VIDEO_URL = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';

export const DEFAULT_MOVIE = {
  id: 'big-buck-bunny',
  title: 'Big Buck Bunny',
  meta: '2008 · 10m',
  videoUrl: DEFAULT_VIDEO_URL,
};

const MAX_QUEUE_LENGTH = 50;
const MAX_CHAT_HISTORY = 50;
// A client-supplied anchor timestamp is trusted only if it is this close to server time
const MAX_CLIENT_ANCHOR_SKEW_MS = 2000;

const ROOM_KEY_PREFIX = 'room:';
const ROOM_USERS_PREFIX = 'room:users:';
const ROOM_CHAT_PREFIX = 'room:chat:';
const SOCKET_KEY_PREFIX = 'socket:';

function getRoomKey(roomCode) {
  return `${ROOM_KEY_PREFIX}${roomCode.toUpperCase()}`;
}

function getRoomUsersKey(roomCode) {
  return `${ROOM_USERS_PREFIX}${roomCode.toUpperCase()}`;
}

function getRoomChatKey(roomCode) {
  return `${ROOM_CHAT_PREFIX}${roomCode.toUpperCase()}`;
}

function getSocketKey(socketId) {
  return `${SOCKET_KEY_PREFIX}${socketId}`;
}

function safeJsonParse(value, fallback) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function clampString(value, max = 200) {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : undefined;
}

/**
 * Normalises a room code from user input / URLs: uppercase alphanumerics only, max 12 chars.
 */
export function sanitizeRoomCode(code) {
  if (typeof code !== 'string') return '';
  return code.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
}

/**
 * Accepts absolute http(s) URLs and same-origin paths (e.g. "/sample.mp4").
 */
export function isValidVideoUrl(url) {
  if (typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed || trimmed.length > 2048) return false;
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) return true;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Whitelists the movie metadata fields we keep in room state / queue.
 */
export function sanitizeMovie(movie = {}, fallbackUrl = '') {
  const videoUrl = clampString(movie.videoUrl, 2048) || fallbackUrl;
  return {
    id: clampString(movie.id, 80) || `custom-${Date.now()}`,
    title: clampString(movie.title, 120) || 'Untitled stream',
    subtitle: clampString(movie.subtitle, 200),
    meta: clampString(movie.meta, 80),
    genre: clampString(movie.genre, 40),
    category: clampString(movie.category, 40),
    image: clampString(movie.image, 2048),
    videoUrl,
  };
}

/**
 * Picks the anchor timestamp for a state change. When the host tells us the (server-clock)
 * moment it sampled its player, we use it so viewers line up with the host's real position,
 * otherwise fall back to the server receive time.
 */
function resolveAnchorTimestamp(clientTimestamp, now = Date.now()) {
  const ts = Number(clientTimestamp);
  if (Number.isFinite(ts) && Math.abs(now - ts) <= MAX_CLIENT_ANCHOR_SKEW_MS) {
    return Math.min(ts, now);
  }
  return now;
}

/**
 * Expected media position "now" given an anchor (mediaTime at targetTimestamp).
 */
export function computeCurrentMediaTime(room, now = Date.now()) {
  if (!room) return 0;
  if (room.playbackState !== PLAYBACK_STATE.PLAYING) return room.mediaTime;
  const elapsed = Math.max(0, (now - room.targetTimestamp) / 1000) * (room.playbackRate || 1);
  return room.mediaTime + elapsed;
}

// Per-room serialisation of read-modify-write sequences (queue edits, video changes).
const roomLocks = new Map();
export function withRoomLock(roomCode, task) {
  const key = roomCode.toUpperCase();
  const previous = roomLocks.get(key) || Promise.resolve();
  const run = previous.catch(() => {}).then(task);
  const tail = run.catch(() => {});
  roomLocks.set(key, tail);
  tail.then(() => {
    if (roomLocks.get(key) === tail) roomLocks.delete(key);
  });
  return run;
}

export const ROOM_NOT_FOUND = 'ROOM_NOT_FOUND';

/** Thrown when a socket tries to join a room that was never created (or has expired). */
export class RoomNotFoundError extends Error {
  constructor(roomCode) {
    super('Room does not exist or has expired');
    this.name = 'RoomNotFoundError';
    this.code = ROOM_NOT_FOUND;
    this.roomCode = roomCode;
  }
}

export class RoomService {
  /**
   * True only for rooms explicitly created via POST /api/rooms (or RoomService.createRoom)
   * that haven't expired.
   */
  static async roomExists(roomCode) {
    const code = sanitizeRoomCode(roomCode);
    if (!code) return false;
    return (await redis.exists(getRoomKey(code))) === 1;
  }

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
  static async createRoom({ roomCode, videoUrl = '', movie = null, hostSocketId = null } = {}) {
    const code = roomCode ? sanitizeRoomCode(roomCode) || (await this.generateUniqueRoomCode()) : await this.generateUniqueRoomCode();
    const roomKey = getRoomKey(code);
    const now = Date.now();
    const requestedUrl = videoUrl || movie?.videoUrl;
    const resolvedVideoUrl = isValidVideoUrl(requestedUrl) ? requestedUrl.trim() : DEFAULT_VIDEO_URL;
    const currentMovie =
      movie && typeof movie === 'object'
        ? sanitizeMovie({ ...movie, videoUrl: resolvedVideoUrl }, resolvedVideoUrl)
        : resolvedVideoUrl === DEFAULT_VIDEO_URL
          ? { ...DEFAULT_MOVIE }
          : sanitizeMovie({ title: 'Custom stream', videoUrl: resolvedVideoUrl }, resolvedVideoUrl);

    const roomState = {
      code,
      videoUrl: resolvedVideoUrl,
      currentMovie: JSON.stringify(currentMovie),
      playbackState: PLAYBACK_STATE.PAUSED,
      mediaTime: '0',
      playbackRate: '1',
      targetTimestamp: String(now),
      hostSocketId: hostSocketId || '',
      queue: '[]',
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

    const videoUrl = data.videoUrl || DEFAULT_VIDEO_URL;

    return {
      code: data.code,
      videoUrl,
      currentMovie: safeJsonParse(data.currentMovie, null) || { ...DEFAULT_MOVIE, videoUrl },
      playbackState: data.playbackState || PLAYBACK_STATE.PAUSED,
      mediaTime: parseFloat(data.mediaTime || '0'),
      playbackRate: parseFloat(data.playbackRate || '1') || 1,
      targetTimestamp: parseInt(data.targetTimestamp || '0', 10),
      hostSocketId: data.hostSocketId || null,
      queue: safeJsonParse(data.queue, []),
      createdAt: parseInt(data.createdAt || '0', 10),
      updatedAt: parseInt(data.updatedAt || '0', 10),
    };
  }

  /**
   * Adds or registers a user inside an existing room.
   * Rooms are never created implicitly: an unknown code throws RoomNotFoundError.
   * If the room has no host, this user becomes the host.
   */
  static async addUserToRoom(roomCode, socketId, username = 'Anonymous') {
    const code = roomCode.toUpperCase();
    const roomKey = getRoomKey(code);
    const usersKey = getRoomUsersKey(code);
    const socketKey = getSocketKey(socketId);
    const joinedAt = Date.now();

    return withRoomLock(code, async () => {
      const room = await this.getRoom(code);

      if (!room) {
        throw new RoomNotFoundError(code);
      }

      if (!room.hostSocketId) {
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
    });
  }

  /**
   * Full late-joiner snapshot: media anchor, the expected position right now,
   * the queue, participants and recent chat.
   */
  static async getRoomSnapshot(roomCode) {
    const room = await this.getRoom(roomCode);
    if (!room) return null;
    const serverTimestamp = Date.now();
    const [users, messages] = await Promise.all([this.getActiveUsers(roomCode), this.getChatHistory(roomCode)]);
    return {
      roomState: room,
      queue: room.queue,
      users,
      messages,
      serverTimestamp,
      currentMediaTime: computeCurrentMediaTime(room, serverTimestamp),
    };
  }

  /**
   * Returns the socket session (room code + username) for a connected socket.
   */
  static async getSocketSession(socketId) {
    const data = await redis.hgetall(getSocketKey(socketId));
    if (!data || Object.keys(data).length === 0) return null;
    return data;
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
  static async handleControlAction(roomCode, socketId, { action, mediaTime, playbackRate = 1.0, videoUrl, clientTimestamp }) {
    const code = roomCode.toUpperCase();

    return withRoomLock(code, async () => {
      const room = await this.getRoom(code);

      if (!room) {
        throw new Error(`Room ${code} not found`);
      }

      if (room.hostSocketId !== socketId) {
        throw new Error('Unauthorized: Only the room host can execute control actions');
      }

      const now = Date.now();
      const serverTimestamp = resolveAnchorTimestamp(clientTimestamp, now);
      let nextPlaybackState = room.playbackState;

      if (action === CONTROL_TYPE.PLAY) {
        nextPlaybackState = PLAYBACK_STATE.PLAYING;
      } else if (action === CONTROL_TYPE.PAUSE) {
        nextPlaybackState = PLAYBACK_STATE.PAUSED;
      } else if (action === CONTROL_TYPE.SEEK) {
        // Seek retains current playing/paused status
        nextPlaybackState = room.playbackState;
      }

      const rate = Number.isFinite(playbackRate) && playbackRate > 0 ? playbackRate : 1;
      const roomUpdates = {
        playbackState: nextPlaybackState,
        mediaTime: String(Math.max(0, mediaTime)),
        playbackRate: String(rate),
        targetTimestamp: String(serverTimestamp),
        updatedAt: String(now),
      };

      // Legacy path: a control action may also carry a new source URL
      if (isValidVideoUrl(videoUrl) && videoUrl.trim() !== room.videoUrl) {
        roomUpdates.videoUrl = videoUrl.trim();
        roomUpdates.currentMovie = JSON.stringify(
          sanitizeMovie({ title: 'Custom stream', videoUrl: videoUrl.trim() }, videoUrl.trim())
        );
      }

      await redis.hset(getRoomKey(code), roomUpdates);

      return {
        action,
        mediaTime: Math.max(0, parseFloat(mediaTime)),
        playbackRate: rate,
        playbackState: nextPlaybackState,
        videoUrl: roomUpdates.videoUrl || room.videoUrl || DEFAULT_VIDEO_URL,
        serverTimestamp,
        targetTimestamp: serverTimestamp,
        issuedBy: socketId,
      };
    });
  }

  /**
   * Host-only: switches the room's video source and resets the media position.
   * If `queueId` is supplied the matching queue entry is consumed atomically.
   */
  static async changeVideo(roomCode, socketId, { videoUrl, movie, queueId } = {}) {
    const code = roomCode.toUpperCase();

    return withRoomLock(code, async () => {
      const room = await this.getRoom(code);
      if (!room) throw new Error(`Room ${code} not found`);
      if (room.hostSocketId !== socketId) {
        throw new Error('Unauthorized: Only the room host can change the video');
      }

      let queue = Array.isArray(room.queue) ? room.queue : [];
      let source = movie && typeof movie === 'object' ? movie : null;

      if (queueId) {
        const queued = queue.find((item) => item.queueId === queueId);
        if (!queued) throw new Error('That queue item no longer exists');
        source = queued;
        queue = queue.filter((item) => item.queueId !== queueId);
      }

      const url = (videoUrl || source?.videoUrl || '').trim();
      if (!isValidVideoUrl(url)) {
        throw new Error('A valid http(s) or same-origin video URL is required');
      }

      const now = Date.now();
      const currentMovie = sanitizeMovie({ ...(source || {}), videoUrl: url }, url);

      await redis.hset(getRoomKey(code), {
        videoUrl: url,
        currentMovie: JSON.stringify(currentMovie),
        // Everyone loads paused at 0; the host starts playback once its player is ready.
        playbackState: PLAYBACK_STATE.PAUSED,
        mediaTime: '0',
        playbackRate: '1',
        targetTimestamp: String(now),
        queue: JSON.stringify(queue),
        updatedAt: String(now),
      });

      return {
        videoUrl: url,
        movie: currentMovie,
        mediaTime: 0,
        playbackRate: 1,
        playbackState: PLAYBACK_STATE.PAUSED,
        serverTimestamp: now,
        targetTimestamp: now,
        issuedBy: socketId,
        queue,
        queueChanged: Boolean(queueId),
      };
    });
  }

  /**
   * Applies a queue operation and returns the authoritative queue array.
   *
   * ops:
   *  - ADD    { item }               anyone
   *  - REMOVE { queueId }            host, or whoever added the item
   *  - MOVE   { queueId, toIndex }   host
   *  - CLEAR  {}                     host
   *  - SET    { queue }              host (full replacement, e.g. drag-and-drop reorder)
   */
  static async updateQueue(roomCode, socketId, { op, item, queueId, toIndex, queue: nextQueue } = {}, username = 'Anonymous') {
    const code = roomCode.toUpperCase();
    const operation = typeof op === 'string' ? op.toUpperCase() : '';

    return withRoomLock(code, async () => {
      const room = await this.getRoom(code);
      if (!room) throw new Error(`Room ${code} not found`);

      const isHost = room.hostSocketId === socketId;
      let queue = Array.isArray(room.queue) ? [...room.queue] : [];

      switch (operation) {
        case 'ADD': {
          if (!item || !isValidVideoUrl(item.videoUrl)) {
            throw new Error('Queue items need a valid video URL');
          }
          if (queue.length >= MAX_QUEUE_LENGTH) {
            throw new Error(`The queue is full (${MAX_QUEUE_LENGTH} items)`);
          }
          queue.push({
            ...sanitizeMovie(item, item.videoUrl.trim()),
            queueId: generateQueueId(),
            addedBy: username,
            addedBySocketId: socketId,
            addedAt: Date.now(),
          });
          break;
        }
        case 'REMOVE': {
          const target = queue.find((q) => q.queueId === queueId);
          if (!target) break; // already gone — idempotent
          if (!isHost && target.addedBySocketId !== socketId) {
            throw new Error('Only the host or the person who added it can remove this item');
          }
          queue = queue.filter((q) => q.queueId !== queueId);
          break;
        }
        case 'MOVE': {
          if (!isHost) throw new Error('Only the host can reorder the queue');
          const from = queue.findIndex((q) => q.queueId === queueId);
          if (from === -1) break;
          const to = Math.max(0, Math.min(queue.length - 1, parseInt(toIndex, 10) || 0));
          const [moved] = queue.splice(from, 1);
          queue.splice(to, 0, moved);
          break;
        }
        case 'CLEAR': {
          if (!isHost) throw new Error('Only the host can clear the queue');
          queue = [];
          break;
        }
        case 'SET': {
          if (!isHost) throw new Error('Only the host can replace the queue');
          if (!Array.isArray(nextQueue)) throw new Error('queue must be an array');
          const existing = new Map(queue.map((q) => [q.queueId, q]));
          queue = nextQueue
            .slice(0, MAX_QUEUE_LENGTH)
            .filter((q) => q && isValidVideoUrl(q.videoUrl))
            .map((q) => {
              const known = q.queueId && existing.get(q.queueId);
              if (known) return known;
              return {
                ...sanitizeMovie(q, q.videoUrl.trim()),
                queueId: generateQueueId(),
                addedBy: username,
                addedBySocketId: socketId,
                addedAt: Date.now(),
              };
            });
          break;
        }
        default:
          throw new Error(`Unknown queue operation '${op}'`);
      }

      await redis.hset(getRoomKey(code), {
        queue: JSON.stringify(queue),
        updatedAt: String(Date.now()),
      });

      return queue;
    });
  }

  /**
   * Stores a chat message in the capped room history (for late joiners).
   */
  static async addChatMessage(roomCode, message) {
    const key = getRoomChatKey(roomCode);
    await redis.rpush(key, JSON.stringify(message));
    await redis.ltrim(key, -MAX_CHAT_HISTORY, -1);
    await redis.expire(key, ENV.ROOM_EXPIRY_SECONDS);
  }

  static async getChatHistory(roomCode) {
    const raw = await redis.lrange(getRoomChatKey(roomCode), 0, -1);
    return (raw || []).map((entry) => safeJsonParse(entry, null)).filter(Boolean);
  }

  /**
   * Periodic host heartbeat: re-anchors the room's media position.
   * mediaTime AND targetTimestamp are updated together so viewers' expected
   * position (mediaTime + elapsed since targetTimestamp) stays correct.
   */
  static async handleHeartbeat(roomCode, socketId, { mediaTime, playbackState, clientTimestamp }) {
    const code = roomCode.toUpperCase();
    const room = await this.getRoom(code);

    if (!room) {
      throw new Error(`Room ${code} not found`);
    }

    if (room.hostSocketId !== socketId) {
      throw new Error('Unauthorized: Only the host can send heartbeats');
    }

    const now = Date.now();
    const anchor = resolveAnchorTimestamp(clientTimestamp, now);
    const nextState =
      playbackState === PLAYBACK_STATE.PLAYING || playbackState === PLAYBACK_STATE.PAUSED
        ? playbackState
        : room.playbackState;

    await redis.hset(getRoomKey(code), {
      mediaTime: String(Math.max(0, mediaTime)),
      targetTimestamp: String(anchor),
      playbackState: nextState,
      updatedAt: String(now),
    });

    return {
      mediaTime: Math.max(0, parseFloat(mediaTime)),
      targetTimestamp: anchor,
      playbackState: nextState,
      playbackRate: room.playbackRate,
      videoUrl: room.videoUrl,
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

    return withRoomLock(roomCode, async () => {
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
            const successor = await redis.hgetall(getSocketKey(longestActiveSocketId));
            hostChanged = {
              previousHostSocketId: socketId,
              newHostSocketId: longestActiveSocketId,
              newHostUsername: successor?.username || 'Anonymous',
              reassignedAt: Date.now(),
            };
          }
        } else {
          // No participants remaining in room - clear host and set cleanup TTL
          await redis.hset(roomKey, 'hostSocketId', '');
          await redis.expire(roomKey, 3600); // 1 hour grace period
        }
      }

      const users = remainingCount > 0 ? await this.getActiveUsers(roomCode) : [];

      return {
        roomCode,
        socketId,
        username: socketData.username || 'Anonymous',
        remainingCount,
        hostChanged,
        users,
      };
    });
  }
}
