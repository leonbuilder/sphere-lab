/**
 * Contact resolution. Three entry points:
 *   collideBalls(a, b) — ball/ball, impulse-based
 *   collideWall(b, w)  — ball/line (incl. conveyor-belt drag)
 *   collidePeg(b, p)   — ball/disc (incl. pinball bumper kick)
 *
 * Material-aware behaviour:
 *   • Restitution combines as `min(eA, eB)` — softer wins.
 *   • Squash depth + angle set from `material.deform` (rubber big, glass zero).
 *   • Impact FX are dispatched per material (sparks / sparkle / chip / dust).
 *   • Fragile materials (glass, ice) fracture above a velocity threshold.
 *   • `chip` materials emit debris every hit (ice always sheds chips).
 *   • `fluid` materials of the same kind merge on slow contact (mercury).
 */

import { clamp, rand, TAU } from '../core/math.js';
import { PHYS } from '../core/config.js';
import {
  spawnImpact, spawnSparkle, spawnChip, spawnDust, spawnSmoke
} from '../entities/particles.js';
import { Snd } from '../audio/sound.js';
import { velRestScale, heatRestMod, heatFricMod, combineFriction, invMass } from './materialMods.js';
import { stats } from './stats.js';
import { wake, balls, Ball } from '../entities/ball.js';
import { tryFracture } from './fracture.js';

/** How many dents a gold ball can carry before new ones replace the oldest. */
const MAX_DENTS = 9;
/** Minimum impulse magnitude that leaves a dent on a dentable ball. */
const DENT_THRESHOLD = 55;

/**
 * Accumulate a permanent dent on a dentable ball (currently only gold).
 * The dent is stored in ball-local rotation space so it rotates with the
 * ball instead of floating at a fixed world angle. Nearby impact angles
 * merge into the existing dent (deepening it) rather than stacking.
 *
 * @param {import('../entities/ball.js').Ball} ball
 * @param {number} worldAngle — angle from ball center to impact point (world)
 * @param {number} magnitude  — impulse magnitude
 */
function addDent(ball, worldAngle, magnitude) {
  if (!ball.mat.dentable || ball.isFragment) return;
  if (magnitude < DENT_THRESHOLD) return;
  if (!ball.dents) ball.dents = [];
  const local = worldAngle - ball.angle;
  for (const d of ball.dents) {
    let diff = Math.abs(((d.localAngle - local) % TAU + TAU) % TAU);
    if (diff > Math.PI) diff = TAU - diff;
    if (diff < 0.32) {
      d.depth = Math.min(1, d.depth + 0.10);
      return;
    }
  }
  if (ball.dents.length >= MAX_DENTS) ball.dents.shift();
  ball.dents.push({
    localAngle: local,
    depth: clamp(0.28 + magnitude * 0.0015, 0.28, 0.9)
  });
}

/** Dispatch material-specific visual debris for one contact. */
function spawnImpactFor(mat, x, y, nx, ny, magnitude) {
  switch (mat.name) {
    case 'GLASS':
      return spawnSparkle(x, y, nx, ny, magnitude, '#cfeaff');
    case 'ICE':
      return spawnChip(x, y, nx, ny, magnitude, '#d6ecff');
    case 'BOWLING':
      return spawnDust(x, y, magnitude, '#857970');
    case 'GOLD':
      return spawnImpact(x, y, nx, ny, magnitude * 0.5, '#ffd970');
    case 'STEEL':
      return spawnImpact(x, y, nx, ny, magnitude, '#ffe0a0');
    case 'PLASMA':
      return spawnSparkle(x, y, nx, ny, magnitude, '#e0a0ff');
    case 'NEON':
      return spawnSparkle(x, y, nx, ny, magnitude, mat.color);
    case 'RUBBER':
      // rubber doesn't fling debris — a small deformation puff is enough
      if (magnitude > 40) spawnSmoke(x, y, 0, 0, 'rgba(120,60,70,0.35)', 0.35);
      return;
    case 'MERCURY':
      // silky liquid — no visible chips
      return;
    case 'MAGNET':
      return spawnImpact(x, y, nx, ny, magnitude * 0.5, '#ff8080');
    default:
      return spawnImpact(x, y, nx, ny, magnitude);
  }
}

