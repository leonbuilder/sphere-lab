/**
 * Per-ball shading. A single call to `drawBall(tx, b)` emits:
 *   - a motion streak tail (if fast enough)
 *   - a glass refraction pass sampling `sceneCanvas` (if mat.refract > 0.3)
 *   - a heat / material glow halo
 *   - a main body gradient (metallic / semi-metallic / diffuse branches)
 *   - rim lighting + a metallic env map (sky + horizon + ground)
 *   - primary + secondary specular highlights
 *   - rotation markers
 *   - a subtle outline
 *   - pinned/charge indicators
 *   - optional velocity/spin vector overlay (when PHYS.showVec is on)
 *
 * Also contains `drawTrail` — the faint line behind a ball when trails
 * are enabled.
 */

import { W } from '../core/world.js';
import { PHYS } from '../core/config.js';
import { TAU, len } from '../core/math.js';
import { mix, lighten, darken } from '../core/color.js';
import { light, sceneCanvas } from './canvas.js';

/** Glass lens — sample the pre-rendered sceneCanvas scaled around the ball. */
/** @param {CanvasRenderingContext2D} tx @param {import('../entities/ball.js').Ball} b */
function drawRefraction(tx, b) {
  if (!PHYS.refract || (b.mat.refract || 0) < 0.3) return false;
  tx.save();
  tx.beginPath(); tx.arc(b.x, b.y, b.r * 0.96, 0, TAU); tx.clip();
  const scale = 1 - b.mat.refract * 0.25;
  const ox = b.x - b.x * scale;
  const oy = b.y - b.y * scale;
  tx.globalAlpha = 0.9;
  tx.drawImage(sceneCanvas, ox, oy, W.cw * scale, W.ch * scale);
  tx.globalAlpha = 1;
  tx.fillStyle = b.mat.color + '28';
  tx.beginPath(); tx.arc(b.x, b.y, b.r, 0, TAU); tx.fill();
  tx.restore();
  return true;
}

/** Fading after-images behind a fast ball. */
function drawMotionStreak(tx, b) {
  if (!PHYS.streaks) return;
  const sp = len(b.vx, b.vy);
  if (sp < 260) return;
  const steps = Math.min(6, Math.floor(sp / 120));
  const baseColor = b.effectiveColor();
  for (let i = steps; i >= 1; i--) {
    const t = i / steps;
    const px = b.x - b.vx * 0.012 * i;
    const py = b.y - b.vy * 0.012 * i;
    const rr = b.r * (1 - t * 0.15);
    tx.globalAlpha = 0.25 * (1 - t);
    const grad = tx.createRadialGradient(px, py, 0, px, py, rr);
    grad.addColorStop(0, lighten(baseColor, 0.3));
    grad.addColorStop(1, baseColor + '00');
    tx.fillStyle = grad;
    tx.beginPath(); tx.arc(px, py, rr, 0, TAU); tx.fill();
  }
  tx.globalAlpha = 1;
}

