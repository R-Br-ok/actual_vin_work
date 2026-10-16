/**
 * Tiny in-process TCP proxy that adds one-way latency + Gaussian jitter in BOTH directions,
 * so the load test can emulate WAN conditions on a single machine (no root / tc netem needed).
 *
 * Ordering is preserved: a chunk is never released before the previous chunk on the same
 * direction (TCP semantics), so jitter shows up as delay variance, not reordering.
 */
import net from 'node:net';

function gaussian() {
  // Box–Muller
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function sampleDelay(latency, jitter) {
  if (!jitter) return latency;
  const d = latency + gaussian() * jitter;
  return Math.max(0, Math.min(latency + 3 * jitter, Math.max(latency - 3 * jitter, d)));
}

function delayedPipe(from, to, latency, jitter) {
  // Strict FIFO per direction: one drain timer releases chunks in arrival order.
  // (Separate setTimeouts per chunk can fire out of order when their durations differ.)
  const queue = [];
  let timer = null;
  let lastRelease = 0;
  let ended = false;

  const drain = () => {
    timer = null;
    const now = Date.now();
    while (queue.length && queue[0].release <= now) {
      const { chunk } = queue.shift();
      if (!to.destroyed) to.write(chunk);
    }
    if (queue.length) schedule();
    else if (ended && !to.destroyed) to.end();
  };

  const schedule = () => {
    if (timer || !queue.length) return;
    timer = setTimeout(drain, Math.max(0, queue[0].release - Date.now()));
  };

  from.on('data', (chunk) => {
    const release = Math.max(lastRelease, Date.now() + sampleDelay(latency, jitter));
    lastRelease = release;
    queue.push({ release, chunk });
    schedule();
  });
  from.on('end', () => {
    ended = true;
    if (!queue.length && !timer && !to.destroyed) to.end();
  });
  from.on('error', () => to.destroy());
  from.on('close', () => setTimeout(() => to.destroy(), Math.max(0, lastRelease - Date.now()) + 5));
}

/**
 * @returns {Promise<{ port: number, close: () => Promise<void> }>}
 */
export function startLatencyProxy({ targetHost, targetPort, latency = 40, jitter = 10 }) {
  const sockets = new Set();
  const server = net.createServer((client) => {
    client.setNoDelay(true);
    const upstream = net.connect({ host: targetHost, port: targetPort });
    upstream.setNoDelay(true);
    sockets.add(client);
    sockets.add(upstream);
    client.on('close', () => sockets.delete(client));
    upstream.on('close', () => sockets.delete(upstream));
    delayedPipe(client, upstream, latency, jitter);
    delayedPipe(upstream, client, latency, jitter);
  });

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      resolve({
        port: server.address().port,
        close: () =>
          new Promise((done) => {
            sockets.forEach((s) => s.destroy());
            server.close(() => done());
          }),
      });
    });
  });
}
