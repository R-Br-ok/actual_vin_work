'use client';

/**
 * Display-name identity.
 *
 * Why two storages: localStorage is shared by EVERY tab of a browser, so a random name kept
 * there made all tabs (host + "viewers" opened side by side) show up with the same name.
 *
 *  - sessionStorage  `frame_tab_username`   → this tab's name. Survives refresh, but each tab /
 *                                              window / incognito session gets its own.
 *  - localStorage    `frame_display_name`   → a name the person TYPED on the home page; used as
 *                                              the default for new tabs in this browser.
 *
 * The server additionally de-duplicates names inside a room ("Priya" → "Priya 2").
 */

const TAB_KEY = 'frame_tab_username';
const PREFERRED_KEY = 'frame_display_name';
const LEGACY_KEY = 'frame_username'; // older builds stored an auto-generated Guest-#### here

const ADJECTIVES = ['Cyber', 'Neon', 'Pixel', 'Cosmic', 'Retro', 'Velvet', 'Midnight', 'Lunar', 'Turbo', 'Silent', 'Golden', 'Indie'];
const NOUNS = ['Viewer', 'Critic', 'Popcorn', 'Reel', 'Frame', 'Usher', 'Director', 'Fan', 'Owl', 'Lens', 'Extra', 'Cameo'];

function randomInt(max) {
  try {
    const buf = new Uint32Array(1);
    window.crypto.getRandomValues(buf);
    return buf[0] % max;
  } catch {
    return Math.floor(Math.random() * max);
  }
}

/** e.g. "Cyber_Viewer_89" or "User_4821". */
export function generateRandomUsername() {
  if (randomInt(3) === 0) return `User_${1000 + randomInt(9000)}`;
  return `${ADJECTIVES[randomInt(ADJECTIVES.length)]}_${NOUNS[randomInt(NOUNS.length)]}_${10 + randomInt(90)}`;
}

function safeGet(storage, key) {
  try {
    const value = window[storage].getItem(key);
    return value && value.trim() ? value.trim().slice(0, 32) : '';
  } catch {
    return '';
  }
}

function safeSet(storage, key, value) {
  try {
    window[storage].setItem(key, value);
  } catch {}
}

function migrateLegacy() {
  try {
    const legacy = window.localStorage.getItem(LEGACY_KEY);
    if (legacy === null) return;
    // Auto-generated legacy names were the duplicate-name bug — drop them. Keep typed ones.
    if (!/^Guest-\d{4}$/.test(legacy.trim()) && !safeGet('localStorage', PREFERRED_KEY)) {
      safeSet('localStorage', PREFERRED_KEY, legacy.trim().slice(0, 32));
    }
    window.localStorage.removeItem(LEGACY_KEY);
  } catch {}
}

/** The name the person typed on the home page (if any). */
export function getStoredUsername() {
  migrateLegacy();
  return safeGet('localStorage', PREFERRED_KEY);
}

/** Saves a typed name for this browser and applies it to the current tab. */
export function setStoredUsername(name) {
  const clean = (name || '').trim().slice(0, 32);
  if (clean) {
    safeSet('localStorage', PREFERRED_KEY, clean);
    safeSet('sessionStorage', TAB_KEY, clean);
  }
  return clean;
}

/** This tab's name: stable across refreshes, unique per tab unless the person chose one. */
export function getOrCreateUsername() {
  const tabName = safeGet('sessionStorage', TAB_KEY);
  if (tabName) return tabName;
  const name = getStoredUsername() || generateRandomUsername();
  safeSet('sessionStorage', TAB_KEY, name);
  return name;
}
