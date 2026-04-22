/**
 * World + camera state. Reset by `clearWorld()` whenever a scene loads.
 *
 * `W` holds scene geometry and ambient modes (vortex, solar, water). Scenes
 * mutate it directly during build; the solver + renderer read it.
 *
 * `cam` holds current {x, y, zoom} and target {tx, ty, tz}. The main loop
 * smooths current toward target every frame.
 */

import { balls } from '../entities/ball.js';
import { particles } from '../entities/particles.js';
import { PHYS } from './config.js';

/**
 * @typedef {Object} Wall
 * @property {number} x1 @property {number} y1 @property {number} x2 @property {number} y2
 * @property {boolean} [bouncy]   — wall gets 1.4× restitution + pink render
 * @property {boolean} [flipper]  — visual only, orange render
 */

/**
 * @typedef {Object} Peg
 * @property {number} x  @property {number} y  @property {number} r
 * @property {boolean} [bumper]  — pinball-style: 1.8× restitution + extra kick
 */

/**
 * @typedef {Object} Constraint
 * Inextensible-length tether from ball `a` to fixed anchor (ax, ay).
 * @property {import('../entities/ball.js').Ball} a
 * @property {number} ax @property {number} ay @property {number} len
 */

/** Single source of truth for scene state. */
export const W = {
  cw: 0, ch: 0,
  /** @type {Wall[]} */        walls: [],
  /** @type {Peg[]} */         pegs: [],
  /** @type {Constraint[]} */  constraints: [],
  /** @type {import('../entities/spring.js').Spring[]} */ springs: [],
  flippers: [], bumpers: [],
  scene: 'sandbox',
  bgColor1: '#0b1324', bgColor2: '#02040b',
  rainSpawn: false,
  vortexX: 0, vortexY: 0,
  solar: false,
  /** @type {number | undefined} — y of the water surface (undefined = no water). */
  waterY: undefined
};

export const cam = { x: 0, y: 0, zoom: 1, tx: 0, ty: 0, tz: 1 };

/** Convert CSS-pixel screen coords to world coords using the current camera. */
export function screenToWorld(sx, sy) {
  return {
    x: (sx - W.cw / 2) / cam.zoom + cam.x,
    y: (sy - W.ch / 2) / cam.zoom + cam.y
  };
}

/** Push 4 wall segments forming an axis-aligned rectangle (clockwise). */
export function addBox(x, y, w, h) {
  W.walls.push(
    { x1: x,     y1: y,     x2: x + w, y2: y     },
    { x1: x + w, y1: y,     x2: x + w, y2: y + h },
    { x1: x + w, y1: y + h, x2: x,     y2: y + h },
    { x1: x,     y1: y + h, x2: x,     y2: y     }
  );
}

/**
 * Reset everything scene-scoped. Pools are cleared via `length = 0` to preserve
 * array identity — other modules hold the same reference.
 */
export function clearWorld() {
  balls.length = 0;
  W.walls.length = 0;
  W.pegs.length = 0;
  W.constraints.length = 0;
  W.springs.length = 0;
  W.flippers.length = 0;
  W.bumpers.length = 0;
  particles.length = 0;
  W.solar = false;
  W.waterY = undefined;
}

/**
 * Flip gravity on/off and optionally set its magnitude. Also updates the HUD
 * button label + slider so the UI stays in sync when a scene forces gravity.
 */
export function setGravityUI(on, g) {
  PHYS.gravityOn = on;
  if (typeof g === 'number') {
    PHYS.gravity = g;
    const s = document.getElementById('s-g');
    if (s) { s.value = g; document.getElementById('v-g').textContent = g; }
  }
  const b = document.getElementById('btn-gravity');
  if (b) {
    b.textContent = on ? 'GRAVITY ON [G]' : 'GRAVITY OFF [G]';
    b.classList.toggle('active', !on);
  }
}
