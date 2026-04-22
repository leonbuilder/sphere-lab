/**
 * Contact resolution. Three entry points:
 *   collideBalls(a, b) — ball/ball, impulse-based, with spin transfer + heat
 *   collideWall(b, w)  — ball/line segment, with rolling-friction enhancement
 *   collidePeg(b, p)   — ball/disc, with pinball bumper extra-kick
 *
 * Each function reads `PHYS.*Mul` globals and dispatches visual/audio FX.
 * `separateBalls` is exposed for the solver's position-correction pass.
 */

import { clamp, rand } from '../core/math.js';
import { PHYS } from '../core/config.js';
import { spawnImpact } from '../entities/particles.js';
import { Snd } from '../audio/sound.js';
import { velRestScale, heatRestMod, heatFricMod, combineFriction, invMass } from './materialMods.js';
import { stats } from './stats.js';

/**
 * Resolve overlap by moving both balls apart along the contact normal,
 * weighted by the *other* ball's mass so heavier bodies move less.
 * Returns whether there was any overlap to resolve.
 */
export function separateBalls(a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const d = Math.sqrt(dx * dx + dy * dy) || 0.0001;
  const overlap = (a.r + b.r) - d;
  if (overlap <= 0) return false;
  const nx = dx / d, ny = dy / d;
  const ma = a.pinned ? 1e9 : a.mass;
  const mb = b.pinned ? 1e9 : b.mass;
  const total = ma + mb;
  if (!a.pinned) { a.x -= nx * overlap * (mb / total); a.y -= ny * overlap * (mb / total); }
  if (!b.pinned) { b.x += nx * overlap * (ma / total); b.y += ny * overlap * (ma / total); }
  return true;
}

export function collideBalls(a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const d2 = dx * dx + dy * dy;
  const rsum = a.r + b.r;
  if (d2 >= rsum * rsum) return;
  const d = Math.sqrt(d2) || 0.0001;
  const nx = dx / d, ny = dy / d;
  const tx = -ny, ty = nx;

  separateBalls(a, b);

  const rvx = b.vx - a.vx, rvy = b.vy - a.vy;
  const vn = rvx * nx + rvy * ny;
  if (vn > 0) return;  // already separating

  // normal impulse
  const baseE = (a.mat.restitution + b.mat.restitution) * 0.5;
  const e = baseE * PHYS.restitutionMul * velRestScale(Math.abs(vn)) * heatRestMod(a) * heatRestMod(b);
  const invMa = a.pinned ? 0 : 1 / a.mass;
  const invMb = b.pinned ? 0 : 1 / b.mass;
  const invSum = invMa + invMb || 1;
  const j = -(1 + e) * vn / invSum;
  a.vx -= j * nx * invMa; a.vy -= j * ny * invMa;
  b.vx += j * nx * invMb; b.vy += j * ny * invMb;

  // tangential impulse with small restitution (superball effect) + spin transfer
  const surfVA = a.omega * a.r;
  const surfVB = -b.omega * b.r;
  const rvt = (b.vx - a.vx) * tx + (b.vy - a.vy) * ty + (surfVA - surfVB);
  const mu  = combineFriction(a.mat.friction, b.mat.friction) * PHYS.frictionMul * heatFricMod(a) * heatFricMod(b);
  const et  = baseE * 0.12;
  const denom = invSum + (a.pinned ? 0 : a.r * a.r / a.inertia) + (b.pinned ? 0 : b.r * b.r / b.inertia);
  let jt = -rvt * (1 + et) / denom;
  const maxJt = Math.abs(j) * mu;
  if (jt > maxJt) jt = maxJt; else if (jt < -maxJt) jt = -maxJt;
  a.vx -= jt * tx * invMa; a.vy -= jt * ty * invMa;
  b.vx += jt * tx * invMb; b.vy += jt * ty * invMb;
  if (!a.pinned) a.omega -= jt * a.r / a.inertia;
  if (!b.pinned) b.omega -= jt * b.r / b.inertia;

  // weak Coulomb interaction
  if (a.charge && b.charge) {
    const f = a.charge * b.charge * 500 / (d2 + 10);
    a.vx -= f * nx * invMa;
    a.vy -= f * ny * invMa;
  }

  // frictional + normal impact heating
  const heatGain = Math.abs(jt) * 0.00005 + Math.abs(vn) * 0.00002;
  a.heat = Math.min(1, a.heat + heatGain);
  b.heat = Math.min(1, b.heat + heatGain);

  const mag = Math.abs(j);
  if (mag > 2) {
    const hx = (a.x + b.x) * 0.5;
    const hy = (a.y + b.y) * 0.5;
    spawnImpact(hx, hy, nx, ny, mag, a.heat > 0.3 ? '#ffb040' : '#ffffff');
    a.squash = 1 - Math.min(0.32, mag * 0.0025);
    a.squashAng = Math.atan2(ny, nx);
    b.squash = 1 - Math.min(0.32, mag * 0.0025);
    b.squashAng = Math.atan2(-ny, -nx);
    Snd.collision(a.mat, b.mat, mag);
  }
  stats.collisions++;
}

