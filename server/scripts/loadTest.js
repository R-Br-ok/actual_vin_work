#!/usr/bin/env node
/**
 * Watch-party sync load test / latency + drift benchmark.
 *
 *   npm run benchmark                                   # 10 and 50 participants against localhost:5000
 *   node scripts/loadTest.js --clients 10,25,50 --rounds 40
 *   node scripts/loadTest.js --url http://192.168.1.20:5000 --clients 20 --json results.json
 *   node scripts/loadTest.js --latency 40 --jitter 10   # emulate a WAN: +40±10 ms each way
 *
 * Per scenario (N virtual participants, participant #1 is the host):
 *   1. Creates a room over REST (rooms are never created implicitly) and connects N sockets.
 *   2. Every client runs NTP-style SYNC_CLOCK exchanges against its own *skewed* clock
 *      (each virtual client gets a random offset of ±--skew ms) and smooths θ with an EMA,
 *      exactly like the browser client (useClockSync).
 *   3. The host fires CONTROL_ACTIONs (PLAY → SEEK → PAUSE → PLAY …) every --interval ms.
 *   4. Each viewer timestamps every CONTROL_ACTION_BROADCAST and computes where it *would* put
 *      its player (M_expected = mediaTime + (localNow + θ̂ − targetTimestamp)/1000), which is
 *      compared to the host's true position at that instant → playback drift.
 *
 * All virtual clients share one process and one real clock, so "true" latency/drift can be
 * measured exactly; the simulated skew is what the sync algorithm has to undo.
 *
 * Requires the sync server to be running (npm run dev / npm start).
 */
import { io } from 'socket.io-client';
import { performance } from 'node:perf_hooks';
import fs from 'node:fs';
import { startLatencyProxy } from './latencyProxy.js';

// ---------------------------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------------------------
function parseArgs(argv) {
  const opts = {
    url: process.env.SYNC_URL || 'http://localhost:5000',
    clients: [10, 50],
    rounds: 30,
    interval: 300,
    syncSamples: 8,
    syncSpacing: 120,
    skew: 250,
    latency: 0,
    jitter: 0,
    json: null,
  };
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i];
    const next = () => argv[++i];
    if (key === '--url') opts.url = next();
    else if (key === '--clients') opts.clients = next().split(',').map((n) => parseInt(n, 10)).filter((n) => n >= 2);
    else if (key === '--rounds') opts.rounds = parseInt(next(), 10);
    else if (key === '--interval') opts.interval = parseInt(next(), 10);
    else if (key === '--sync-samples') opts.syncSamples = parseInt(next(), 10);
    else if (key === '--skew') opts.skew = parseInt(next(), 10);
    else if (key === '--json') opts.json = next();
    else if (key === '--latency') opts.latency = parseFloat(next());
    else if (key === '--jitter') opts.jitter = parseFloat(next());
    else if (key === '--help' || key === '-h') {
      console.log('Usage: node scripts/loadTest.js [--url URL] [--clients 10,50] [--rounds 30] [--interval 300] [--sync-samples 8] [--skew 250] [--latency ms] [--jitter ms] [--json out.json]');
      process.exit(0);
    }
  }
  if (!opts.clients.length) opts.clients = [10];
  return opts;
}

// ---------------------------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------------------------
const EVENTS = {
  JOIN_ROOM: 'JOIN_ROOM',
  SYNC_CLOCK: 'SYNC_CLOCK',
  CONTROL_ACTION: 'CONTROL_ACTION',
  CONTROL_ACTION_BROADCAST: 'CONTROL_ACTION_BROADCAST',
};

const EMA_ALPHA = 0.25; // same as client/src/lib/constants.js
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
/** Sub-millisecond wall-clock (epoch ms) — the shared "true" clock of this process. */
const trueNow = () => performance.timeOrigin + performance.now();

function percentile(sorted, p) {
  if (!sorted.length) return NaN;
  const rank = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (rank - lo);
}

function summarize(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const sum = sorted.reduce((a, b) => a + b, 0);
  return {
    n: sorted.length,
    min: sorted[0] ?? NaN,
    avg: sorted.length ? sum / sorted.length : NaN,
    p50: percentile(sorted, 50),
    p90: percentile(sorted, 90),
    p95: percentile(sorted, 95),
    p99: percentile(sorted, 99),
    max: sorted[sorted.length - 1] ?? NaN,
  };
}

const fmt = (v, digits = 2) => (Number.isFinite(v) ? v.toFixed(digits) : '—');

