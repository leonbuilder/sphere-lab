/**
 * Post-processing pipeline.
 *
 *   doBloomPass()  — half-res glow buffer, blurred with canvas `filter`,
 *                    composited additively over the main canvas
 *   doPostFX()     — chromatic aberration (red/blue radial tint) + film grain
 *                    tile panned each frame
 *
 * Call order from the loop: bloom → postfx. Each is cheap because both operate
 * at half resolution or use precomputed tiles.
 */

import { W } from '../core/world.js';
import { PHYS } from '../core/config.js';
import { TAU, clamp, len } from '../core/math.js';
import { mix } from '../core/color.js';
import { balls } from '../entities/ball.js';
import { particles } from '../entities/particles.js';
import { canvas, ctx, dpr, bloomCanvas, bloomCtx } from './canvas.js';

/* ---------------------- film grain tile (precomputed) ---------------------- */
const grainCanvas = document.createElement('canvas');
const grainCtx = grainCanvas.getContext('2d');
let grainT = 0;
function buildGrain() {
  grainCanvas.width = 180;
  grainCanvas.height = 180;
  const img = grainCtx.createImageData(180, 180);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() * 255) | 0;
    img.data[i] = n; img.data[i + 1] = n; img.data[i + 2] = n;
    img.data[i + 3] = 28;
  }
  grainCtx.putImageData(img, 0, 0);
}
buildGrain();

export function doPostFX() {
  // chromatic aberration — radial red/blue tint, strength scales with avg speed
  if (PHYS.aberration) {
    const avgSpeed = balls.length ? balls.reduce((s, b) => s + len(b.vx, b.vy), 0) / balls.length : 0;
    const strength = clamp(1 + avgSpeed * 0.003, 1, 3.5);
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = 0.05;
    const vigR = ctx.createRadialGradient(W.cw / 2, W.ch / 2, Math.min(W.cw, W.ch) * 0.5, W.cw / 2, W.ch / 2, Math.max(W.cw, W.ch) * 0.8);
    vigR.addColorStop(0, 'rgba(0,0,0,0)');
    vigR.addColorStop(1, `rgba(255,80,100,${0.08 * strength})`);
    ctx.fillStyle = vigR;
    ctx.fillRect(-strength, 0, W.cw, W.ch);
    const vigB = ctx.createRadialGradient(W.cw / 2, W.ch / 2, Math.min(W.cw, W.ch) * 0.5, W.cw / 2, W.ch / 2, Math.max(W.cw, W.ch) * 0.8);
    vigB.addColorStop(0, 'rgba(0,0,0,0)');
    vigB.addColorStop(1, `rgba(80,180,255,${0.08 * strength})`);
    ctx.fillStyle = vigB;
    ctx.fillRect(strength, 0, W.cw, W.ch);
    ctx.restore();
  }

  // grain
  if (PHYS.grain) {
    grainT += 0.04;
    ctx.save();
    ctx.globalCompositeOperation = 'overlay';
    const ox = ((grainT * 37) % 1) * -180;
    const oy = ((grainT * 41) % 1) * -180;
    const pat = ctx.createPattern(grainCanvas, 'repeat');
    if (pat) {
      ctx.fillStyle = pat;
      ctx.translate(ox, oy);
      ctx.fillRect(-ox, -oy, W.cw, W.ch);
    }
    ctx.restore();
  }
}

/**
 * Half-resolution bright-pass into bloomCanvas, blur it via `filter`, then
 * composite additively. `canvas.filter = 'blur(...)'` is hardware-accelerated
 * and much cheaper than a hand-rolled convolution.
 */
export function doBloomPass() {
  if (!PHYS.bloom) return;

  bloomCtx.setTransform(0.5, 0, 0, 0.5, 0, 0);
  bloomCtx.fillStyle = '#000';
  bloomCtx.fillRect(0, 0, W.cw, W.ch);

  // glowing balls
  for (const b of balls) {
    const glowAmt = Math.max(b.mat.glow || 0, b.heat * 0.9);
    if (glowAmt < 0.15) continue;
    const r = b.r * (2 + glowAmt);
    const c = PHYS.heatFx && b.heat > 0.3 ? mix(b.mat.color, '#ff6020', b.heat) : b.mat.color;
    const g = bloomCtx.createRadialGradient(b.x, b.y, 0, b.x, b.y, r);
    g.addColorStop(0,   c + 'ff');
    g.addColorStop(0.3, c + '88');
    g.addColorStop(1,   c + '00');
    bloomCtx.fillStyle = g;
    bloomCtx.beginPath(); bloomCtx.arc(b.x, b.y, r, 0, TAU); bloomCtx.fill();
  }

  // spark particles
  for (const p of particles) {
    if (p.type !== 'spark') continue;
    bloomCtx.globalAlpha = p.life / p.maxLife;
    bloomCtx.fillStyle = p.color;
    bloomCtx.beginPath();
    bloomCtx.arc(p.x, p.y, p.size * 2, 0, TAU);
    bloomCtx.fill();
  }
  bloomCtx.globalAlpha = 1;

  // pinball bumpers
  for (const p of W.pegs) {
    if (!p.bumper) continue;
    const g = bloomCtx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 2);
    g.addColorStop(0, 'rgba(255,200,80,0.7)');
    g.addColorStop(1, 'rgba(255,200,80,0)');
    bloomCtx.fillStyle = g;
    bloomCtx.beginPath(); bloomCtx.arc(p.x, p.y, p.r * 2, 0, TAU); bloomCtx.fill();
  }

  // sun
  if (W.solar) {
    const cx = W.cw / 2, cy = W.ch / 2;
    const g = bloomCtx.createRadialGradient(cx, cy, 0, cx, cy, 200);
    g.addColorStop(0,   'rgba(255,220,120,0.8)');
    g.addColorStop(0.6, 'rgba(255,140,40,0.3)');
    g.addColorStop(1,   'rgba(255,140,40,0)');
    bloomCtx.fillStyle = g;
    bloomCtx.beginPath(); bloomCtx.arc(cx, cy, 200, 0, TAU); bloomCtx.fill();
  }

  // blur in-place (draws back into itself at full scale)
  bloomCtx.setTransform(1, 0, 0, 1, 0, 0);
  bloomCtx.filter = 'blur(14px)';
  bloomCtx.drawImage(bloomCanvas, 0, 0);
  bloomCtx.filter = 'none';

  // additive composite
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.9;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.drawImage(bloomCanvas, 0, 0, W.cw, W.ch);
  ctx.restore();
}
