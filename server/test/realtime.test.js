import assert from 'node:assert';
import http from 'http';
import { io as ClientIO } from 'socket.io-client';
import app from '../src/app.js';
import { connectRedis, redis } from '../src/config/redis.js';
import { initializeSockets } from '../src/sockets/index.js';
import { EVENTS } from '../src/constants/events.js';

console.log('--- Running Video / Queue / Late-Join Sync Test ---');

const ELEPHANTS = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4';
const TEARS = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4';

function once(socket, event, timeoutMs = 3000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out waiting for ${event}`)), timeoutMs);
    socket.once(event, (payload) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

function emitAck(socket, event, payload) {
  return new Promise((resolve) => socket.emit(event, payload, resolve));
}

async function run() {
  await connectRedis();
  const server = http.createServer(app);
  const io = initializeSockets(server);
  await new Promise((resolve) => server.listen(0, resolve));
  const url = `http://localhost:${server.address().port}`;

  const host = ClientIO(url, { transports: ['websocket'] });
  const viewer = ClientIO(url, { transports: ['websocket'] });
  await Promise.all([once(host, 'connect'), once(viewer, 'connect')]);

  const hostJoin = await emitAck(host, EVENTS.JOIN_ROOM, { roomCode: 'qa-77z', username: 'Hana' });
  assert.strictEqual(hostJoin.success, true);
  assert.strictEqual(hostJoin.roomCode, 'QA77Z', 'room codes are sanitised to uppercase alphanumerics');
  assert.strictEqual(hostJoin.isHost, true);
  assert.ok(Array.isArray(hostJoin.queue));
  const code = hostJoin.roomCode;

  await emitAck(viewer, EVENTS.JOIN_ROOM, { roomCode: code, username: 'Vik' });
  console.log('[PASS] host + viewer joined', code);

  // 1. Queue: viewer adds, everyone receives the same array
  const queueSeenByHost = once(host, EVENTS.QUEUE_UPDATED);
  const addRes = await emitAck(viewer, EVENTS.UPDATE_QUEUE, {
    op: 'ADD',
    item: { id: 'elephants-dream', title: 'Elephants Dream', videoUrl: ELEPHANTS },
  });
  assert.strictEqual(addRes.success, true);
  const hostQueue = (await queueSeenByHost).queue;
  assert.strictEqual(hostQueue.length, 1);
  assert.strictEqual(hostQueue[0].addedBy, 'Vik');
  assert.deepStrictEqual(hostQueue, addRes.queue, 'all participants hold an identical queue');

  await emitAck(host, EVENTS.UPDATE_QUEUE, { op: 'ADD', item: { id: 'tears', title: 'Tears of Steel', videoUrl: TEARS } });
  const moved = await emitAck(host, EVENTS.UPDATE_QUEUE, { op: 'MOVE', queueId: hostQueue[0].queueId, toIndex: 1 });
  assert.deepStrictEqual(moved.queue.map((q) => q.id), ['tears', 'elephants-dream']);

  const denied = await emitAck(viewer, EVENTS.UPDATE_QUEUE, { op: 'CLEAR' });
  assert.strictEqual(denied.success, false, 'viewers cannot clear the queue');
  console.log('[PASS] UPDATE_QUEUE -> QUEUE_UPDATED (ADD / MOVE / permissions)');

  // 2. Concurrent adds are serialised — nothing lost
  const burst = await Promise.all(
    [1, 2, 3, 4].map((n) =>
      emitAck(n % 2 ? host : viewer, EVENTS.UPDATE_QUEUE, {
        op: 'ADD',
        item: { id: `clip-${n}`, title: `Clip ${n}`, videoUrl: '/sample.mp4' },
      })
    )
  );
  assert.ok(burst.every((r) => r.success));
  const finalLen = Math.max(...burst.map((r) => r.queue.length));
  assert.strictEqual(finalLen, 6, 'concurrent ADDs must all land');
  console.log('[PASS] concurrent queue edits serialised');

  // 3. CHANGE_VIDEO from queue: VIDEO_CHANGED + QUEUE_UPDATED to both
  const tearsItem = moved.queue[0];
  const viewerVideo = once(viewer, EVENTS.VIDEO_CHANGED);
  const viewerQueue = once(viewer, EVENTS.QUEUE_UPDATED);
  const change = await emitAck(host, EVENTS.CHANGE_VIDEO, { queueId: tearsItem.queueId, autoplay: true });
  assert.strictEqual(change.success, true);
  const vc = await viewerVideo;
  assert.strictEqual(vc.videoUrl, TEARS);
  assert.strictEqual(vc.mediaTime, 0);
  assert.strictEqual(vc.movie.title, 'Tears of Steel');
  assert.strictEqual(vc.autoplay, true);
  assert.ok(!(await viewerQueue).queue.some((q) => q.queueId === tearsItem.queueId), 'played item leaves the queue');

  const viewerChange = await emitAck(viewer, EVENTS.CHANGE_VIDEO, { videoUrl: ELEPHANTS });
  assert.strictEqual(viewerChange.success, false, 'only the host may change video');
  console.log('[PASS] CHANGE_VIDEO -> VIDEO_CHANGED');

  // 4. PLAY + heartbeat -> STATE_SYNC
  const play = once(viewer, EVENTS.CONTROL_ACTION_BROADCAST);
  host.emit(EVENTS.CONTROL_ACTION, { action: 'PLAY', mediaTime: 12 });
  const playMsg = await play;
  assert.strictEqual(playMsg.playbackState, 'PLAYING');

  const sync = once(viewer, EVENTS.STATE_SYNC);
  host.emit(EVENTS.HEARTBEAT, { mediaTime: 15, playbackState: 'PLAYING', clientTimestamp: Date.now() });
  const syncMsg = await sync;
  assert.strictEqual(syncMsg.mediaTime, 15);
  assert.ok(Math.abs(syncMsg.targetTimestamp - Date.now()) < 1000, 'heartbeat re-anchors targetTimestamp');
  console.log('[PASS] HEARTBEAT -> STATE_SYNC re-anchor');

  // 5. Chat history + late joiner snapshot
  await emitAck(host, EVENTS.SEND_MESSAGE, { message: 'popcorn ready?' });
  await new Promise((r) => setTimeout(r, 400));

  const late = ClientIO(url, { transports: ['websocket'] });
  await once(late, 'connect');
  const lateJoin = await emitAck(late, EVENTS.JOIN_ROOM, { roomCode: code, username: 'Lena' });
  assert.strictEqual(lateJoin.isHost, false);
  assert.strictEqual(lateJoin.roomState.videoUrl, TEARS);
  assert.strictEqual(lateJoin.roomState.playbackState, 'PLAYING');
  assert.strictEqual(lateJoin.users.length, 3);
  assert.strictEqual(lateJoin.queue.length, 5);
  assert.ok(lateJoin.messages.some((m) => m.message === 'popcorn ready?' && m.isHost === true));
  assert.ok(
    lateJoin.currentMediaTime > 15.2 && lateJoin.currentMediaTime < 16.5,
    `late joiner expected position should be ~15.4s, got ${lateJoin.currentMediaTime}`
  );
  console.log('[PASS] late joiner snapshot (media anchor, position, queue, users, chat)');

  // 6. Host leaves -> oldest remaining becomes host
  const hostChanged = once(viewer, EVENTS.HOST_CHANGED);
  host.disconnect();
  const hc = await hostChanged;
  assert.strictEqual(hc.newHostSocketId, viewer.id);
  assert.strictEqual(hc.newHostUsername, 'Vik');
  console.log('[PASS] host failover');

  viewer.disconnect();
  late.disconnect();
  io.close();
  server.close();
  try {
    redis.disconnect();
  } catch {}
  console.log('--- ALL VIDEO / QUEUE / LATE-JOIN TESTS PASSED ---');
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[FAIL]', err);
    process.exit(1);
  });
