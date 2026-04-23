/**
 * Save / load / screenshot.
 *
 * Save: writes the current scene name + all ball state (positions, velocities,
 * material, pin, heat) to localStorage. Walls/pegs/flippers come from the scene
 * rebuild on load — we don't try to serialize every geometric primitive.
 *
 * Load: re-runs the saved scene, then clears and re-populates the ball pool.
 *
 * Screenshot: renders the canvas to a PNG blob and triggers a download.
 */

import { W } from '../core/world.js';
import { balls, Ball } from '../entities/ball.js';
import { MATERIALS } from '../entities/materials.js';
import { loadScene } from '../scenes/index.js';
import { canvas } from '../render/canvas.js';

const KEY = 'sphere-lab:snapshot';

export function saveState() {
  const payload = {
    scene: W.scene,
    // Skip in-flight fragments — if we saved them their lifespan field
    // would survive but they'd never cull cleanly after load, leaving
    // ghost fragments stuck in mid-shatter state. Just drop them.
    balls: balls.filter(b => !b.isFragment).map(b => ({
      x: b.x, y: b.y, vx: b.vx, vy: b.vy,
      r: b.r, mat: matKeyOf(b.mat),
      pinned: b.pinned, heat: b.heat,
      angle: b.angle, omega: b.omega,
      polarity: b.polarity
    }))
  };
  try {
    localStorage.setItem(KEY, JSON.stringify(payload));
    flashButton('btn-save', 'Saved');
  } catch {
    flashButton('btn-save', 'Failed');
  }
}

export function loadState() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) { flashButton('btn-load', 'Empty'); return; }
    const payload = JSON.parse(raw);
    loadScene(payload.scene || 'sandbox');
    // Clear the scene's starting balls *and* the springs / constraints
    // that reference them. Otherwise cradle / cloth / jelly / chaos
    // springs hold dead Ball references and the solver pulls on phantoms.
    balls.length = 0;
    W.springs.length = 0;
    W.constraints.length = 0;
    for (const s of payload.balls || []) {
      // Guard against corrupted or prototype-poisoned keys
      const mat = (Object.prototype.hasOwnProperty.call(MATERIALS, s.mat) && MATERIALS[s.mat]) || MATERIALS.rubber;
      const b = new Ball(s.x, s.y, s.r, mat);
      b.vx = s.vx; b.vy = s.vy;
      b.pinned = !!s.pinned;
      b.heat = s.heat || 0;
      b.angle = s.angle || 0;
      b.omega = s.omega || 0;
      if (typeof s.polarity === 'number') b.polarity = s.polarity;
      balls.push(b);
    }
    flashButton('btn-load', 'Restored');
  } catch {
    flashButton('btn-load', 'Failed');
  }
}

/** Render the canvas to a PNG and trigger a download. */
export function screenshot() {
  canvas.toBlob(blob => {
    if (!blob) { flashButton('btn-snapshot', 'Failed'); return; }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sphere-lab-${timestamp()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    flashButton('btn-snapshot', 'Saved');
  }, 'image/png');
}

function matKeyOf(m) {
  for (const k of Object.keys(MATERIALS)) if (MATERIALS[k] === m) return k;
  return 'rubber';
}

function timestamp() {
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

/** Brief "Saved / Loaded / Failed" feedback on the button's label span. */
function flashButton(id, text) {
  const b = document.getElementById(id);
  if (!b) return;
  const span = b.querySelector('span:not(.kbd)');
  if (!span) return;
  const prev = span.textContent;
  span.textContent = text;
  b.classList.add('active');
  setTimeout(() => {
    span.textContent = prev;
    b.classList.remove('active');
  }, 900);
}
