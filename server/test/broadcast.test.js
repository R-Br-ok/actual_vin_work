import assert from 'node:assert';
import http from 'http';
import { io as ClientIO } from 'socket.io-client';
import app from '../src/app.js';
import { connectRedis, redis } from '../src/config/redis.js';
import { initializeSockets } from '../src/sockets/index.js';
import { RoomService, DEFAULT_VIDEO_URL } from '../src/services/roomService.js';
import { EVENTS } from '../src/constants/events.js';

console.log('--- Running Real-Time Multi-Client Broadcasting Test ---');

async function runBroadcastTest() {
  await connectRedis();

  const server = http.createServer(app);
  const io = initializeSockets(server);

  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const serverUrl = `http://localhost:${port}`;
  console.log(`[TestServer] Running on ${serverUrl}`);

  // Test 1: Verify Default Video URL on Room Creation
  const room = await RoomService.createRoom({ roomCode: 'SYNC99' });
  assert.strictEqual(
    room.videoUrl,
    DEFAULT_VIDEO_URL,
    'Default videoUrl must match Google public test stream'
  );
  console.log('[PASS] Default video URL verified:', room.videoUrl);

  // Connect Host and Viewer sockets
  const hostSocket = ClientIO(serverUrl, { transports: ['websocket'] });
  const viewerSocket = ClientIO(serverUrl, { transports: ['websocket'] });

  await Promise.all([
    new Promise((resolve) => hostSocket.on('connect', resolve)),
    new Promise((resolve) => viewerSocket.on('connect', resolve)),
  ]);
  console.log(`[PASS] Both sockets connected: Host (${hostSocket.id}), Viewer (${viewerSocket.id})`);

  // Join Room SYNC99
  const hostJoinPromise = new Promise((resolve) => {
    hostSocket.emit(EVENTS.JOIN_ROOM, { roomCode: 'SYNC99', username: 'HostAlice' }, (res) => {
      assert.strictEqual(res.success, true);
      assert.strictEqual(res.isHost, true);
      resolve(res);
    });
  });

  await hostJoinPromise;

  const viewerJoinPromise = new Promise((resolve) => {
    viewerSocket.emit(EVENTS.JOIN_ROOM, { roomCode: 'SYNC99', username: 'ViewerBob' }, (res) => {
      assert.strictEqual(res.success, true);
      assert.strictEqual(res.isHost, false);
      resolve(res);
    });
  });

  await viewerJoinPromise;
  console.log('[PASS] Both Host and Viewer joined room SYNC99');

  // Test 2: Chat Broadcasting (SEND_MESSAGE -> NEW_MESSAGE)
  const chatMessagePromise = new Promise((resolve) => {
    viewerSocket.on(EVENTS.NEW_MESSAGE, (payload) => {
      console.log('[Test] Viewer received NEW_MESSAGE:', payload);
      assert.strictEqual(payload.message, 'Hey everyone, grab some popcorn!');
      assert.strictEqual(payload.username, 'HostAlice');
      assert.strictEqual(payload.roomCode, 'SYNC99');
      resolve();
    });
  });

  hostSocket.emit(EVENTS.SEND_MESSAGE, {
    roomCode: 'SYNC99',
    message: 'Hey everyone, grab some popcorn!',
    username: 'HostAlice',
  });

  await chatMessagePromise;
  console.log('[PASS] Chat broadcasting verified: SEND_MESSAGE -> NEW_MESSAGE');

  // Test 3: Emoji Reaction Broadcasting (EMIT_REACTION -> REACTION_BROADCAST)
  const reactionPromise = new Promise((resolve) => {
    viewerSocket.on(EVENTS.REACTION_BROADCAST, (payload) => {
      console.log('[Test] Viewer received REACTION_BROADCAST:', payload);
      assert.strictEqual(payload.emoji, '🔥');
      assert.strictEqual(payload.username, 'HostAlice');
      assert.strictEqual(payload.roomCode, 'SYNC99');
      assert.ok(typeof payload.x === 'number');
      resolve();
    });
  });

  hostSocket.emit(EVENTS.EMIT_REACTION, {
    roomCode: 'SYNC99',
    emoji: '🔥',
    username: 'HostAlice',
  });

  await reactionPromise;
  console.log('[PASS] Emoji broadcasting verified: EMIT_REACTION -> REACTION_BROADCAST');

  // Test 4: Video Sync & Remote Controls (CONTROL_ACTION -> CONTROL_ACTION_BROADCAST)
  const controlPromise = new Promise((resolve) => {
    viewerSocket.on(EVENTS.CONTROL_ACTION_BROADCAST, (payload) => {
      console.log('[Test] Viewer received CONTROL_ACTION_BROADCAST:', payload);
      assert.strictEqual(payload.action, 'PLAY');
      assert.strictEqual(payload.mediaTime, 42.5);
      assert.strictEqual(payload.videoUrl, DEFAULT_VIDEO_URL);
      assert.ok(payload.serverTimestamp > 0);
      resolve();
    });
  });

  hostSocket.emit(EVENTS.CONTROL_ACTION, {
    roomCode: 'SYNC99',
    action: 'PLAY',
    mediaTime: 42.5,
    videoUrl: DEFAULT_VIDEO_URL,
  });

  await controlPromise;
  console.log('[PASS] Video control broadcasting verified: CONTROL_ACTION -> CONTROL_ACTION_BROADCAST');

  // Cleanup
  hostSocket.disconnect();
  viewerSocket.disconnect();
  io.close();
  server.close();
  try {
    redis.disconnect();
  } catch {}

  console.log('--- ALL REAL-TIME BROADCASTING TESTS PASSED PERFECTLY ---');
}

runBroadcastTest()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[FAIL] Broadcast test failed:', err);
    process.exit(1);
  });
