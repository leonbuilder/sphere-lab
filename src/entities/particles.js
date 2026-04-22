/**
 * Transient FX pool — sparks, smoke, expanding rings, material-specific
 * impact debris (sparkle, chip, dust), and shatter shards.
 *
 * Integration + culling is in `physics/step.js`; this file owns the shared
 * array + spawn helpers.
 */

import { TAU, rand } from '../core/math.js';

/**
 * @typedef {Object} Particle
 * @property {number} x @property {number} y
 * @property {number} vx @property {number} vy
 * @property {number} life
 * @property {number} maxLife
 * @property {string} color
 * @property {number} size
 * @property {'spark'|'smoke'|'ring'|'sparkle'|'chip'|'dust'|'shard'} type
 * @property {number} [ringR0]
 * @property {number} [ringR1]
 * @property {number} [rot]      — shard orientation
 * @property {number} [rotV]     — shard angular velocity
 */

/** @type {Particle[]} */
export const particles = [];

/** Generic normal-direction spark burst. Used for steel impacts + as the
 *  default if a material has no dedicated FX. */
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

/** Glass impact — tiny reflective specks that fade quickly. */
export function spawnSparkle(x, y, nx, ny, magnitude, color = '#ccf0ff') {
  const n = Math.min(14, Math.floor(magnitude * 0.04));
  for (let i = 0; i < n; i++) {
    const a = Math.atan2(ny, nx) + rand(-1.1, 1.1);
    const sp = rand(90, 260);
    particles.push({
      x, y,
      vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
      life: rand(0.18, 0.45), maxLife: 0.45,
      color,
      size: rand(0.8, 1.8),
      type: 'sparkle'
    });
  }
}

/** Ice impact — small chips flinging outward with gravity + longer life. */
export function spawnChip(x, y, nx, ny, magnitude, color = '#d0ebff') {
  const n = Math.min(10, 2 + Math.floor(magnitude * 0.02));
  for (let i = 0; i < n; i++) {
    const a = Math.atan2(ny, nx) + rand(-0.9, 0.9);
    const sp = rand(60, 220);
    particles.push({
      x, y,
      vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60,
      life: rand(0.6, 1.3), maxLife: 1.3,
      color,
      size: rand(1.2, 2.6),
      type: 'chip'
    });
  }
}

/** Bowling / matte impact — low dust puff. */
export function spawnDust(x, y, magnitude, color = '#a08670') {
  const n = Math.min(8, Math.floor(magnitude * 0.015));
  for (let i = 0; i < n; i++) {
    const a = rand(0, TAU);
    const sp = rand(20, 70);
    particles.push({
      x: x + rand(-4, 4), y: y + rand(-2, 2),
      vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 30,
      life: rand(0.7, 1.2), maxLife: 1.2,
      color,
      size: rand(3, 7),
      type: 'dust'
    });
  }
}

/** Bigger, slower chunk fling used by fracture. Looks like sharded glass/ice.
 *  `jagged = true` renders as a long angular spike instead of a small
 *  triangle — used for obsidian's brittle volcanic-glass cleave. */
export function spawnShard(x, y, vx, vy, color, jagged = false) {
  particles.push({
    x, y,
    vx: vx + rand(-40, 40), vy: vy + rand(-60, 20),
    life: rand(0.8, 1.4), maxLife: 1.4,
    color,
    size: jagged ? rand(3.5, 6.5) : rand(2.5, 4.5),
    type: 'shard',
    rot: rand(0, TAU),
    rotV: rand(-12, 12),
    jagged
  });
}
