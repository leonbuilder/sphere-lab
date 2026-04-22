/**
 * Impact-time material modifiers — velocity-dependent restitution and
 * temperature-dependent elasticity/friction. Keeps `collisions.js` focused
 * on vector math.
 */

import { PHYS } from '../core/config.js';
import { clamp } from '../core/math.js';

/**
 * Restitution falls smoothly with impact speed. Real materials plasticize at
 * high speed; the curve goes from 1 (gentle) toward 0.35 (violent).
 * Shape: `0.35 + 0.65 / (1 + v² · k)`  with k chosen for feel, not realism.
 */
export function velRestScale(vMag) {
  return 0.35 + 0.65 / (1 + vMag * vMag * 0.0000015);
}

/**
 * Per-ball elasticity modifier from heat. Different materials respond
 * differently to being hot:
 *   rubber → mushy (harder to bounce)
 *   ice    → melts, almost dead bounce
 *   steel  → plasticizes
 *   plasma → more bouncy (dramatic, not physical)
 */
export function heatRestMod(b) {
  if (!PHYS.heatFx) return 1;
  const h = b.heat;
  if (h < 0.1) return 1;
  const n = b.mat.name;
  if (n === 'RUBBER') return clamp(1 - (h - 0.1) * 0.9, 0.25, 1);
  if (n === 'ICE')    return clamp(1 - (h - 0.1) * 1.8, 0.1,  1);
  if (n === 'STEEL')  return clamp(1 - (h - 0.3) * 0.6, 0.4,  1);
  if (n === 'PLASMA') return 1 + (h * 0.2);
  return 1 - h * 0.15;
}

/** Friction goes up with heat on rubber + ice (both get sticky). */
export function heatFricMod(b) {
  if (!PHYS.heatFx) return 1;
  if (b.mat.name === 'RUBBER') return 1 + b.heat * 0.5;
  if (b.mat.name === 'ICE')    return 1 + b.heat * 0.8;
  return 1 + b.heat * 0.2;
}

/**
 * Combine two friction coefficients. Geometric mean is a closer match to
 * real behaviour than an arithmetic average — a low-friction surface tends
 * to dominate the pair.
 */
export function combineFriction(muA, muB) { return Math.sqrt(muA * muB); }

/** Inverse mass, with pinned balls returning 0 so impulses don't move them. */
export function invMass(b) { return b.pinned ? 0 : 1 / b.mass; }
