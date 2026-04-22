/**
 * Fixed-timestep physics integration. Called by `loop.js` at 240 Hz via an
 * accumulator.
 *
 * Drag: `F_drag = (k_lin + k_quad · |v|) · A · v` where A = π·r². A larger
 * ball has more cross-section and feels more air resistance — small balls
 * dart, bowling balls plough.
 *
 * Magnus: `F⊥ ∝ ω · v · A`. Same scaling — larger balls curve more.
 *
 * Sleep: after `SLEEP_DELAY` seconds of resting motion under gravity, a
 * ball goes to sleep (skips integration + collision iteration). Any contact
 * or tool interaction wakes it via `wake(b)`.
 */

import { W } from '../core/world.js';
import { PHYS } from '../core/config.js';
import { clamp, lerp, len, rand, pick } from '../core/math.js';
import { balls, Ball, wake, SLEEP_DELAY, SLEEP_V, SLEEP_W } from '../entities/ball.js';
import { MATERIALS, MAT_KEYS } from '../entities/materials.js';
import { particles, spawnHeatShimmer, spawnSmoke, spawnSparkle, spawnChip } from '../entities/particles.js';
import { collideBalls, collideWall, collidePeg } from './collisions.js';
import { updateFlippers, collideFlipper } from './flippers.js';
import { applyVortex, applySolar, applyBuoyancy, applyMagnetism, stepRipples } from './forces.js';
import { buildPairs } from './broadphase.js';
import { mouse } from '../input/mouse.js';
import { getTool } from '../input/tools.js';

/** Reference cross-section: a 20 px radius ball (= the default spawn radius). */
const REF_AREA = Math.PI * 20 * 20;

