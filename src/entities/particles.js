/**
 * Transient visual effect pool — sparks + smoke + heat shimmer.
 *
 * Integration and culling happen inside `physics/step.js` (they move with the
 * sim, not the framerate). This module owns the shared array + spawn helpers.
 * The pool is untyped for speed; use `type` to discriminate in consumers.
 */

import { rand } from '../core/math.js';

/**
 * @typedef {Object} Particle
 * @property {number} x @property {number} y
 * @property {number} vx @property {number} vy
 * @property {number} life     — seconds remaining, decremented by step.js
 * @property {number} maxLife  — original life; used for alpha fade
 * @property {string} color    — hex string, may include 2-digit alpha suffix
 * @property {number} size
 * @property {'spark'|'smoke'} type
 */

/** @type {Particle[]} */
export const particles = [];

/** Collision spark burst at (x,y) along normal (nx,ny). Magnitude scales count + spread. */
export function spawnImpact(x, y, nx, ny, magnitude, color) {
  const n = Math.min(18, Math.floor(magnitude * 0.03));
  for (let i = 0; i < n; i++) {
    const a = Math.atan2(ny, nx) + rand(-0.85, 0.85);
    const sp = rand(80, 340) * Math.min(1, magnitude * 0.003);
    particles.push({
      x, y,
      vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
      life: rand(0.25, 0.7), maxLife: 0.7,
      color: color || '#ffffff',
      size: rand(1, 3.2),
      type: 'spark'
    });
  }
}

/** Drifting smoke puff, used by explode() and can be reused by scenes. */
export function spawnSmoke(x, y, vx, vy, color, life = 0.9) {
  particles.push({
    x, y,
    vx: vx * 0.3 + rand(-15, 15), vy: vy * 0.3 + rand(-15, 15) - 20,
    life, maxLife: life,
    color,
    size: rand(4, 10),
    type: 'smoke'
  });
}

/** Faint orange shimmer above heated balls. Stochastic (probability = heat·0.4). */
export function spawnHeatShimmer(x, y, heat) {
  if (Math.random() > heat * 0.4) return;
  particles.push({
    x: x + rand(-10, 10), y,
    vx: rand(-20, 20), vy: -rand(40, 110),
    life: 0.8, maxLife: 0.8,
    color: '#ff804044',
    size: rand(3, 6),
    type: 'smoke'
  });
}