function printTable(title, header, rows) {
  const widths = header.map((h, i) => Math.max(h.length, ...rows.map((r) => String(r[i]).length)));
  const line = (cells) => '│ ' + cells.map((c, i) => (i === 0 ? String(c).padEnd(widths[i]) : String(c).padStart(widths[i]))).join(' │ ') + ' │';
  const sep = (l, m, r) => l + widths.map((w) => '─'.repeat(w + 2)).join(m) + r;
  console.log(`\n${title}`);
  console.log(sep('┌', '┬', '┐'));
  console.log(line(header));
  console.log(sep('├', '┼', '┤'));
  rows.forEach((r) => console.log(line(r)));
  console.log(sep('└', '┴', '┘'));
}

// ---------------------------------------------------------------------------------------------
// Virtual participant
// ---------------------------------------------------------------------------------------------
class VirtualClient {
  constructor(index, skewMs) {
    this.index = index;
    this.name = index === 0 ? 'Host' : `Viewer-${String(index).padStart(2, '0')}`;
    this.skew = skewMs; // this client's clock = true clock + skew
    this.theta = 0; // EMA estimate of (server clock − client clock); ideal value = −skew
    this.syncSamples = [];
    this.recentRtts = [];
    this.receipts = [];
    this.socket = null;
  }

  localNow() {
    return trueNow() + this.skew;
  }

  serverNowEstimate() {
    return this.localNow() + this.theta;
  }

  connect(url) {
    return new Promise((resolve, reject) => {
      this.socket = io(url, { transports: ['websocket'], forceNew: true, reconnection: false, timeout: 10000 });
      this.socket.once('connect', resolve);
      this.socket.once('connect_error', (err) => reject(new Error(`${this.name} connect failed: ${err.message} ${err.description?.message || err.description || ''}`)));
      this.socket.on(EVENTS.CONTROL_ACTION_BROADCAST, (payload) => {
        this.receipts.push({ receivedAt: trueNow(), localServerNow: this.serverNowEstimate(), payload });
      });
    });
  }

  async join(roomCode) {
    const res = await this.socket.timeout(10000).emitWithAck(EVENTS.JOIN_ROOM, { roomCode, username: this.name });
    if (!res?.success) throw new Error(`${this.name} failed to join: ${res?.message}`);
    this.isHost = res.isHost;
    return res;
  }

  /** One NTP exchange: t0 (client) → t1/t2 (server) → t3 (client). */
  async syncOnce() {
    const t0 = this.localNow();
    const res = await this.socket.timeout(5000).emitWithAck(EVENTS.SYNC_CLOCK, { clientSendTime: t0 });
    const t3 = this.localNow();
    const t1 = Number(res.serverReceiveTime);
    const t2 = Number(res.serverTransmitTime);

    const rtt = Math.max(0, t3 - t0 - (t2 - t1));
    const theta = (t1 - t0 + (t2 - t3)) / 2;

    // Same continuous EMA + jitter gating as the browser hook
    this.recentRtts.push(rtt);
    if (this.recentRtts.length > 8) this.recentRtts.shift();
    const best = Math.min(...this.recentRtts);
    const alpha = rtt > best * 2 + 30 ? EMA_ALPHA / 4 : EMA_ALPHA;
    this.theta = this.syncSamples.length === 0 ? theta : alpha * theta + (1 - alpha) * this.theta;

    this.syncSamples.push({ rtt, theta });
  }

  async syncClock(samples, spacing) {
    for (let i = 0; i < samples; i++) {
      await this.syncOnce();
      await sleep(spacing);
    }
  }

  /** |θ̂ − θ_true| — server and this process share a machine clock, so θ_true = −skew. */
  clockError() {
    return Math.abs(this.theta + this.skew);
  }

  close() {
    this.socket?.close();
  }
}

// ---------------------------------------------------------------------------------------------
// Scenario
// ---------------------------------------------------------------------------------------------
async function createRoom(url) {
  const res = await fetch(`${url}/api/rooms`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ movie: { id: 'loadtest', title: 'Load Test Reel', videoUrl: '/sample.mp4' } }),
  });
  if (!res.ok) throw new Error(`POST /api/rooms -> ${res.status}`);
  return (await res.json()).room.code;
}