/**
 * Mercury-style merge. Two fluid balls of the same material at low relative
 * velocity combine into one: area (∝ r²) conserved, mass conserved, velocity
 * is mass-weighted. Prevents them from stacking as discrete balls.
 */
function tryFluidMerge(a, b) {
  if (!a.mat.fluid || a.mat.name !== b.mat.name) return false;
  if (a.pinned || b.pinned) return false;
  const dvx = b.vx - a.vx, dvy = b.vy - a.vy;
  const relSpeed = Math.sqrt(dvx * dvx + dvy * dvy);
  const combinedR = Math.sqrt(a.r * a.r + b.r * b.r);
  if (relSpeed > 60 || combinedR > 42) return false;

  const total = a.mass + b.mass;
  const nx = (a.mass * a.x + b.mass * b.x) / total;
  const ny = (a.mass * a.y + b.mass * b.y) / total;
  const nvx = (a.mass * a.vx + b.mass * b.vx) / total;
  const nvy = (a.mass * a.vy + b.mass * b.vy) / total;

  // grow `a` into the merged ball; drop `b`
  a.x = nx; a.y = ny;
  a.vx = nvx; a.vy = nvy;
  a.r = combinedR;
  a.area = Math.PI * combinedR * combinedR;
  a.mass = combinedR * combinedR * a.mat.density * 0.001;
  a.inertia = 0.5 * a.mass * combinedR * combinedR;
  a.omega *= 0.5;
  wake(a);

  const idx = balls.indexOf(b);
  if (idx >= 0) balls.splice(idx, 1);

  Snd.noise(0.08, 0.14, 1800);
  stats.collisions++;
  return true;
}

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

  // mercury merge — check before resolving contact
  if (tryFluidMerge(a, b)) return;

  separateBalls(a, b);

  const rvx = b.vx - a.vx, rvy = b.vy - a.vy;
  const vn = rvx * nx + rvy * ny;
  if (vn > 0) return;

  const baseE = Math.min(a.mat.restitution, b.mat.restitution);
  const e = baseE * PHYS.restitutionMul * velRestScale(Math.abs(vn)) * heatRestMod(a) * heatRestMod(b);
  const invMa = a.pinned ? 0 : 1 / a.mass;
  const invMb = b.pinned ? 0 : 1 / b.mass;
  const invSum = invMa + invMb || 1;
  const j = -(1 + e) * vn / invSum;
  a.vx -= j * nx * invMa; a.vy -= j * ny * invMa;
  b.vx += j * nx * invMb; b.vy += j * ny * invMb;

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

  if (a.charge && b.charge) {
    const f = a.charge * b.charge * 500 / (d2 + 10);
    a.vx -= f * nx * invMa;
    a.vy -= f * ny * invMa;
  }

  const heatGain = Math.abs(jt) * 0.00005 + Math.abs(vn) * 0.00002;
  a.heat = Math.min(1, a.heat + heatGain);
  b.heat = Math.min(1, b.heat + heatGain);

  wake(a); wake(b);

  // per-hit chip emission for materials with probabilistic chip shedding (ice)
  if (a.mat.chip && Math.random() < a.mat.chip) spawnChip(a.x + nx * a.r * 0.8, a.y + ny * a.r * 0.8, nx, ny, 40, a.mat.color);
  if (b.mat.chip && Math.random() < b.mat.chip) spawnChip(b.x - nx * b.r * 0.8, b.y - ny * b.r * 0.8, -nx, -ny, 40, b.mat.color);

  // fracture — fragile materials break apart above a velocity threshold.
  // Impulses were already applied, so the other ball still gets the kick.
  const aFractured = tryFracture(a, Math.abs(vn));
  const bFractured = tryFracture(b, Math.abs(vn));

  const mag = Math.abs(j);
  if (mag > 2) {
    const hx = (a.x + b.x) * 0.5;
    const hy = (a.y + b.y) * 0.5;

    if (!aFractured) {
      spawnImpactFor(a.mat, hx, hy, nx, ny, mag);
      // squash amplitude scales with material deformability
      const dA = (a.mat.deform ?? 0.4);
      a.squash = 1 - Math.min(0.35 * dA, mag * 0.0025 * dA);
      a.squashAng = Math.atan2(ny, nx);
      // The impact on `a` comes from the direction of `b` → contact point on
      // a is at (nx, ny) side. That's where the dent sits.
      addDent(a, Math.atan2(ny, nx), mag);
    }
    if (!bFractured) {
      spawnImpactFor(b.mat, hx, hy, -nx, -ny, mag);
      const dB = (b.mat.deform ?? 0.4);
      b.squash = 1 - Math.min(0.35 * dB, mag * 0.0025 * dB);
      b.squashAng = Math.atan2(-ny, -nx);
      addDent(b, Math.atan2(-ny, -nx), mag);
    }
    if (!aFractured && !bFractured) Snd.collision(a, b, mag, Math.abs(vn));
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

  const restFactor = Math.abs(vn) < 80 ? 1.6 : 1;
  const mu = b.mat.friction * PHYS.frictionMul * heatFricMod(b) * restFactor;
  const denom = 1 + b.r * b.r / b.inertia * b.mass;
  let jt = -relT * b.mass * (1 + baseE * 0.08) / denom;
  const maxJt = Math.abs(vn) * mu * b.mass;
  if (jt > maxJt) jt = maxJt; else if (jt < -maxJt) jt = -maxJt;
  b.vx += jt * tx / b.mass; b.vy += jt * ty / b.mass;
  b.omega += jt * b.r / b.inertia;

  if (wall.conveyorV) {
    const wlen = Math.sqrt(wlen2);
    const btx = wx / wlen, bty = wy / wlen;
    const vAlong = b.vx * btx + b.vy * bty;
    const diff = wall.conveyorV - vAlong;
    const grip = clamp(0.05 + b.mat.friction * 0.5, 0.05, 0.6);
    b.vx += btx * diff * grip;
    b.vy += bty * diff * grip;
    b.omega += diff * grip * 0.01;
    wake(b);
  }

  const heatGain = Math.abs(jt) * 0.00007;
  b.heat = Math.min(1, b.heat + heatGain);

  wake(b);

  // Rolling-resistance contact: every wall touch refreshes the contact
  // timer so step.js can apply per-material tangential damping while the
  // ball is rolling. Expires ~80 ms after the last contact.
  b.groundT = 0.08;
  b.contactNx = nx;
  b.contactNy = ny;

  // chip emission on wall hits too
  if (b.mat.chip && Math.random() < b.mat.chip) spawnChip(cx, cy, nx, ny, 40, b.mat.color);

  // wall fracture check
  if (tryFracture(b, Math.abs(vn))) return;

  const mag = Math.abs(vn) * b.mass;
  if (mag > 5) {
    spawnImpactFor(b.mat, cx, cy, nx, ny, mag * 0.8);
    const dF = (b.mat.deform ?? 0.4);
    b.squash = 1 - Math.min(0.4 * dF, Math.abs(vn) * 0.0008 * dF);
    b.squashAng = Math.atan2(ny, nx);
    addDent(b, Math.atan2(ny, nx), mag);
    Snd.wall(b, mag, Math.abs(vn));
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

  wake(b);

  // Pegs also count as rolling contact.
  b.groundT = 0.08;
  b.contactNx = nx;
  b.contactNy = ny;

  if (tryFracture(b, Math.abs(vn))) return;

  const mag = Math.abs(vn) * b.mass;
  if (mag > 4) {
    spawnImpactFor(b.mat, peg.x + nx * peg.r, peg.y + ny * peg.r, nx, ny, mag);
    addDent(b, Math.atan2(ny, nx), mag);
    if (peg.bumper) {
      b.vx += nx * 500 * invMass(b);
      b.vy += ny * 500 * invMass(b);
      Snd.bonk(800 + rand(-100, 100), 0.2, 0.1, 'square');
    } else {
      Snd.wall(b, mag, Math.abs(vn));
    }
  }
  stats.collisions++;
}
