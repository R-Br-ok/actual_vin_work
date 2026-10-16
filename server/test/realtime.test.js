import assert from 'node:assert';
import http from 'http';
import { io as ClientIO } from 'socket.io-client';
import app from '../src/app.js';
import { connectRedis, redis } from '../src/config/redis.js';
import { initializeSockets } from '../src/sockets/index.js';
import { EVENTS } from '../src/constants/events.js';
import { RoomService } from '../src/services/roomService.js';

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

  // 0. Unknown rooms are rejected — over REST and over the socket — and never auto-created
  const missing = await fetch(`${url}/api/rooms/NOPE42`);
  const missingBody = await missing.json();
  assert.strictEqual(missing.status, 404);
  assert.deepStrictEqual(
    { success: missingBody.success, error: missingBody.error },
    { success: false, error: 'Room does not exist' }
  );

  const roomError = once(viewer, EVENTS.ROOM_ERROR);
  const badJoin = await emitAck(viewer, EVENTS.JOIN_ROOM, { roomCode: 'NOPE42', username: 'Vik' });
  assert.strictEqual(badJoin.success, false);
  assert.strictEqual((await roomError).message, 'Room does not exist or has expired');
  assert.strictEqual(await RoomService.roomExists('NOPE42'), false, 'joining must not create the room');
  const sneaky = await emitAck(viewer, EVENTS.EMIT_REACTION, { roomCode: 'NOPE42', emoji: '🔥' });
  assert.strictEqual(sneaky.success, false, 'no reactions into a room you never joined');
  console.log('[PASS] unknown room: GET 404 + ROOM_ERROR, nothing created');

  await RoomService.createRoom({ roomCode: 'QA77Z' });

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

  // 4b. Reactions reach the whole room — sender included
  const hostSees = once(host, EVENTS.REACTION_BROADCAST);
  const viewerSees = once(viewer, EVENTS.REACTION_BROADCAST);
  viewer.emit(EVENTS.EMIT_REACTION, { emoji: '🎉' });
  const [rh, rv] = await Promise.all([hostSees, viewerSees]);
  assert.deepStrictEqual(rh, rv, 'host and sender receive the identical payload');
  assert.strictEqual(rh.emoji, '🎉');
  assert.strictEqual(rh.senderId, viewer.id);
  assert.strictEqual(rh.senderName, 'Vik');
  assert.ok(rh.id && typeof rh.timestamp === 'number');

  const viewerSeesHost = once(viewer, EVENTS.REACTION_BROADCAST);
  const hostSeesOwn = once(host, EVENTS.REACTION_BROADCAST);
  host.emit(EVENTS.EMIT_REACTION, { emoji: '🔥' });
  const [fromHost] = await Promise.all([viewerSeesHost, hostSeesOwn]);
  assert.strictEqual(fromHost.senderName, 'Hana');
  console.log('[PASS] EMIT_REACTION -> REACTION_BROADCAST to host + all viewers (sender included)');

  // 5. Chat history + late joiner snapshot
  await emitAck(host, EVENTS.SEND_MESSAGE, { message: 'popcorn ready?' });
  await new Promise((r) => setTimeout(r, 400));

  const late = ClientIO(url, { transports: ['websocket'] });
  await once(late, 'connect');
  const lateJoin = await emitAck(late, EVENTS.JOIN_ROOM, { roomCode: code, username: 'vik' });
  assert.strictEqual(lateJoin.username, 'vik 2', 'duplicate names are de-duplicated (case-insensitive)');
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

  // 4a. Playback speed: host-only, re-anchored, persists across later control actions
  const rateSeen = once(viewer, EVENTS.PLAYBACK_RATE_CHANGED);
  const rateRes = await emitAck(host, EVENTS.CHANGE_PLAYBACK_RATE, { rate: 1.5, mediaTime: 20, clientTimestamp: Date.now() });
  assert.strictEqual(rateRes.success, true);
  const rc = await rateSeen;
  assert.strictEqual(rc.rate, 1.5);
  assert.strictEqual(rc.basePlaybackRate, 1.5);
  assert.strictEqual(rc.mediaTime, 20);
  assert.strictEqual((await emitAck(viewer, EVENTS.CHANGE_PLAYBACK_RATE, { rate: 2 })).success, false, 'viewers cannot change speed');
  assert.strictEqual((await emitAck(host, EVENTS.CHANGE_PLAYBACK_RATE, { rate: 3 })).success, false, 'rate must be in the allowed set');
  const seekAfterRate = once(viewer, EVENTS.CONTROL_ACTION_BROADCAST);
  host.emit(EVENTS.CONTROL_ACTION, { action: 'SEEK', mediaTime: 22 });
  assert.strictEqual((await seekAfterRate).playbackRate, 1.5, 'SEEK without a rate keeps the room speed');
  const roomAfterRate = await RoomService.getRoom(code);
  await new Promise((r) => setTimeout(r, 400));
  const { computeCurrentMediaTime } = await import('../src/services/roomService.js');
  const advanced = computeCurrentMediaTime(await RoomService.getRoom(code)) - roomAfterRate.mediaTime;
  assert.ok(advanced > 0.5 && advanced < 0.75, `1.5× room should advance ~0.6s in 0.4s, got ${advanced}`);
  await emitAck(host, EVENTS.CHANGE_PLAYBACK_RATE, { rate: 1 });
  console.log('[PASS] CHANGE_PLAYBACK_RATE -> PLAYBACK_RATE_CHANGED (host-only, persists, timeline scales)');

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
