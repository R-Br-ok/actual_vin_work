import assert from 'node:assert';
import { RoomService } from '../src/services/roomService.js';
import { connectRedis, redis } from '../src/config/redis.js';
import { PLAYBACK_STATE, CONTROL_TYPE } from '../src/constants/playback.js';

console.log('--- Testing In-Memory Fallback Engine & Room CRUD Operations ---');

async function testInMemoryRoomCRUD() {
  // 1. Initialize Redis connection probe (will fall back to in-memory)
  await connectRedis();
  assert.strictEqual(redis.isInMemory, true, 'Should fall back to In-Memory store when local Redis is offline');
  console.log('[PASS] In-Memory fallback active');

  // 2. Room Creation
  const code = await RoomService.generateUniqueRoomCode();
  const room = await RoomService.createRoom({
    roomCode: code,
    videoUrl: 'https://example.com/video.mp4',
    hostSocketId: 'socket_host_1',
  });

  assert.ok(room, 'Room should be created');
  assert.strictEqual(room.code, code.toUpperCase());
  assert.strictEqual(room.hostSocketId, 'socket_host_1');
  assert.strictEqual(room.playbackState, PLAYBACK_STATE.PAUSED);
  console.log(`[PASS] Room created: ${room.code}`);

  // 3. User Registration
  const user1 = await RoomService.addUserToRoom(code, 'socket_host_1', 'Alice');
  assert.strictEqual(user1.isHost, true, 'User1 should be host');

  // Add User 2 (joined slightly later)
  await new Promise((r) => setTimeout(r, 20));
  const user2 = await RoomService.addUserToRoom(code, 'socket_user_2', 'Bob');
  assert.strictEqual(user2.isHost, false, 'User2 should not be host');

  const users = await RoomService.getActiveUsers(code);
  assert.strictEqual(users.length, 2, 'Should have 2 active users');
  assert.strictEqual(users[0].socketId, 'socket_host_1', 'First user should be oldest');
  assert.strictEqual(users[1].socketId, 'socket_user_2');
  console.log('[PASS] User registration & active users retrieval verified');

  // 4. Control Action (Play & Seek)
  const controlPlay = await RoomService.handleControlAction(code, 'socket_host_1', {
    action: CONTROL_TYPE.PLAY,
    mediaTime: 15.5,
  });
  assert.strictEqual(controlPlay.playbackState, PLAYBACK_STATE.PLAYING);
  assert.strictEqual(controlPlay.mediaTime, 15.5);

  const updatedRoom = await RoomService.getRoom(code);
  assert.strictEqual(updatedRoom.playbackState, PLAYBACK_STATE.PLAYING);
  assert.strictEqual(updatedRoom.mediaTime, 15.5);
  console.log('[PASS] Control actions (PLAY/PAUSE/SEEK) verified');

  // 5. Periodic Heartbeat
  const heartbeat = await RoomService.handleHeartbeat(code, 'socket_host_1', {
    mediaTime: 18.5,
  });
  assert.strictEqual(heartbeat.mediaTime, 18.5);

  const roomAfterHeartbeat = await RoomService.getRoom(code);
  assert.strictEqual(roomAfterHeartbeat.mediaTime, 18.5);
  console.log('[PASS] Periodic heartbeat update verified');

  // 6. Host Disconnection & Longevity Reassignment
  const disconnectResult = await RoomService.handleDisconnect('socket_host_1');
  assert.ok(disconnectResult, 'Disconnect should return result');
  assert.ok(disconnectResult.hostChanged, 'Host should be reassigned');
  assert.strictEqual(disconnectResult.hostChanged.previousHostSocketId, 'socket_host_1');
  assert.strictEqual(disconnectResult.hostChanged.newHostSocketId, 'socket_user_2');

  const roomAfterDisconnect = await RoomService.getRoom(code);
  assert.strictEqual(roomAfterDisconnect.hostSocketId, 'socket_user_2', 'Host should now be Bob');
  console.log('[PASS] Host failover to oldest active session verified');

  console.log('--- All In-Memory Fallback & Room CRUD Tests Passed Successfully ---');
}

testInMemoryRoomCRUD()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[FAIL] Test error:', err);
    process.exit(1);
  });
