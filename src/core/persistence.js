/**
 * localStorage-backed persistence for user preferences.
 *
 * Stored as a single JSON blob under one key to avoid quota pressure. Only
 * primitive toggles + selection ids — nothing simulation-state is persisted,
 * because those can't cleanly survive a reload.
 *
 * Use `loadPrefs()` once at boot, then `savePref(key, value)` whenever the
 * user changes a preference.
 */

const KEY = 'sphere-lab:prefs';

/** @type {Record<string, any>} */
let prefs = {};

export function loadPrefs() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) prefs = JSON.parse(raw) || {};
  } catch {
    prefs = {};
  }
  return prefs;
}

export function savePref(key, value) {
  prefs[key] = value;
  try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch { /* quota / private mode */ }
}

export function getPref(key, fallback) {
  return key in prefs ? prefs[key] : fallback;
}
