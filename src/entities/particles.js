/**
 * Transient FX pool — sparks + smoke + heat shimmer + impact rings.
 * Integration + culling is in `physics/step.js`; this file just owns the
 * shared array + spawn helpers.
 */

import { rand } from '../core/math.js';

/**
 * @typedef {Object} Particle
 * @property {number} x @property {number} y
 * @property {number} vx @property {number} vy
 * @property {number} life
 * @property {number} maxLife
 * @property {string} color
 * @property {number} size
 * @property {'spark'|'smoke'|'ring'} type
 * @property {number} [ringR0]   — starting radius (rings expand from this)
 * @property {number} [ringR1]   — terminal radius at life=0
 */

/** @type {Particle[]} */
export const particles = [];

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
  // on high-energy impacts, also drop an expanding ring
  if (magnitude > 80) {
    particles.push({
      x, y, vx: 0, vy: 0,
      life: 0.55, maxLife: 0.55,
      color: color || '#ffffff',
      size: 2,
      type: 'ring',
      ringR0: 4,
      ringR1: 10 + Math.min(60, magnitude * 0.25)
    });
  }
}

export function spawnSmoke(x, y, vx, vy, color, life = 0.9) {
  particles.push({
    x, y,
    vx: vx * 0.3 + rand(-15, 15), vy: vy * 0.3 + rand(-15, 15) - 20,
    life, maxLife: life,
    color, size: rand(4, 10), type: 'smoke'
  });
}

export function spawnHeatShimmer(x, y, heat) {
  if (Math.random() > heat * 0.4) return;
  particles.push({
    x: x + rand(-10, 10), y,
    vx: rand(-20, 20), vy: -rand(40, 110),
    life: 0.8, maxLife: 0.8,
    color: '#ff804044', size: rand(3, 6), type: 'smoke'
  });
}
