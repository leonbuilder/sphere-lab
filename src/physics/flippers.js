/**
 * Pinball flipper physics.
 *
 * A flipper is a line segment pivoting at (px, py). When `active` is true it
 * rotates toward `upAngle` with a stiff restoring spring; when released it
 * relaxes toward `restAngle`. Ball/flipper contact resolves like a ball/wall
 * collision but with an extra impulse proportional to the flipper's tangential
 * velocity at the contact point — i.e. a swung flipper kicks the ball.
 */

import { PHYS } from '../core/config.js';
import { W } from '../core/world.js';
import { clamp } from '../core/math.js';
import { spawnImpact } from '../entities/particles.js';
import { Snd } from '../audio/sound.js';
import { stats } from './stats.js';

/**
 * Create a flipper and push it into `W.flippers`.
 * @param {number} px  pivot x
 * @param {number} py  pivot y
 * @param {number} length
 * @param {number} side  -1 left, +1 right
 */
export function spawnFlipper(px, py, length, side) {
  const restAngle = side < 0 ?  Math.PI * 0.18 : Math.PI - Math.PI * 0.18;
  const upAngle   = side < 0 ? -Math.PI * 0.30 : Math.PI + Math.PI * 0.30;
  W.flippers.push({
    px, py, length,
    angle: restAngle,
    angVel: 0,
    restAngle, upAngle,
    side,
    active: false
  });
}

/** Integrate all flippers for one physics step. */
export function updateFlippers(dt) {
  for (const f of W.flippers) {
    const target = f.active ? f.upAngle : f.restAngle;
    // stiff critically-damped-ish spring toward the target angle
    const stiffness = 900;
    const damping = 45;
    const err = target - f.angle;
    f.angVel += err * stiffness * dt;
    f.angVel *= Math.max(0, 1 - damping * dt);
    // cap angular speed for stability
    f.angVel = clamp(f.angVel, -28, 28);
    f.angle += f.angVel * dt;
  }
}

/** Collide a ball with one flipper. */
export function collideFlipper(b, f) {
  const x1 = f.px;
  const y1 = f.py;
  const x2 = f.px + Math.cos(f.angle) * f.length;
  const y2 = f.py + Math.sin(f.angle) * f.length;
  const wx = x2 - x1, wy = y2 - y1;
  const wlen2 = wx * wx + wy * wy;

  let t = ((b.x - x1) * wx + (b.y - y1) * wy) / wlen2;
  t = clamp(t, 0, 1);
  const cx = x1 + wx * t;
  const cy = y1 + wy * t;
  const dx = b.x - cx;
  const dy = b.y - cy;
  const d2 = dx * dx + dy * dy;
  if (d2 >= b.r * b.r) return;
  const d = Math.sqrt(d2) || 0.0001;
  const nx = dx / d, ny = dy / d;

  // positional correction
  b.x = cx + nx * b.r;
  b.y = cy + ny * b.r;

  // velocity of the flipper surface at the contact point (rotation only)
  const rArm = t * f.length;
  const flipperVx = -Math.sin(f.angle) * f.angVel * rArm;
  const flipperVy =  Math.cos(f.angle) * f.angVel * rArm;

  // relative normal velocity
  const relVx = b.vx - flipperVx;
  const relVy = b.vy - flipperVy;
  const vn = relVx * nx + relVy * ny;
  if (vn >= 0) return;

  // impulse resolution — treat flipper as infinite-mass (stiff actuator)
  const e = b.mat.restitution * PHYS.restitutionMul * 1.05;
  b.vx -= vn * nx * (1 + e);
  b.vy -= vn * ny * (1 + e);

  // transfer some of the flipper's tangential motion into the ball
  const tx = -ny, ty = nx;
  const kick = (flipperVx * tx + flipperVy * ty) * 0.55;
  b.vx += tx * kick;
  b.vy += ty * kick;
  b.omega += kick * 0.02;

  spawnImpact(cx, cy, nx, ny, Math.abs(vn) * b.mass, '#ffb340');
  Snd.bonk(520 + Math.abs(f.angVel) * 18, 0.2, 0.08, 'square');
  stats.collisions++;
}
