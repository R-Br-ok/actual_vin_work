export const EVENTS = {
  // Clock synchronization (NTP-style ping/pong)
  SYNC_CLOCK: 'SYNC_CLOCK',
  SYNC_CLOCK_RESPONSE: 'SYNC_CLOCK_RESPONSE',

  // Room lifecycle
  JOIN_ROOM: 'JOIN_ROOM',
  ROOM_JOINED: 'ROOM_JOINED',
  USER_JOINED: 'USER_JOINED',
  USER_LEFT: 'USER_LEFT',
  ROOM_ERROR: 'ROOM_ERROR', // JOIN_ROOM for a room that was never created / has expired

  // Media controls
  CONTROL_ACTION: 'CONTROL_ACTION',
  CONTROL_ACTION_BROADCAST: 'CONTROL_ACTION_BROADCAST',

  // Playback speed (host only)
  CHANGE_PLAYBACK_RATE: 'CHANGE_PLAYBACK_RATE',
  PLAYBACK_RATE_CHANGED: 'PLAYBACK_RATE_CHANGED',

  // Video source switching
  CHANGE_VIDEO: 'CHANGE_VIDEO',
  VIDEO_CHANGED: 'VIDEO_CHANGED',

  // Shared watch queue
  UPDATE_QUEUE: 'UPDATE_QUEUE',
  QUEUE_UPDATED: 'QUEUE_UPDATED',

  // Heartbeat & status
  HEARTBEAT: 'HEARTBEAT',
  HEARTBEAT_ACK: 'HEARTBEAT_ACK',
  STATE_SYNC: 'STATE_SYNC', // host heartbeat re-anchor relayed to viewers

  // Social (Chat & Reactions)
  SEND_MESSAGE: 'SEND_MESSAGE',
  NEW_MESSAGE: 'NEW_MESSAGE',
  EMIT_REACTION: 'EMIT_REACTION',
  REACTION_BROADCAST: 'REACTION_BROADCAST',

  // Host election & errors
  HOST_CHANGED: 'HOST_CHANGED',
  ERROR: 'ERROR',

  // Connection
  DISCONNECT: 'disconnect',
};