async function runScenario(n, opts) {
  const roomCode = await createRoom(opts.clientUrl);
  const clients = Array.from({ length: n }, (_, i) => new VirtualClient(i, (Math.random() * 2 - 1) * opts.skew));

  // 1. Connect + join (host first so it is guaranteed the host role)
  const tConnect = trueNow();
  await Promise.all(clients.map((c) => c.connect(opts.clientUrl)));
  await clients[0].join(roomCode);
  await Promise.all(clients.slice(1).map((c) => c.join(roomCode)));
  const connectMs = trueNow() - tConnect;
  const [host, ...viewers] = clients;
  if (!host.isHost) throw new Error('First client did not get the host role');

  // 2. Clock sync burst — all clients concurrently
  await Promise.all(clients.map((c) => c.syncClock(opts.syncSamples, opts.syncSpacing)));

  // 3. Host control loop. The host models its own player so we know the true position.
  const sequence = ['PLAY', 'SEEK', 'PAUSE', 'PLAY', 'SEEK', 'SEEK'];
  const emitted = [];
  let errors = 0;
  let hostPos = 0;
  let hostPlaying = false;
  let hostAnchorTrue = trueNow();
  const hostPositionAt = (t) => (hostPlaying ? hostPos + (t - hostAnchorTrue) / 1000 : hostPos);

  for (let r = 0; r < opts.rounds; r++) {
    const action = sequence[r % sequence.length];
    const emitAt = trueNow();
    let mediaTime = hostPositionAt(emitAt);
    if (action === 'SEEK') mediaTime += 5 + Math.random() * 25;

    // Apply locally first (like the real host player), then emit with the host's server-time stamp
    hostPos = mediaTime;
    hostAnchorTrue = emitAt;
    if (action === 'PLAY') hostPlaying = true;
    if (action === 'PAUSE') hostPlaying = false;

    try {
      const res = await host.socket.timeout(5000).emitWithAck(EVENTS.CONTROL_ACTION, {
        roomCode,
        action,
        mediaTime,
        playbackRate: 1,
        clientTimestamp: host.serverNowEstimate(),
      });
      if (!res?.success) throw new Error(res?.message || 'rejected');
      emitted.push({
        key: `${res.action}:${res.targetTimestamp}`,
        action,
        emitAt,
        mediaTime,
        playing: hostPlaying,
        anchorTrue: emitAt,
        anchorPos: mediaTime,
      });
    } catch (err) {
      errors++;
    }
    await sleep(opts.interval);
  }
  await sleep(500); // let the last broadcasts land

  // 4. Analyse receipts
  const latency = [];
  const drift = [];
  const naiveDrift = [];
  let received = 0;
  const byKey = new Map(emitted.map((e) => [e.key, e]));

  for (const v of viewers) {
    for (const { receivedAt, localServerNow, payload } of v.receipts) {
      const ev = byKey.get(`${payload.action}:${payload.targetTimestamp}`);
      if (!ev) continue;
      received++;
      latency.push(receivedAt - ev.emitAt);

      if (ev.playing) {
        const truePos = ev.anchorPos + (receivedAt - ev.anchorTrue) / 1000;
        // What the viewer computes from the anchor + its synced clock
        const expected = payload.mediaTime + (localServerNow - payload.targetTimestamp) / 1000;
        drift.push(Math.abs(expected - truePos) * 1000);
        // What a client that ignored the anchor and just seeked to mediaTime would get
        naiveDrift.push(Math.abs(payload.mediaTime - truePos) * 1000);
      }
    }
  }

  const rtts = clients.flatMap((c) => c.syncSamples.slice(1).map((s) => s.rtt)); // skip cold first sample
  const clockErr = clients.map((c) => c.clockError());
  const tiers = { aligned: 0, rate: 0, hardSeek: 0 };
  drift.forEach((d) => {
    if (d < 100) tiers.aligned++;
    else if (d <= 500) tiers.rate++;
    else tiers.hardSeek++;
  });

  clients.forEach((c) => c.close());
  await sleep(300);

  return {
    participants: n,
    roomCode,
    connectMs,
    eventsEmitted: emitted.length,
    controlErrors: errors,
    broadcastsExpected: emitted.length * viewers.length,
    broadcastsReceived: received,
    rtt: summarize(rtts),
    controlLatency: summarize(latency),
    drift: summarize(drift),
    naiveDrift: summarize(naiveDrift),
    clockError: summarize(clockErr),
    driftTiers: tiers,
  };
}

// ---------------------------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------------------------
const TARGETS = {
  p50Latency: 100,
  p95Latency: 250,
  maxDrift: 500,
  clockPrecision: 10,
};