export function collideWall(b, wall) {
  const { x1, y1, x2, y2 } = wall;
  const wx = x2 - x1, wy = y2 - y1;
  const wlen2 = wx * wx + wy * wy;
  let t = ((b.x - x1) * wx + (b.y - y1) * wy) / wlen2;
  t = clamp(t, 0, 1);
  const cx = x1 + wx * t, cy = y1 + wy * t;
  const dx = b.x - cx, dy = b.y - cy;
  const d2 = dx * dx + dy * dy;
  if (d2 >= b.r * b.r) return;
  const d = Math.sqrt(d2) || 0.0001;
  const nx = dx / d, ny = dy / d;

  b.x = cx + nx * b.r;
  b.y = cy + ny * b.r;

  const vn = b.vx * nx + b.vy * ny;
  if (vn >= 0) return;

  const baseE = b.mat.restitution * (wall.bouncy ? 1.4 : 1);
  const e = baseE * PHYS.restitutionMul * velRestScale(Math.abs(vn)) * heatRestMod(b);
  const tx = -ny, ty = nx;
  const vt = b.vx * tx + b.vy * ty;
  const surfV = b.omega * b.r;
  const relT = vt + surfV;

  b.vx -= vn * nx * (1 + e);
  b.vy -= vn * ny * (1 + e);

  // rolling enhancement — amplify friction at low normal speed so balls
  // come to rest instead of buzzing indefinitely
  const restFactor = Math.abs(vn) < 80 ? 1.6 : 1;
  const mu = b.mat.friction * PHYS.frictionMul * heatFricMod(b) * restFactor;
  const denom = 1 + b.r * b.r / b.inertia * b.mass;
  let jt = -relT * b.mass * (1 + baseE * 0.08) / denom;
  const maxJt = Math.abs(vn) * mu * b.mass;
  if (jt > maxJt) jt = maxJt; else if (jt < -maxJt) jt = -maxJt;
  b.vx += jt * tx / b.mass; b.vy += jt * ty / b.mass;
  b.omega += jt * b.r / b.inertia;

  const heatGain = Math.abs(jt) * 0.00007;
  b.heat = Math.min(1, b.heat + heatGain);

  const mag = Math.abs(vn) * b.mass;
  if (mag > 5) {
    spawnImpact(cx, cy, nx, ny, mag * 0.8, '#b0c0d0');
    b.squash = 1 - Math.min(0.38, Math.abs(vn) * 0.0008);
    b.squashAng = Math.atan2(ny, nx);
    Snd.wall(b.mat, mag);
  }
  stats.collisions++;
}

export function collidePeg(b, peg) {
  const dx = b.x - peg.x, dy = b.y - peg.y;
  const d2 = dx * dx + dy * dy;
  const rsum = b.r + peg.r;
  if (d2 >= rsum * rsum) return;
  const d = Math.sqrt(d2) || 0.0001;
  const nx = dx / d, ny = dy / d;

  b.x = peg.x + nx * rsum;
  b.y = peg.y + ny * rsum;

  const vn = b.vx * nx + b.vy * ny;
  if (vn >= 0) return;

  const e = b.mat.restitution * PHYS.restitutionMul * (peg.bumper ? 1.8 : 1);
  b.vx -= vn * nx * (1 + e);
  b.vy -= vn * ny * (1 + e);

  const tx = -ny, ty = nx;
  const vt = b.vx * tx + b.vy * ty;
  const surfV = b.omega * b.r;
  let jt = -(vt + surfV) * 0.3;
  const maxJ = Math.abs(vn) * b.mat.friction * PHYS.frictionMul * 3;
  jt = clamp(jt, -maxJ, maxJ);
  b.vx += jt * tx; b.vy += jt * ty;
  b.omega += jt * b.r / b.inertia * b.mass;

  const mag = Math.abs(vn) * b.mass;
  if (mag > 4) {
    spawnImpact(peg.x + nx * peg.r, peg.y + ny * peg.r, nx, ny, mag, peg.bumper ? '#ffcc40' : '#ffcc66');
    if (peg.bumper) {
      // pinball bumper — extra kick on top of the elastic bounce
      b.vx += nx * 500 * invMass(b);
      b.vy += ny * 500 * invMass(b);
      Snd.bonk(800 + rand(-100, 100), 0.2, 0.1, 'square');
    } else {
      Snd.wall(b.mat, mag);
    }
  }
  stats.collisions++;
}
