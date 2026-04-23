/**
 * TNT detonation + cascade.
 *
 * A TNT ball is flagged to detonate by `lightFuse(b)` — typically from a
 * hard impact in collisions.js. At end of each physics step, step.js calls
 * `processTNT(dt)` which ticks every lit fuse; when the timer reaches zero
 * the ball explodes (radial impulse + heat pulse + FX + sound) and any
 * other TNT in the blast radius gets its fuse lit too, with a staggered
 * delay so chains read as a visible sweep instead of one instant flash.
 */

import { rand, TAU } from '../core/math.js';
import { balls } from '../entities/ball.js';
import { particles } from '../entities/particles.js';
import { Snd } from '../audio/sound.js';

/** Seconds between a TNT being hit and its detonation. */
const FUSE_TIME = 0.35;
/** Shorter fuse used for chain-reaction TNT — fast cascade, still visible. */
const CHAIN_FUSE = 0.12;
/** Blast radius — balls inside get impulse + (optionally) heat. */
const BLAST_R = 220;
/** Peak outward force scaling — falls off linearly to 0 at BLAST_R. */
const BLAST_F = 2200;
/** Normal-velocity threshold for chain TNT — how hard another TNT must be
 *  shoved by a blast before its own fuse lights. Below this the TNT just
 *  gets pushed, which actually feels more natural than everything going off. */
const CHAIN_V = 60;

/**
 * Light this TNT's fuse if it isn't already lit. Safe no-op for non-TNT.
 * `fuseLen` defaults to FUSE_TIME — chain callers pass CHAIN_FUSE.
 */
export function lightFuse(b, fuseLen = FUSE_TIME) {
  if (!b.mat.explosive || b._dead) return;
  if (b.fuseT > 0 && b.fuseT <= fuseLen) return;  // already lit shorter
  b.fuseT = fuseLen;
}

/** Tick every lit fuse; detonate the ones that reach zero. */
export function processTNT(dt) {
  if (balls.length === 0) return;
  /** @type {import('../entities/ball.js').Ball[]} */
  const detonating = [];
  for (const b of balls) {
    if (b.fuseT <= 0) continue;
    b.fuseT -= dt;
    if (b.fuseT <= 0) detonating.push(b);
  }
  for (const b of detonating) detonate(b);
}

function detonate(b) {
  if (b._dead) return;
  const x = b.x, y = b.y;
  const r = BLAST_R;
  const r2 = r * r;

  for (const o of balls) {
    if (o === b || o.pinned || o._dead) continue;
    const dx = o.x - x, dy = o.y - y;
    const d2 = dx * dx + dy * dy;
    if (d2 > r2) continue;
    const d = Math.sqrt(d2) || 0.001;
    const falloff = 1 - d / r;
    const f = BLAST_F * falloff;
    const ax = dx / d * f / o.mass;
    const ay = dy / d * f / o.mass;
    o.vx += ax;
    o.vy += ay;
    o.omega += rand(-8, 8) * falloff;
    // Blast heat — warms nearby balls a little. Hot enough to melt ice
    // or start smoking rubber if they're close. Scaled by proximity.
    o.heat = Math.min(1, o.heat + falloff * 0.5);
    // Wake sleepers so they actually feel the impulse.
    if (o.sleeping) { o.sleeping = false; o.restTime = 0; }
    // Chain other TNT in range. Use the velocity we just imparted — the
    // threshold filters out the far edge of the blast where TNT would
    // just get nudged. Short fuse so the cascade sweeps outward.
    if (o.mat.explosive && Math.hypot(ax, ay) > CHAIN_V) {
      lightFuse(o, CHAIN_FUSE);
    }
  }

  // Bright flash + smoke + sparks
  for (let i = 0; i < 80; i++) {
    const a = rand(0, TAU);
    const sp = rand(160, 560);
    particles.push({
      x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
      life: rand(0.35, 0.9), maxLife: 0.9,
      color: i < 40 ? '#ffdb66' : '#ff6a28',
      size: rand(1.2, 3.4), type: 'spark'
    });
  }
  for (let i = 0; i < 24; i++) {
    const a = rand(0, TAU);
    const sp = rand(40, 120);
    particles.push({
      x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 30,
      life: 1.4, maxLife: 1.4,
      color: 'rgba(90,70,60,0.55)', size: rand(8, 16), type: 'smoke'
    });
  }
  // Shockwave ring — visible expanding circle.
  particles.push({
    x, y, vx: 0, vy: 0,
    life: 0.55, maxLife: 0.55,
    color: '#ffdb66', size: 2, type: 'ring',
    ringR0: 6, ringR1: r * 0.9
  });

  Snd.bonk(90, 0.5, 0.45, 'sawtooth');
  Snd.noise(0.45, 0.28, 2500);

  b._dead = true;
}