function printScenario(s) {
  const header = ['Metric (ms)', 'Min', 'Avg', 'p50', 'p90', 'p95', 'p99', 'Max', 'Samples'];
  const row = (label, st) => [label, fmt(st.min), fmt(st.avg), fmt(st.p50), fmt(st.p90), fmt(st.p95), fmt(st.p99), fmt(st.max), st.n];
  printTable(
    `▶ ${s.participants} participants (1 host + ${s.participants - 1} viewers) · room ${s.roomCode} · connect+join ${fmt(s.connectMs, 0)} ms`,
    header,
    [
      row('Clock-sync RTT', s.rtt),
      row('Control propagation latency', s.controlLatency),
      row('Playback drift |M_exp − M_host|', s.drift),
      row('  (naive drift, no anchor comp.)', s.naiveDrift),
      row('Clock offset error |θ̂ − θ|', s.clockError),
    ]
  );
  const delivery = s.broadcastsExpected ? (100 * s.broadcastsReceived) / s.broadcastsExpected : 0;
  console.log(
    `  events: ${s.eventsEmitted} emitted, ${s.controlErrors} rejected · broadcasts delivered: ${s.broadcastsReceived}/${s.broadcastsExpected} (${fmt(delivery, 1)}%)`
  );
  console.log(
    `  drift tiers → aligned (<100 ms): ${s.driftTiers.aligned} · rate nudge (100–500 ms): ${s.driftTiers.rate} · hard seek (>500 ms): ${s.driftTiers.hardSeek}`
  );
}

function verdicts(s) {
  return [
    ['p50 control latency', `< ${TARGETS.p50Latency} ms`, s.controlLatency.p50, s.controlLatency.p50 < TARGETS.p50Latency],
    ['p95 control latency', `< ${TARGETS.p95Latency} ms`, s.controlLatency.p95, s.controlLatency.p95 < TARGETS.p95Latency],
    ['Max playback drift', `< ${TARGETS.maxDrift} ms`, s.drift.max, s.drift.max < TARGETS.maxDrift],
    ['Clock sync precision (p95)', `± ${TARGETS.clockPrecision} ms`, s.clockError.p95, s.clockError.p95 < TARGETS.clockPrecision],
    ['Broadcast delivery', '100 %', (100 * s.broadcastsReceived) / (s.broadcastsExpected || 1), s.broadcastsReceived === s.broadcastsExpected],
  ];
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));

  try {
    const health = await (await fetch(`${opts.url}/health`)).json();
    console.log(`Sync server ${opts.url} — redis: ${health.redis}`);
    opts.storage = health.redis;
  } catch {
    console.error(`✖ Cannot reach ${opts.url}. Start the server first:  cd server && npm run dev`);
    process.exit(1);
  }
  opts.clientUrl = opts.url;
  let proxy = null;
  if (opts.latency > 0 || opts.jitter > 0) {
    const target = new URL(opts.url);
    proxy = await startLatencyProxy({
      // the server binds IPv4 (0.0.0.0); avoid 'localhost' resolving to ::1
      targetHost: target.hostname === 'localhost' ? '127.0.0.1' : target.hostname,
      targetPort: Number(target.port || 80),
      latency: opts.latency,
      jitter: opts.jitter,
    });
    opts.clientUrl = `http://127.0.0.1:${proxy.port}`;
    console.log(`Network emulation: +${opts.latency} ms ± ${opts.jitter} ms one-way (both directions) via proxy :${proxy.port}`);
  }
  console.log(
    `Scenarios: ${opts.clients.join(', ')} participants · ${opts.rounds} control actions every ${opts.interval} ms · ` +
      `${opts.syncSamples} SYNC_CLOCK samples/client · simulated clock skew ±${opts.skew} ms`
  );

  const results = [];
  for (const n of opts.clients) {
    const s = await runScenario(n, opts);
    results.push(s);
    printScenario(s);
  }

  // Summary against the assignment targets
  const header = ['Metric', 'Target', ...results.map((s) => `${s.participants} users`), 'Status'];
  const rows = verdicts(results[0]).map((_, i) => {
    const perScenario = results.map((s) => verdicts(s)[i]);
    const unit = i === 4 ? '%' : ' ms';
    return [
      perScenario[0][0],
      perScenario[0][1],
      ...perScenario.map((v) => `${fmt(v[2], i === 4 ? 1 : 2)}${unit}`),
      perScenario.every((v) => v[3]) ? 'PASSED' : 'FAILED',
    ];
  });
  printTable('■ Summary vs targets', header, rows);

  if (opts.json) {
    fs.writeFileSync(opts.json, JSON.stringify({ generatedAt: new Date().toISOString(), options: opts, results }, null, 2));
    console.log(`\nRaw results written to ${opts.json}`);
  }

  if (proxy) await proxy.close();
  const allPassed = rows.every((r) => r[r.length - 1] === 'PASSED');
  process.exit(allPassed ? 0 : 1);
}

main().catch((err) => {
  console.error('✖ Load test failed:', err.message);
  process.exit(1);
});
