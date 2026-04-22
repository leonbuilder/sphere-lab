/**
 * World-geometry drawing: walls, pegs, constraint tethers, springs,
 * vortex FX, water surface, solar sun glow, and ball ground shadows.
 *
 * Everything here reads from `W` (core/world.js). No simulation writes.
 */

import { W } from '../core/world.js';
import { PHYS } from '../core/config.js';
import { TAU, clamp } from '../core/math.js';
import { mix } from '../core/color.js';
import { balls } from '../entities/ball.js';

/** @param {CanvasRenderingContext2D} tx */
export function drawWalls(tx) {
  // glow pass
  tx.strokeStyle = '#4a607c';
  tx.shadowColor = '#8fd0ff'; tx.shadowBlur = 4;
  tx.lineWidth = 3; tx.lineCap = 'round';
  for (const w of W.walls) {
    if (w.bouncy)       tx.strokeStyle = '#ff7aa8';
    else if (w.flipper) tx.strokeStyle = '#ffb340';
    else                tx.strokeStyle = '#4a607c';
    tx.beginPath(); tx.moveTo(w.x1, w.y1); tx.lineTo(w.x2, w.y2); tx.stroke();
  }
  tx.shadowBlur = 0;
  // thin bright overlay for contrast
  tx.strokeStyle = 'rgba(255,255,255,0.18)';
  tx.lineWidth = 1;
  for (const w of W.walls) {
    tx.beginPath(); tx.moveTo(w.x1, w.y1); tx.lineTo(w.x2, w.y2); tx.stroke();
  }
}

/** @param {CanvasRenderingContext2D} tx */
export function drawPegs(tx) {
  for (const p of W.pegs) {
    const bumper = p.bumper;

    // drop shadow
    tx.fillStyle = 'rgba(0,0,0,0.45)';
    tx.beginPath();
    tx.ellipse(p.x + 2, p.y + 4, p.r * 1.1, p.r * 0.35, 0, 0, TAU);
    tx.fill();

    const g = tx.createRadialGradient(p.x - p.r * 0.4, p.y - p.r * 0.4, 0, p.x, p.y, p.r);
    if (bumper) {
      const pulse = 0.5 + 0.5 * Math.sin(performance.now() * 0.004);
      g.addColorStop(0,   '#fff');
      g.addColorStop(0.5, '#ffcc40');
      g.addColorStop(1,   '#804000');
      tx.fillStyle = g;
      tx.beginPath(); tx.arc(p.x, p.y, p.r, 0, TAU); tx.fill();
      tx.strokeStyle = `rgba(255,200,80,${0.5 + pulse * 0.5})`;
      tx.lineWidth = 2 + pulse * 2;
      tx.beginPath(); tx.arc(p.x, p.y, p.r + 3, 0, TAU); tx.stroke();
    } else {
      g.addColorStop(0,   '#fff8c8');
      g.addColorStop(0.6, '#ffc048');
      g.addColorStop(1,   '#604000');
      tx.fillStyle = g;
      tx.beginPath(); tx.arc(p.x, p.y, p.r, 0, TAU); tx.fill();
      tx.strokeStyle = '#3a2200'; tx.lineWidth = 1;
      tx.stroke();
    }
  }
}

/** @param {CanvasRenderingContext2D} tx */
export function drawConstraints(tx) {
  tx.strokeStyle = 'rgba(200,220,255,0.6)';
  tx.lineWidth = 1;
  for (const c of W.constraints) {
    if (!c.a) continue;
    tx.beginPath(); tx.moveTo(c.ax, c.ay); tx.lineTo(c.a.x, c.a.y); tx.stroke();
    tx.fillStyle = '#8a9fba';
    tx.beginPath(); tx.arc(c.ax, c.ay, 3, 0, TAU); tx.fill();
  }
}

/** @param {CanvasRenderingContext2D} tx — stretched red, compressed blue, neutral white */
export function drawSprings(tx) {
  for (const s of W.springs) {
    const dx = s.b.x - s.a.x, dy = s.b.y - s.a.y;
    const d = Math.sqrt(dx * dx + dy * dy) || 1;
    const stretch = (d - s.rest) / s.rest;
    const col = stretch > 0
      ? mix('#ffffff', '#ff4060', Math.min(1,  stretch * 2))
      : mix('#ffffff', '#4080ff', Math.min(1, -stretch * 2));
    tx.strokeStyle = col;
    tx.globalAlpha = 0.55;
    tx.lineWidth = clamp(1.5 - Math.abs(stretch) * 0.5, 0.4, 2);
    tx.beginPath();
    tx.moveTo(s.a.x, s.a.y);
    tx.lineTo(s.b.x, s.b.y);
    tx.stroke();
  }
  tx.globalAlpha = 1;
}

