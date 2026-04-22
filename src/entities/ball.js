/**
 * Ball entity — the principal simulation object.
 *
 * Mass scales with area (r²) and material density. Moment of inertia uses
 * the solid-disk formula I = ½ m r². Rendering reads `squash`/`squashAng`
 * (impulsive deformation) and `heat` (glow + color shift).
 */

import { TAU, rand } from '../core/math.js';
import { mix } from '../core/color.js';
import { PHYS } from '../core/config.js';
import { MATERIALS } from './materials.js';

let BID = 0;

/**
 * @typedef {Object} TrailPoint
 * @property {number} x @property {number} y
 */

export class Ball {
  /**
   * @param {number} x
   * @param {number} y
   * @param {number} r  radius in world units (px)
   * @param {import('./materials.js').Material} mat
   */
  constructor(x, y, r, mat) {
    this.id = ++BID;
    this.x = x; this.y = y;
    /** previous-frame position — used by buoyancy splash detection */
    this.px = x; this.py = y;
    this.vx = 0; this.vy = 0;
    this.r = r;
    this.mat = mat;
    this.mass = r * r * mat.density * 0.001;
    this.inertia = 0.5 * this.mass * r * r;
    this.angle = rand(0, TAU);
    this.omega = 0;
    this.grabbed = false;
    this.pinned = false;
    this.life = 0;
    /** Squash factor: 1 = round, <1 = compressed along `squashAng`. */
    this.squash = 1;
    this.squashAng = 0;
    this.trailT = 0;
    /** @type {TrailPoint[]} */ this.trail = [];
    /** 0..1 temperature; decays by 0.996× per step. */
    this.heat = 0;
    /** -1..1 electrostatic charge (weak Coulomb interaction in collisions). */
    this.charge = 0;
    this.sparkT = 0;
  }

  /** ½ m v² + ½ I ω² */
  kineticEnergy() {
    return 0.5 * this.mass * (this.vx * this.vx + this.vy * this.vy)
         + 0.5 * this.inertia * this.omega * this.omega;
  }

  /** Render-time color, shifted toward orange/red with heat. */
  effectiveColor() {
    let c = this.mat.color;
    if (PHYS.heatFx && this.heat > 0.05) c = mix(c, '#ffc040', Math.min(1, this.heat));
    if (this.heat > 0.5) c = mix(c, '#ff4020', (this.heat - 0.5) * 2);
    return c;
  }
}

/** Global ball pool. Mutated by scenes, the solver, and input handlers. */
/** @type {Ball[]} */
export const balls = [];

/**
 * Currently-selected spawn material, as a key into MATERIALS. Mutated by the
 * sidebar palette and the 1..9 hotkeys. Held in a single-element object so
 * other modules can read `selectedMat.id` without stale bindings.
 */
export const selectedMat = { id: /** @type {import('./materials.js').MaterialId} */ ('rubber') };

/** Capped spawn to keep the O(n²)-ish AO + solver tractable. */
export function spawnBall(x, y) {
  if (balls.length > 260) return null;
  const mat = MATERIALS[selectedMat.id];
  const b = new Ball(x, y, PHYS.spawnRadius, mat);
  b.vx = rand(-30, 30); b.vy = rand(-30, 30);
  b.omega = rand(-2, 2);
  balls.push(b);
  return b;
}
