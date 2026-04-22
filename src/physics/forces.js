/**
 * Scene-specific field forces:
 *   applyVortex   — tangential + inward attraction toward W.vortex{X,Y}
 *   applySolar    — 1/r² attraction toward the canvas center (SOLAR scene)
 *   applyBuoyancy — Archimedes lift + viscous drag + entry splash particles
 *
 * Each is a no-op when its feature is disabled, so `step.js` can call all
 * three unconditionally per ball.
 */

import { W } from '../core/world.js';
import { PHYS } from '../core/config.js';
import { clamp, len, rand } from '../core/math.js';
import { particles } from '../entities/particles.js';
import { Snd } from '../audio/sound.js';

/** Swirl force: radial attraction + perpendicular "orbital" component. */
export function applyVortex(b, dt) {
  if (W.scene !== 'vortex') return;
  const dx = W.vortexX - b.x, dy = W.vortexY - b.y;
  const d2 = dx * dx + dy * dy;
  const d = Math.sqrt(d2) || 0.001;
  const f = 50000 / (d2 + 1000);
  b.vx += (dx / d) * f * dt;
  b.vy += (dy / d) * f * dt;
  b.vx += (-dy / d) * f * dt * 0.7;
  b.vy += (dx / d) * f * dt * 0.7;
}

/** Inverse-square attraction toward the canvas center, used by the SOLAR scene. */
export function applySolar(b, dt) {
  if (!W.solar) return;
  const cx = W.cw / 2, cy = W.ch / 2;
  const dx = cx - b.x, dy = cy - b.y;
  const d2 = dx * dx + dy * dy;
  const d = Math.sqrt(d2) || 0.001;
  if (d < 50) return;  // inside the sun, stop pulling
  const f = 120000 / (d2 + 100);
  b.vx += (dx / d) * f * dt;
  b.vy += (dy / d) * f * dt;
}

/**
 * Archimedes buoyancy in the `waterY` column. Plus:
 *   - extra viscous drag inside the fluid
 *   - spin drag (water opposes rotation more than it opposes translation)
 *   - splash particle burst + sound on entry
 * Uses `b.py + b.r < waterY && b.y + b.r >= waterY` to detect entry.
 */
export function applyBuoyancy(b, dt) {
  if (W.waterY === undefined) return;
  const submerged = Math.min(b.r * 2, (b.y + b.r) - W.waterY);
  if (submerged <= 0) return;
  const frac = clamp(submerged / (b.r * 2), 0, 1);

  // F_buoy = ρ_fluid · V_submerged · g  (fluid density = 1.0 baseline)
  const fluidDensity = 1.0;
  const ballVol = Math.PI * b.r * b.r * 0.001;
  const buoyForce = fluidDensity * ballVol * frac * PHYS.gravity * 1.2;
  b.vy -= buoyForce / b.mass * dt;

  // viscous drag (linear + quadratic in speed)
  const v = len(b.vx, b.vy);
  const drag = (2 + v * 0.002) * frac;
  b.vx *= Math.max(0, 1 - drag * dt);
  b.vy *= Math.max(0, 1 - drag * dt);
  b.omega *= Math.max(0, 1 - drag * dt * 1.5);

  // entry splash
  if (b.py + b.r < W.waterY && b.y + b.r >= W.waterY && b.vy > 60) {
    const mag = Math.min(10, b.vy * 0.03);
    for (let i = 0; i < mag * 3; i++) {
      const a = -Math.PI / 2 + rand(-0.9, 0.9);
      particles.push({
        x: b.x + rand(-b.r, b.r), y: W.waterY,
        vx: Math.cos(a) * rand(60, 180), vy: Math.sin(a) * rand(80, 220),
        life: 0.9, maxLife: 0.9,
        color: '#6fb0e0', size: rand(1.5, 3.2), type: 'spark'
      });
    }
    Snd.noise(0.12, Math.min(0.15, b.vy * 0.0005), 3000);
  }
}
