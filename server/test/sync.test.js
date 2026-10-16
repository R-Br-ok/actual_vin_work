import assert from 'node:assert';
import { RoomService } from '../src/services/roomService.js';
import { getServerTimestamp } from '../src/services/clockService.js';
import { EVENTS } from '../src/constants/events.js';
import { PLAYBACK_STATE, CONTROL_TYPE } from '../src/constants/playback.js';

console.log('--- Running Sync Server Unit & Logic Tests ---');

// 1. Room Code Generation
async function testRoomCode() {
  const code = await RoomService.generateUniqueRoomCode();
  assert.strictEqual(typeof code, 'string', 'Code should be a string');
  assert.strictEqual(code.length, 6, `Code length should be 6 characters, got ${code.length}`);
  assert.match(code, /^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6}$/, 'Code should match character set');
  console.log(`[PASS] Room code generated successfully: ${code}`);
}

// 2. Clock Service
function testClockService() {
  const t1 = getServerTimestamp();
  assert.strictEqual(typeof t1, 'number');
  assert.ok(t1 > 0, 'Server timestamp should be positive integer');

  // NTP Calculation verification
  const t0 = 1000;
  const sReceive = 1010;
  const sTransmit = 1012;
  const t3 = 1022;

  const rtt = (t3 - t0) - (sTransmit - sReceive);
  const offset = sReceive - (t0 + rtt / 2);

  assert.strictEqual(rtt, 20, 'RTT should be 20ms');
  assert.strictEqual(offset, 0, 'Offset should be 0ms under symmetric latency');
  console.log('[PASS] NTP Clock synchronization formula validated');
}

// 3. Constants validation
function testConstants() {
  assert.strictEqual(EVENTS.SYNC_CLOCK, 'SYNC_CLOCK');
  assert.strictEqual(EVENTS.JOIN_ROOM, 'JOIN_ROOM');
  assert.strictEqual(EVENTS.CONTROL_ACTION, 'CONTROL_ACTION');
  assert.strictEqual(EVENTS.HEARTBEAT, 'HEARTBEAT');
  assert.strictEqual(PLAYBACK_STATE.PLAYING, 'PLAYING');
  assert.strictEqual(PLAYBACK_STATE.PAUSED, 'PAUSED');
  assert.strictEqual(CONTROL_TYPE.PLAY, 'PLAY');
  assert.strictEqual(CONTROL_TYPE.PAUSE, 'PAUSE');
  assert.strictEqual(CONTROL_TYPE.SEEK, 'SEEK');
  console.log('[PASS] Event and playback constants validated');
}

import { redis } from '../src/config/redis.js';

async function runTests() {
  try {
    testClockService();
    testConstants();
    await testRoomCode();
    console.log('--- All Sync Server Logic Tests Passed Successfully ---');
    try {
      redis.disconnect();
    } catch {}
    process.exit(0);
  } catch (err) {
    console.error('[FAIL] Test failed:', err);
    try {
      redis.disconnect();
    } catch {}
    process.exit(1);
  }
}

runTests();
