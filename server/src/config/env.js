import dotenv from 'dotenv';
dotenv.config();

export const ENV = {
  PORT: parseInt(process.env.PORT || '5000', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',
  REDIS_HOST: process.env.REDIS_HOST || '127.0.0.1',
  REDIS_PORT: parseInt(process.env.REDIS_PORT || '6379', 10),
  REDIS_PASSWORD: process.env.REDIS_PASSWORD || undefined,
  CORS_ORIGIN: process.env.CORS_ORIGIN || '*',
  ROOM_CODE_LENGTH: parseInt(process.env.ROOM_CODE_LENGTH || '6', 10),
  ROOM_EXPIRY_SECONDS: parseInt(process.env.ROOM_EXPIRY_SECONDS || '86400', 10), // 24 hours
};
