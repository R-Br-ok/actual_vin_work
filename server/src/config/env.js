import dotenv from 'dotenv';
dotenv.config();

export const ENV = {
  HOST: process.env.HOST || '0.0.0.0',
  PORT: parseInt(process.env.PORT || '5000', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',
  REDIS_HOST: process.env.REDIS_HOST || '127.0.0.1',
  REDIS_PORT: parseInt(process.env.REDIS_PORT || '6379', 10),
  REDIS_PASSWORD: process.env.REDIS_PASSWORD || undefined,
  CORS_ORIGIN: process.env.CORS_ORIGIN || '*',
  ROOM_CODE_LENGTH: parseInt(process.env.ROOM_CODE_LENGTH || '6', 10),
  ROOM_EXPIRY_SECONDS: parseInt(process.env.ROOM_EXPIRY_SECONDS || '86400', 10), // 24 hours
};

/**
 * CORS origin option shared by Express and Socket.io.
 * '*' is reflected as `true` so credentialed requests from LAN devices are still accepted.
 */
export function resolveCorsOrigin() {
  if (!ENV.CORS_ORIGIN || ENV.CORS_ORIGIN === '*') return true;
  return ENV.CORS_ORIGIN.split(',').map((o) => o.trim()).filter(Boolean);
}
