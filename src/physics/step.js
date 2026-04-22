/**
 * Fixed-timestep physics integration. Called by `loop.js` at 240 Hz via an
 * accumulator.
 *
 * Order per step:
 *   1. Rain-spawn drop (if scene asks for it).
 *   2. Flipper angular update.
 *   3. Magnetism pass (global ball↔ball).
 *   4. Ripple aging.
 *   5. Per-ball integration: forces → drag → Magnus → cap → CCD sub-step
 *      against walls + pegs + flippers.
 *   6. Spring + pendulum-constraint iterations.
 *   7. Ball/ball broadphase + multi-iteration contact solve.
 *   8. Particle integration + culling.
 *   9. Cull escaped balls.
 */

import { W } from '../core/world.js';
import { PHYS } from '../core/config.js';
import { clamp, lerp, len, rand, pick } from '../core/math.js';
import { balls, Ball } from '../entities/ball.js';
import { MATERIALS, MAT_KEYS } from '../entities/materials.js';
import { particles, spawnHeatShimmer } from '../entities/particles.js';
import { collideBalls, collideWall, collidePeg } from './collisions.js';
import { updateFlippers, collideFlipper } from './flippers.js';
import { applyVortex, applySolar, applyBuoyancy, applyMagnetism, stepRipples } from './forces.js';
import { buildPairs } from './broadphase.js';
import { mouse } from '../input/mouse.js';
import { getTool } from '../input/tools.js';

export function physicsStep(dt) {
  // continuous drop for rain / galton
  if (W.rainSpawn && Math.random() < 0.1 && balls.length < 200) {
    const mat = MATERIALS[pick(MAT_KEYS)];
    const b = new Ball(rand(W.cw * 0.1, W.cw * 0.9), 60, rand(7, 16), mat);
    b.vx = rand(-30, 30) + PHYS.wind * 0.1;
    balls.push(b);
  }

  updateFlippers(dt);
  applyMagnetism(dt);
  stepRipples(dt);

  const TOOL = getTool();

  for (const b of balls) {
    b.life += dt;
    b.squash = lerp(b.squash, 1, clamp(dt * 20, 0, 1));
    b.heat *= 0.996;
    if (b.heat > 0.3) spawnHeatShimmer(b.x, b.y - b.r, b.heat);

    if (b.pinned) { b.vx = b.vy = b.omega = 0; continue; }

    if (b.grabbed) {
      b.vx = (mouse.wx - b.x) * 25 - b.vx * 8 * dt;
      b.vy = (mouse.wy - b.y) * 25 - b.vy * 8 * dt;
    }

    if (PHYS.gravityOn) b.vy += PHYS.gravity * dt;
    if (PHYS.wind)      b.vx += PHYS.wind * dt;

    applyVortex(b, dt);
    applySolar(b, dt);
    applyBuoyancy(b, dt);

    if (mouse.down && TOOL === 'push') {
      const dx = b.x - mouse.wx, dy = b.y - mouse.wy;
      const d2 = dx * dx + dy * dy;
      if (d2 < 200 * 200) {
        const d = Math.sqrt(d2) || 0.001;
        const f = (200 - d) * 800 / b.mass;
        b.vx += dx / d * f * dt;
        b.vy += dy / d * f * dt;
      }
    }
    if (mouse.down && TOOL === 'heat') {
      const dx = b.x - mouse.wx, dy = b.y - mouse.wy;
      if (dx * dx + dy * dy < 100 * 100) b.heat = Math.min(1, b.heat + dt * 3);
    }

    // quadratic drag
    const vmag = len(b.vx, b.vy);
    const dragK = PHYS.drag * (1 + vmag * 0.0018);
    const dragFactor = Math.max(0, 1 - dragK * dt);
    b.vx *= dragFactor; b.vy *= dragFactor;
    b.omega *= Math.max(0, 1 - PHYS.drag * dt * 0.8);

    // 2D Magnus with velocity snapshot
    if (vmag > 10 && Math.abs(b.omega) > 0.1) {
      const magK = PHYS.magnus * 0.002;
      const mvx = -b.vy * b.omega * magK * dt;
      const mvy =  b.vx * b.omega * magK * dt;
      b.vx += mvx;
      b.vy += mvy;
    }

    // speed cap
    const spd = len(b.vx, b.vy);
    const maxV = 4000;
    if (spd > maxV) { b.vx *= maxV / spd; b.vy *= maxV / spd; }

    // CCD sub-step
    const steps = Math.max(1, Math.ceil(spd * dt / (b.r * 0.6)));
    const sdt = dt / steps;
    b.px = b.x; b.py = b.y;
    for (let s = 0; s < steps; s++) {
      b.x += b.vx * sdt;
      b.y += b.vy * sdt;
      for (const w of W.walls) collideWall(b, w);
      for (const peg of W.pegs) collidePeg(b, peg);
      for (const f of W.flippers) collideFlipper(b, f);
    }
    b.angle += b.omega * dt;

    if (PHYS.trails) {
      b.trailT -= dt;
      if (b.trailT <= 0) {
        b.trailT = 0.02;
        b.trail.push({ x: b.x, y: b.y });
        if (b.trail.length > 30) b.trail.shift();
      }
    } else if (b.trail.length) {
      b.trail.length = 0;
    }
  }

  // springs + pendulum tethers
  const springIters = W.springs.length > 200 ? 3 : 6;
  for (let i = 0; i < springIters; i++) {
    for (const s of W.springs) s.solve(dt / springIters * 4);
    for (const c of W.constraints) {
      if (!c.a || c.a.pinned) continue;
      const a = c.a;
      const dx = a.x - c.ax, dy = a.y - c.ay;
      const d = Math.sqrt(dx * dx + dy * dy) || 0.0001;
      const nx = dx / d, ny = dy / d;
      const corr = d - c.len;
      if (Math.abs(corr) < 0.001) continue;
      a.x -= nx * corr;
      a.y -= ny * corr;
      const vn = a.vx * nx + a.vy * ny;
      if ((corr > 0 && vn > 0) || (corr < 0 && vn < 0)) {
        a.vx -= vn * nx; a.vy -= vn * ny;
      }
    }
  }

  // narrowphase
  if (balls.length > 0) {
    const pairs = buildPairs();
    const iters = balls.length > 120 ? 2 : 3;
    for (let it = 0; it < iters; it++) {
      for (const pr of pairs) collideBalls(pr[0], pr[1]);
    }
  }

  // particles
  for (const p of particles) {
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (p.type === 'smoke') {
      p.size *= 1 + dt * 0.4;
      p.vx *= 1 - dt * 1.2;
      p.vy *= 1 - dt * 1.2;
    } else {
      p.vx *= 1 - dt * 0.6;
      p.vy *= 1 - dt * 0.6;
      if (PHYS.gravityOn) p.vy += 400 * dt;
    }
  }
  for (let i = particles.length - 1; i >= 0; i--) if (particles[i].life <= 0) particles.splice(i, 1);

  // cull escaped
  for (let i = balls.length - 1; i >= 0; i--) {
    const b = balls[i];
    if (b.x < -800 || b.x > W.cw + 800 || b.y > W.ch + 600 || b.y < -500) {
      balls.splice(i, 1);
    }
  }
}
