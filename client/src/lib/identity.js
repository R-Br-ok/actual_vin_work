'use client';

const STORAGE_KEY = 'frame_username';

function randomGuestName() {
  return `Guest-${Math.floor(1000 + Math.random() * 9000)}`;
}

/** Display name for this browser. Storage can be unavailable (private mode) — never throw. */
export function getStoredUsername() {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored && stored.trim()) return stored.trim().slice(0, 32);
  } catch {}
  return '';
}

export function setStoredUsername(name) {
  const clean = (name || '').trim().slice(0, 32);
  try {
    if (clean) window.localStorage.setItem(STORAGE_KEY, clean);
  } catch {}
  return clean;
}

export function getOrCreateUsername() {
  const existing = getStoredUsername();
  if (existing) return existing;
  return setStoredUsername(randomGuestName()) || randomGuestName();
}
