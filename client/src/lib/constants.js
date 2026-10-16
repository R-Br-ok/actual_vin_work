export const SOCKET_EVENTS = {
  // Clock synchronization
  SYNC_CLOCK: 'SYNC_CLOCK',
  SYNC_CLOCK_RESPONSE: 'SYNC_CLOCK_RESPONSE',

  // Room lifecycle
  JOIN_ROOM: 'JOIN_ROOM',
  ROOM_JOINED: 'ROOM_JOINED',
  USER_JOINED: 'USER_JOINED',
  USER_LEFT: 'USER_LEFT',
  ROOM_ERROR: 'ROOM_ERROR',

  // Media controls
  CONTROL_ACTION: 'CONTROL_ACTION',
  CONTROL_ACTION_BROADCAST: 'CONTROL_ACTION_BROADCAST',

  // Video source switching
  CHANGE_VIDEO: 'CHANGE_VIDEO',
  VIDEO_CHANGED: 'VIDEO_CHANGED',

  // Shared watch queue
  UPDATE_QUEUE: 'UPDATE_QUEUE',
  QUEUE_UPDATED: 'QUEUE_UPDATED',

  // Heartbeat
  HEARTBEAT: 'HEARTBEAT',
  HEARTBEAT_ACK: 'HEARTBEAT_ACK',
  STATE_SYNC: 'STATE_SYNC',

  // Social (Chat & Reactions)
  SEND_MESSAGE: 'SEND_MESSAGE',
  NEW_MESSAGE: 'NEW_MESSAGE',
  EMIT_REACTION: 'EMIT_REACTION',
  REACTION_BROADCAST: 'REACTION_BROADCAST',

  // Host election & errors
  HOST_CHANGED: 'HOST_CHANGED',
  ERROR: 'ERROR',
};

export const PLAYBACK_STATE = {
  PLAYING: 'PLAYING',
  PAUSED: 'PAUSED',
};

export const CONTROL_TYPE = {
  PLAY: 'PLAY',
  PAUSE: 'PAUSE',
  SEEK: 'SEEK',
};

export const DRIFT_THRESHOLDS = {
  HARD_SEEK_SECONDS: 0.5, // |drift| > 0.50s: hard seek
  SMOOTH_TOLERANCE_SECONDS: 0.1, // 0.10s <= |drift| <= 0.50s: rate nudge
  SPEED_UP_RATE: 1.05, // client behind
  SLOW_DOWN_RATE: 0.95, // client ahead
  NORMAL_RATE: 1.0,
  CORRECTION_INTERVAL_MS: 3000,
};

export const CLOCK_SYNC = {
  EMA_ALPHA: 0.25, // weight of each new offset sample
  BURST_SAMPLES: 5, // rapid pings right after connecting
  BURST_SPACING_MS: 250,
  STEADY_INTERVAL_MS: 10000,
};

export const HEARTBEAT_INTERVAL_MS = 3000;

export const REACTION_EMOJIS = ['🔥', '❤️', '😂', '😮', '👏', '🍿', '😱', '🎉'];