/** Water body + animated surface waves + caustic highlights. */
export function drawWater(tx) {
  if (W.waterY === undefined) return;
  const y = W.waterY;

  const g = tx.createLinearGradient(0, y, 0, W.ch);
  g.addColorStop(0, 'rgba(80,160,220,0.4)');
  g.addColorStop(1, 'rgba(30,80,140,0.65)');
  tx.fillStyle = g;
  tx.fillRect(0, y, W.cw, W.ch - y);

  const t = performance.now() * 0.0012;
  tx.strokeStyle = 'rgba(180,220,255,0.75)';
  tx.lineWidth = 2;
  tx.beginPath();
  for (let x = 0; x <= W.cw; x += 6) {
    const wave = Math.sin(x * 0.015 + t * 2) * 4 + Math.sin(x * 0.04 + t * 3.1) * 2;
    if (x === 0) tx.moveTo(x, y + wave); else tx.lineTo(x, y + wave);
  }
  tx.stroke();
  tx.strokeStyle = 'rgba(255,255,255,0.25)';
  tx.lineWidth = 1;
  tx.beginPath();
  for (let x = 0; x <= W.cw; x += 6) {
    const wave = Math.sin(x * 0.022 + t * 1.6) * 3;
    if (x === 0) tx.moveTo(x, y - 2 + wave); else tx.lineTo(x, y - 2 + wave);
  }
  tx.stroke();

  // light caustics
  tx.globalCompositeOperation = 'screen';
  for (let i = 0; i < 6; i++) {
    const cx = ((i * 223 + t * 80) % W.cw);
    const g2 = tx.createRadialGradient(cx, y + 30, 0, cx, y + 30, 90);
    g2.addColorStop(0, 'rgba(180,220,255,0.14)');
    g2.addColorStop(1, 'rgba(180,220,255,0)');
    tx.fillStyle = g2;
    tx.fillRect(cx - 90, y, 180, 120);
  }
  tx.globalCompositeOperation = 'source-over';
}

export function drawVortex(tx) {
  if (W.scene !== 'vortex') return;
  const t = performance.now() * 0.0004;
  for (let r = 40; r < 520; r += 40) {
    tx.strokeStyle = `rgba(200,120,255,${0.14 * (1 - r / 520)})`;
    tx.lineWidth = 1;
    tx.beginPath();
    for (let a = 0; a < TAU + 0.1; a += 0.08) {
      const rr = r + Math.sin(a * 3 + t + r * 0.01) * 10;
      const x = W.vortexX + Math.cos(a) * rr;
      const y = W.vortexY + Math.sin(a) * rr;
      if (a === 0) tx.moveTo(x, y); else tx.lineTo(x, y);
    }
    tx.closePath(); tx.stroke();
  }
  const g = tx.createRadialGradient(W.vortexX, W.vortexY, 0, W.vortexX, W.vortexY, 80);
  g.addColorStop(0, 'rgba(200,120,255,0.6)');
  g.addColorStop(1, 'rgba(200,120,255,0)');
  tx.fillStyle = g;
  tx.beginPath(); tx.arc(W.vortexX, W.vortexY, 80, 0, TAU); tx.fill();
}

export function drawSolarCenter(tx) {
  if (!W.solar) return;
  const cx = W.cw / 2, cy = W.ch / 2;
  const pulse = 0.92 + 0.08 * Math.sin(performance.now() * 0.002);
  const g = tx.createRadialGradient(cx, cy, 30, cx, cy, 200);
  g.addColorStop(0,   'rgba(255,220,120,0.8)');
  g.addColorStop(0.4, 'rgba(255,140,40,0.25)');
  g.addColorStop(1,   'rgba(255,120,40,0)');
  tx.fillStyle = g;
  tx.beginPath();
  tx.arc(cx, cy, 200 * pulse, 0, TAU);
  tx.fill();
}

/** Elongated "floor" shadows under balls — only with gravity on. */
export function drawBallShadows(tx) {
  if (!PHYS.shadow || !PHYS.gravityOn) return;
  const floorY = W.ch - 40;
  for (const b of balls) {
    const dist = floorY - (b.y + b.r);
    if (dist < 0 || dist > 300) continue;
    const spread = 1 + dist / 110;
    const alpha = 0.4 * (1 - dist / 300);
    tx.fillStyle = `rgba(0,0,0,${alpha})`;
    tx.beginPath();
    tx.ellipse(b.x, floorY, b.r * spread, b.r * 0.3 * spread, 0, 0, TAU);
    tx.fill();
  }
}