export function physicsStep(dt) {
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

  // wake balls the user is actively interacting with
  if (mouse.down && (TOOL === 'push' || TOOL === 'attract' || TOOL === 'heat')) {
    const r2 = TOOL === 'attract' ? 300*300 : TOOL === 'push' ? 200*200 : 100*100;
    for (const b of balls) {
      const dx = b.x - mouse.wx, dy = b.y - mouse.wy;
      if (dx*dx + dy*dy < r2) wake(b);
    }
  }

  for (const b of balls) {
    b.life += dt;
    const mat = b.mat;
    // squash recovery rate depends on material: rubber recovers slowly (bouncy
    // memory), steel snaps back instantly (rigid).
    const squashRate = 20 - (mat.deform || 0.4) * 15;
    b.squash = lerp(b.squash, 1, clamp(dt * squashRate, 0, 1));

    // Per-material heat cooling — metals hold heat, rubber sheds it quickly.
    b.heat *= (mat.heatKeep ?? 0.996);
    if (b.heat > 0.3) { spawnHeatShimmer(b.x, b.y - b.r, b.heat); wake(b); }

    // Material-specific heat visuals -----------------------------------
    if (PHYS.heatFx && b.heat > 0.05 && !b.isFragment) {
      const matName = mat.name;

      // Ice melts: radius shrinks, mass follows, occasional water droplet.
      // When it gets too small it's gone — water evaporated away.
      if (matName === 'ICE' && b.heat > 0.2 && b.r > 3.2) {
        const meltRate = (b.heat - 0.2) * 1.6;
        const dr = meltRate * dt;
        b.r = Math.max(3, b.r - dr);
        b.mass = b.r * b.r * mat.density * 0.001;
        b.inertia = 0.5 * b.mass * b.r * b.r;
        b.area = Math.PI * b.r * b.r;
        if (Math.random() < dt * meltRate * 25) {
          spawnChip(b.x + rand(-b.r * 0.4, b.r * 0.4), b.y + b.r * 0.6, 0, 1, 30, '#7fc4ff');
        }
        if (b.r <= 3.05) { b._dead = true; continue; }
      }
      // Hot rubber smokes.
      else if (matName === 'RUBBER' && b.heat > 0.45 && Math.random() < dt * 8) {
        spawnSmoke(b.x + rand(-b.r * 0.5, b.r * 0.5), b.y - b.r * 0.3, 0, -15,
                   'rgba(50,40,48,0.45)', 0.85);
      }
      // Hot metals throw small embers.
      else if ((matName === 'STEEL' || matName === 'GOLD' || matName === 'MAGNET') && b.heat > 0.55 && Math.random() < dt * 10) {
        const emberColor = matName === 'GOLD' ? '#ffd890' : matName === 'MAGNET' ? '#ff9060' : '#ffb060';
        spawnSparkle(b.x + rand(-b.r * 0.4, b.r * 0.4), b.y + rand(-b.r * 0.4, b.r * 0.4),
                     0, -1, 35, emberColor);
      }
    }

    // lifespan (fragments) — count down + mark for removal
    if (b.lifespan !== undefined) {
      b.lifespan -= dt;
      if (b.lifespan <= 0) { b._dead = true; continue; }
    }

    if (b.pinned) { b.vx = b.vy = b.omega = 0; continue; }

    if (b.grabbed) {
      wake(b);
      b.vx = (mouse.wx - b.x) * 25 - b.vx * 8 * dt;
      b.vy = (mouse.wy - b.y) * 25 - b.vy * 8 * dt;
    }

    // sleeping balls still get squash tweened + heat decay but skip dynamics.
    if (b.sleeping) continue;

    if (PHYS.gravityOn) b.vy += PHYS.gravity * dt;
    if (PHYS.wind)      b.vx += PHYS.wind * dt;

    // Rolling resistance — only active while in sustained wall contact.
    // Damps the tangential component of velocity (leaves normal alone so
    // gravity / bounces behave correctly). Steel coasts, rubber grabs hard.
    if (b.groundT > 0) {
      b.groundT -= dt;
      const rollK = mat.roll ?? 0.05;
      const nx = b.contactNx, ny = b.contactNy;
      const vn = b.vx * nx + b.vy * ny;
      const vtx = b.vx - vn * nx;
      const vty = b.vy - vn * ny;
      const dampFac = Math.max(0, 1 - rollK * 3.2 * dt);
      b.vx = vn * nx + vtx * dampFac;
      b.vy = vn * ny + vty * dampFac;
      b.omega *= Math.max(0, 1 - rollK * 5 * dt);
    }

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
    if (mouse.down && TOOL === 'attract') {
      const dx = mouse.wx - b.x, dy = mouse.wy - b.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < 300 * 300 && d2 > 400) {
        const d = Math.sqrt(d2);
        const falloff = 1 - d / 300;
        const f = 1400 * falloff / b.mass;
        b.vx += dx / d * f * dt;
        b.vy += dy / d * f * dt;
      }
    }
    if (mouse.down && TOOL === 'heat') {
      const dx = b.x - mouse.wx, dy = b.y - mouse.wy;
      if (dx * dx + dy * dy < 100 * 100) b.heat = Math.min(1, b.heat + dt * 3);
    }

    // drag scales with cross-sectional area — big balls feel heavy air
    const vmag = len(b.vx, b.vy);
    const areaScale = b.area / REF_AREA;
    const dragK = PHYS.drag * areaScale * (1 + vmag * 0.0018);
    const dragFactor = Math.max(0, 1 - dragK * dt);
    b.vx *= dragFactor; b.vy *= dragFactor;
    b.omega *= Math.max(0, 1 - PHYS.drag * areaScale * dt * 0.8);

    // Magnus: F⊥ = k · ω · v · A. Velocity snapshot to avoid self-contamination.
    if (vmag > 10 && Math.abs(b.omega) > 0.1) {
      const magK = PHYS.magnus * 0.002 * areaScale;
      const mvx = -b.vy * b.omega * magK * dt;
      const mvy =  b.vx * b.omega * magK * dt;
      b.vx += mvx;
      b.vy += mvy;
    }

    const spd = len(b.vx, b.vy);
    const maxV = 4000;
    if (spd > maxV) { b.vx *= maxV / spd; b.vy *= maxV / spd; }

    // CCD substep
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

  // springs + pendulum tethers — springs wake their endpoints
  const springIters = W.springs.length > 200 ? 3 : 6;
  for (let i = 0; i < springIters; i++) {
    for (const s of W.springs) {
      wake(s.a); wake(s.b);
      s.solve(dt / springIters * 4);
    }
    for (const c of W.constraints) {
      if (!c.a || c.a.pinned) continue;
      const a = c.a;
      const dx = a.x - c.ax, dy = a.y - c.ay;
      const d = Math.sqrt(dx * dx + dy * dy) || 0.0001;
      const nx = dx / d, ny = dy / d;
      const corr = d - c.len;
      if (Math.abs(corr) < 0.001) continue;
      wake(a);
      a.x -= nx * corr;
      a.y -= ny * corr;
      const vn = a.vx * nx + a.vy * ny;
      if ((corr > 0 && vn > 0) || (corr < 0 && vn < 0)) {
        a.vx -= vn * nx; a.vy -= vn * ny;
      }
    }
  }

  if (balls.length > 0) {
    const pairs = buildPairs();
    const iters = balls.length > 120 ? 2 : 3;
    for (let it = 0; it < iters; it++) {
      for (const pr of pairs) collideBalls(pr[0], pr[1]);
    }
  }

  // sleep bookkeeping — must come AFTER integration + solver
  for (const b of balls) {
    if (b.pinned || b.grabbed) { b.sleeping = false; b.restTime = 0; continue; }
    if (b.isResting()) {
      b.restTime += dt;
      if (b.restTime > SLEEP_DELAY) {
        b.sleeping = true;
        b.vx = 0; b.vy = 0; b.omega = 0;
      }
    } else {
      b.restTime = 0;
      b.sleeping = false;
    }
  }

  // particles
  for (const p of particles) {
    p.life -= dt;
    if (p.type !== 'ring') {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    switch (p.type) {
      case 'smoke':
      case 'dust':
        p.size *= 1 + dt * 0.4;
        p.vx *= 1 - dt * 1.2;
        p.vy *= 1 - dt * 1.2;
        break;
      case 'spark':
      case 'sparkle':
        p.vx *= 1 - dt * 0.6;
        p.vy *= 1 - dt * 0.6;
        if (PHYS.gravityOn) p.vy += 400 * dt;
        break;
      case 'chip':
      case 'shard':
        p.vx *= 1 - dt * 0.35;
        p.vy *= 1 - dt * 0.35;
        if (PHYS.gravityOn) p.vy += 600 * dt;   // chips fall
        if (p.rotV !== undefined) p.rot = (p.rot || 0) + p.rotV * dt;
        break;
    }
  }
  for (let i = particles.length - 1; i >= 0; i--) if (particles[i].life <= 0) particles.splice(i, 1);

  for (let i = balls.length - 1; i >= 0; i--) {
    const b = balls[i];
    if (b._dead || b.x < -800 || b.x > W.cw + 800 || b.y > W.ch + 600 || b.y < -500) {
      balls.splice(i, 1);
    }
  }
}
