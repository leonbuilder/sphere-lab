/**
 * Fracture — a fragile ball hit hard enough breaks apart into smaller
 * fragment balls (which collide but don't recursively shatter) plus a
 * shower of shard particles and a shatter sound.
 *
 * Velocity threshold is per-material. Glass is stiffer (harder to break),
 * ice is brittle (breaks on moderate impacts).
 */

import { TAU, rand } from '../core/math.js';
import { balls, Ball } from '../entities/ball.js';
import { spawnShard } from '../entities/particles.js';
import { Snd } from '../audio/sound.js';

/** Threshold normal-velocity (px/s) for fracture, by material name. */
const FRACTURE_V = {
  GLASS: 550,
  ICE:   380
};

/**
 * If `b` is fragile and was hit at > threshold, break it and return true.
 * The caller must stop processing the collision (the ball no longer exists).
 *
 * @param {import('../entities/ball.js').Ball} b
 * @param {number} impactV — normal-component speed at contact (px/s)
 * @returns {boolean} true if fractured
 */
export function tryFracture(b, impactV) {
  if (!b.mat.fragile || b.isFragment) return false;
  const threshold = FRACTURE_V[b.mat.name] ?? 500;
  if (impactV < threshold) return false;
  shatter(b);
  return true;
}

function shatter(b) {
  // 6–9 fragment balls, each 25–45% of the original radius
  const count = 6 + Math.floor(Math.random() * 4);
  // energy (approx) stays flat: total new mass ≈ original mass; velocity spreads
  const spread = 140 + Math.random() * 120;
  const baseAngle = Math.atan2(b.vy, b.vx);

  for (let i = 0; i < count; i++) {
    const a = baseAngle + (i / count) * TAU + rand(-0.4, 0.4);
    const fr = b.r * (0.28 + Math.random() * 0.18);
    const frag = new Ball(
      b.x + Math.cos(a) * b.r * 0.3,
      b.y + Math.sin(a) * b.r * 0.3,
      fr,
      b.mat
    );
    frag.vx = b.vx + Math.cos(a) * spread;
    frag.vy = b.vy + Math.sin(a) * spread;
    frag.omega = rand(-18, 18);
    frag.lifespan = 2.8 + Math.random() * 0.9;
    frag.isFragment = true;
    balls.push(frag);
  }

  // 10 decorative shard particles — more visual density without more physics
  for (let i = 0; i < 10; i++) {
    const a = Math.random() * TAU;
    const sp = rand(120, 420);
    spawnShard(
      b.x, b.y,
      b.vx * 0.4 + Math.cos(a) * sp,
      b.vy * 0.4 + Math.sin(a) * sp,
      b.mat.color
    );
  }

  Snd.shatter(b);

  // remove the original
  const idx = balls.indexOf(b);
  if (idx >= 0) balls.splice(idx, 1);
}
