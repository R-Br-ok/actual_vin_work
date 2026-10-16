import Redis from 'ioredis';
import RedisMock from 'ioredis-mock';
import { ENV } from './env.js';

let isFallback = true;
let inMemoryStore = new RedisMock();
let activeClient = inMemoryStore;

/**
 * Proxy delegating all Redis commands to the active client (real Redis or In-Memory mock).
 */
export const redis = new Proxy({}, {
  get(target, prop) {
    if (prop === 'isInMemory') {
      return isFallback;
    }
    const value = activeClient[prop];
    if (typeof value === 'function') {
      return value.bind(activeClient);
    }
    return value;
  },
});

/**
 * Connects to Redis with a 1.5s timeout.
 * Automatically falls back to the In-Memory engine on failure.
 */
export async function connectRedis() {
  const realClient = new Redis({
    host: ENV.REDIS_HOST,
    port: ENV.REDIS_PORT,
    password: ENV.REDIS_PASSWORD,
    connectTimeout: 1500,
    maxRetriesPerRequest: 1,
    retryStrategy: () => null,
    lazyConnect: true,
  });

  // Suppress unhandled connection error events while probing
  realClient.on('error', () => {});

  try {
    const connectPromise = realClient.connect().then(() => realClient.ping());
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Connection timeout (1.5s)')), 1500)
    );

    await Promise.race([connectPromise, timeoutPromise]);

    // Success: Promote real client
    activeClient = realClient;
    isFallback = false;

    realClient.on('error', (err) => {
      console.error('[Redis] Connection Error:', err.message);
    });

    console.log(`[Redis] Connected to ${ENV.REDIS_HOST}:${ENV.REDIS_PORT}`);
    return true;
  } catch {
    // Failure: Fall back to In-Memory store
    try {
      realClient.disconnect();
    } catch {}

    activeClient = inMemoryStore;
    isFallback = true;

    console.warn('⚠️ Redis connection failed. Falling back to In-Memory store for local development.');
    return false;
  }
}
