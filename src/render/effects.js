/**
 * Screen-space effects that aren't per-ball and aren't post-process:
 *   drawAO        — fake AO darkening the gap between nearby balls
 *   drawParticles — sparks + smoke
 *   drawLensFlares— additive streaks on bright sources (glowy balls + sun)
 */

import { W, cam } from '../core/world.js';
import { PHYS } from '../core/config.js';
import { TAU, clamp } from '../core/math.js';
import { balls } from '../entities/ball.js';
import { particles } from '../entities/particles.js';

/**
 * Cheap screen-space ambient occlusion: darken the gap between pairs of balls
 * that are close but not overlapping. O(n²) but capped by the 260-ball cap.
 */
export function drawAO(tx) {
  if (!PHYS.ao || balls.length < 2) return;
  tx.save();
  tx.globalCompositeOperation = 'multiply';
  for (let i = 0; i < balls.length; i++) {
    const a = balls[i];
    for (let j = i + 1; j < balls.length; j++) {
      const b = balls[j];
      const dx = b.x - a.x, dy = b.y - a.y;
      const d2 = dx * dx + dy * dy;
      const rsum = a.r + b.r;
      const near = rsum * 1.6;
      if (d2 > near * near) continue;
      const d = Math.sqrt(d2) || 0.001;
      if (d < rsum * 0.98) continue; // overlapping case handled by collision
      const t = clamp(1 - (d - rsum) / (near - rsum), 0, 1);
      const mx = (a.x + b.x) * 0.5;
      const my = (a.y + b.y) * 0.5;
      const rr = Math.min(a.r, b.r) * 0.95;
      const alpha = 0.55 * t;
      const grad = tx.createRadialGradient(mx, my, 0, mx, my, rr * 1.4);
      grad.addColorStop(0, `rgba(0,0,0,${alpha})`);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      tx.fillStyle = grad;
      tx.beginPath(); tx.arc(mx, my, rr * 1.4, 0, TAU); tx.fill();
    }
  }
  tx.restore();
}

export function drawParticles(tx) {
  for (const p of particles) {
    if (p.life <= 0) continue;
    const a = p.life / p.maxLife;
    tx.globalAlpha = a;
    tx.fillStyle = p.color;
    if (p.type === 'spark') {
      tx.beginPath();
      tx.arc(p.x, p.y, p.size * a, 0, TAU);
      tx.fill();
    } else if (p.type === 'smoke') {
      const g = tx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
      g.addColorStop(0, p.color);
      g.addColorStop(1, p.color.replace(/..$/, '00'));
      tx.fillStyle = g;
      tx.beginPath();
      tx.arc(p.x, p.y, p.size, 0, TAU);
      tx.fill();
    }
  }
  tx.globalAlpha = 1;
}

/** Additive halo + rotating cross rays on bright sources. */
export function drawLensFlares(tx) {
  if (!PHYS.flare) return;
  tx.save();
  tx.globalCompositeOperation = 'lighter';
  const sources = [];
  for (const b of balls) {
    const glow = Math.max(b.mat.glow || 0, b.heat * 0.9);
    if (glow > 0.6) sources.push({ x: b.x, y: b.y, r: b.r, color: b.effectiveColor(), strength: glow });
  }
  if (W.solar) sources.push({ x: W.cw / 2, y: W.ch / 2, r: 60, color: '#ffdc80', strength: 1.4 });

  for (const s of sources) {
    const gcore = tx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r * 2.5);
    gcore.addColorStop(0,    s.color + 'ff');
    gcore.addColorStop(0.25, s.color + '55');
    gcore.addColorStop(1,    s.color + '00');
    tx.globalAlpha = Math.min(1, s.strength * 0.5);
    tx.fillStyle = gcore;
    tx.beginPath(); tx.arc(s.x, s.y, s.r * 2.5, 0, TAU); tx.fill();

    tx.globalAlpha = Math.min(0.6, s.strength * 0.35);
    tx.strokeStyle = s.color;
    const rays = 4;
    const rayLen = s.r * 5;
    for (let i = 0; i < rays; i++) {
      const a = (i / rays) * Math.PI + performance.now() * 0.00003;
      tx.lineWidth = 1.3;
      tx.beginPath();
      tx.moveTo(s.x - Math.cos(a) * rayLen, s.y - Math.sin(a) * rayLen);
      tx.lineTo(s.x + Math.cos(a) * rayLen, s.y + Math.sin(a) * rayLen);
      tx.stroke();
    }
  }
  tx.restore();
  tx.globalAlpha = 1;
}
