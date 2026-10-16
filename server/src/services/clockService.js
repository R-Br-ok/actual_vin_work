/**
 * Clock Service
 * High-precision timestamp utilities for NTP synchronization.
 */

export function getServerTimestamp() {
  return Date.now();
}

/**
 * Returns high-resolution time in milliseconds.
 */
export function getHighResTimestamp() {
  const [seconds, nanoseconds] = process.hrtime();
  return seconds * 1000 + nanoseconds / 1e6;
}