/** @param {CanvasRenderingContext2D} tx @param {import('../entities/ball.js').Ball} b */
export function drawBall(tx, b) {
  const { x, y, r, mat } = b;
  const squashAmt = b.squash;

  drawMotionStreak(tx, b);

  // squash transform (applied around the ball center)
  tx.save();
  tx.translate(x, y);
  tx.rotate(b.squashAng);
  const rx = r * squashAmt, ry = r * (1 + (1 - squashAmt) * 0.28);
  tx.scale(rx / r, ry / r);
  tx.translate(-x, -y);

  const refracted = drawRefraction(tx, b);

  // light direction → highlight offset
  const lx = light.x * W.cw, ly = light.y * W.ch;
  const ldx = x - lx, ldy = y - ly;
  const ldlen = len(ldx, ldy) || 1;
  const offX = -ldx / ldlen * r * 0.45;
  const offY = -ldy / ldlen * r * 0.45;

  // halo glow (material glow + hot ball glow)
  const hotGlow = PHYS.heatFx && b.heat > 0.15;
  const glowAmt = Math.max(mat.glow || 0, b.heat * 0.9);
  if (glowAmt > 0.05) {
    const gr = r * (2 + glowAmt);
    const g = tx.createRadialGradient(x, y, r * 0.8, x, y, gr);
    const gc = hotGlow ? mix(mat.color, '#ff6020', b.heat) : mat.color;
    g.addColorStop(0,    gc + (hotGlow ? 'cc' : 'bb'));
    g.addColorStop(0.45, gc + '44');
    g.addColorStop(1,    gc + '00');
    tx.fillStyle = g;
    tx.beginPath(); tx.arc(x, y, gr, 0, TAU); tx.fill();
  }

  // main body gradient
  const bodyColor = b.effectiveColor();
  const g = tx.createRadialGradient(x + offX, y + offY, 0, x, y, r);
  if (refracted) {
    g.addColorStop(0,   'rgba(255,255,255,0.6)');
    g.addColorStop(0.5, 'rgba(255,255,255,0.05)');
    g.addColorStop(1,   'rgba(0,0,0,0.35)');
  } else if (mat.metallic > 0.7) {
    g.addColorStop(0,    '#ffffff');
    g.addColorStop(0.3,  lighten(bodyColor, 0.4));
    g.addColorStop(0.65, bodyColor);
    g.addColorStop(0.9,  darken(bodyColor, 0.5));
    g.addColorStop(1,    darken(bodyColor, 0.7));
  } else if (mat.metallic > 0.3) {
    g.addColorStop(0,   lighten(bodyColor, 0.65));
    g.addColorStop(0.5, bodyColor);
    g.addColorStop(1,   darken(bodyColor, 0.55));
  } else {
    g.addColorStop(0,   lighten(bodyColor, 0.55));
    g.addColorStop(0.6, bodyColor);
    g.addColorStop(1,   darken(bodyColor, 0.45));
  }
  tx.fillStyle = g;
  tx.beginPath(); tx.arc(x, y, r, 0, TAU); tx.fill();

  // rim light + metallic faux env map
  tx.save();
  tx.beginPath(); tx.arc(x, y, r, 0, TAU); tx.clip();
  const rg = tx.createRadialGradient(x - offX * 1.1, y - offY * 1.1, r * 0.8, x, y, r);
  rg.addColorStop(0, 'rgba(255,255,255,0)');
  rg.addColorStop(1, mat.metallic > 0.5 ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.15)');
  tx.fillStyle = rg;
  tx.fillRect(x - r, y - r, r * 2, r * 2);

  if (mat.metallic > 0.5) {
    // sky band (top)
    const sg = tx.createLinearGradient(x, y - r, x, y);
    sg.addColorStop(0,   'rgba(255,255,255,0.45)');
    sg.addColorStop(0.5, 'rgba(255,255,255,0.12)');
    sg.addColorStop(1,   'rgba(255,255,255,0)');
    tx.fillStyle = sg;
    tx.fillRect(x - r, y - r, r * 2, r);

    // horizon line
    const hgEnv = tx.createLinearGradient(x, y + r * 0.1, x, y + r * 0.4);
    hgEnv.addColorStop(0,   'rgba(255,255,255,0)');
    hgEnv.addColorStop(0.5, 'rgba(255,240,200,0.2)');
    hgEnv.addColorStop(1,   'rgba(255,255,255,0)');
    tx.fillStyle = hgEnv;
    tx.fillRect(x - r, y + r * 0.1, r * 2, r * 0.3);

    // ground reflection
    const gg = tx.createLinearGradient(x, y + r * 0.5, x, y + r);
    gg.addColorStop(0, 'rgba(0,0,0,0)');
    gg.addColorStop(1, 'rgba(0,0,0,0.25)');
    tx.fillStyle = gg;
    tx.fillRect(x - r, y + r * 0.5, r * 2, r * 0.5);
  }
  tx.restore();

  // primary specular
  const hx = x + offX * 1.3, hy = y + offY * 1.3;
  const hr = r * (mat.metallic > 0.5 ? 0.24 : 0.17);
  const hg = tx.createRadialGradient(hx, hy, 0, hx, hy, hr);
  hg.addColorStop(0,   'rgba(255,255,255,0.95)');
  hg.addColorStop(0.5, 'rgba(255,255,255,0.35)');
  hg.addColorStop(1,   'rgba(255,255,255,0)');
  tx.fillStyle = hg;
  tx.beginPath(); tx.arc(hx, hy, hr, 0, TAU); tx.fill();

  if (mat.metallic > 0.3 || mat.refract > 0.4) {
    const hx2 = x + offX * 0.6, hy2 = y + offY * 0.6;
    const hr2 = hr * 0.5;
    const hg2 = tx.createRadialGradient(hx2, hy2, 0, hx2, hy2, hr2);
    hg2.addColorStop(0, 'rgba(255,255,255,0.8)');
    hg2.addColorStop(1, 'rgba(255,255,255,0)');
    tx.fillStyle = hg2;
    tx.beginPath(); tx.arc(hx2, hy2, hr2, 0, TAU); tx.fill();
  }

  // rotation dots so spin is visible
  tx.save();
  tx.beginPath(); tx.arc(x, y, r, 0, TAU); tx.clip();
  const mAng = b.angle;
  for (const a of [0, Math.PI]) {
    const mx = x + Math.cos(mAng + a) * r * 0.62;
    const my = y + Math.sin(mAng + a) * r * 0.62;
    tx.fillStyle = darken(bodyColor, 0.6);
    tx.beginPath(); tx.arc(mx, my, r * 0.13, 0, TAU); tx.fill();
  }
  tx.restore();

  // outline
  tx.strokeStyle = darken(bodyColor, 0.75);
  tx.lineWidth = 0.8;
  tx.beginPath(); tx.arc(x, y, r, 0, TAU); tx.stroke();

  if (b.pinned) {
    tx.strokeStyle = '#ffffff'; tx.lineWidth = 1.3;
    tx.beginPath(); tx.arc(x, y, r + 3, 0, TAU); tx.stroke();
    tx.fillStyle = '#ffffff';
    tx.fillRect(x - 1, y - r - 8, 2, 6);
  }
  if (b.charge !== 0) {
    tx.strokeStyle = b.charge > 0 ? '#ff4060' : '#4080ff';
    tx.lineWidth = 1.5;
    tx.beginPath(); tx.arc(x, y, r + 4, 0, TAU); tx.stroke();
  }
  tx.restore();

  // debug vectors
  if (PHYS.showVec) {
    const sp = len(b.vx, b.vy);
    if (sp > 10) {
      const sc = 0.08;
      const ex = x + b.vx * sc, ey = y + b.vy * sc;
      tx.strokeStyle = '#4affb4';
      tx.lineWidth = 1.5;
      tx.beginPath(); tx.moveTo(x, y); tx.lineTo(ex, ey); tx.stroke();
      const ang = Math.atan2(b.vy, b.vx);
      tx.beginPath();
      tx.moveTo(ex, ey); tx.lineTo(ex - Math.cos(ang - 0.35) * 8, ey - Math.sin(ang - 0.35) * 8);
      tx.moveTo(ex, ey); tx.lineTo(ex - Math.cos(ang + 0.35) * 8, ey - Math.sin(ang + 0.35) * 8);
      tx.stroke();
    }
    if (Math.abs(b.omega) > 1) {
      tx.strokeStyle = '#ffb340';
      tx.lineWidth = 1;
      tx.beginPath();
      const da = Math.min(Math.PI * 1.5, Math.abs(b.omega) * 0.25);
      tx.arc(x, y, r + 6, 0, da * Math.sign(b.omega), b.omega < 0);
      tx.stroke();
    }
  }
}

/** Faint polyline of recent positions (when PHYS.trails is on). */
export function drawTrail(tx, b) {
  if (!b.trail || b.trail.length < 2) return;
  tx.strokeStyle = b.mat.color + '55';
  tx.lineWidth = 2; tx.lineCap = 'round';
  tx.beginPath();
  for (let i = 0; i < b.trail.length; i++) {
    const pt = b.trail[i];
    if (i === 0) tx.moveTo(pt.x, pt.y); else tx.lineTo(pt.x, pt.y);
  }
  tx.stroke();
}
