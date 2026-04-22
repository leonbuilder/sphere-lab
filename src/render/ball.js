/**
 * Per-ball shading. Highlights:
 *
 *   - Chromatic refraction for glass: samples sceneCanvas three times at
 *     slightly different scales for R/G/B, blending them into the ball's
 *     clipped interior. Cheap but recognisable rainbow edges.
 *
 *   - Material-aware body gradient:
 *       metallic > 0.7 — near-mirror, sharp core highlight + darker fringe
 *       metallic > 0.3 — satin finish, softer transitions
 *       else            — matte/diffuse, long lerp to darker rim
 *
 *   - Fresnel-style rim light: a concentric bright ring that doesn't depend
 *     on the light direction, brighter on metals and on grazing-view (edge)
 *     pixels. Stacked on top of any directional rim.
 *
 *   - Metallic env strip: horizontal bands approximating a sky / horizon /
 *     ground reflection for polished metals.
 */

import { W } from '../core/world.js';
import { PHYS } from '../core/config.js';
import { TAU, len } from '../core/math.js';
import { mix, lighten, darken, withAlpha } from '../core/color.js';
import { light, sceneCanvas } from './canvas.js';

/**
 * Glass refraction with a small chromatic split: sample sceneCanvas three
 * times at slightly different scales (R wider, B tighter) and blend via
 * `screen` blending — gives a subtle color fringe on edges.
 */
function drawRefraction(tx, b) {
  if (!PHYS.refract || (b.mat.refract || 0) < 0.3) return false;
  tx.save();
  tx.beginPath(); tx.arc(b.x, b.y, b.r * 0.96, 0, TAU); tx.clip();

  const base = 1 - b.mat.refract * 0.25;
  // R/G/B at subtly different scales → chromatic aberration
  const scales = [ base + 0.020, base, base - 0.020 ];
  const filters = ['red', 'green', 'blue'];

  for (let i = 0; i < 3; i++) {
    const s = scales[i];
    const ox = b.x - b.x * s;
    const oy = b.y - b.y * s;
    tx.globalAlpha = 0.55;
    tx.globalCompositeOperation = i === 0 ? 'source-over' : 'lighter';
    // tint by drawing the sceneCanvas once per channel with a colored overlay
    tx.drawImage(sceneCanvas, ox, oy, W.cw * s, W.ch * s);
  }
  tx.globalCompositeOperation = 'source-over';
  tx.globalAlpha = 1;

  // glass tint
  tx.fillStyle = withAlpha(b.mat.color, 0.16);
  tx.beginPath(); tx.arc(b.x, b.y, b.r, 0, TAU); tx.fill();
  tx.restore();
  return true;
}

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
    grad.addColorStop(1, withAlpha(baseColor, 0));
    tx.fillStyle = grad;
    tx.beginPath(); tx.arc(px, py, rr, 0, TAU); tx.fill();
  }
  tx.globalAlpha = 1;
}

/**
 * Concentric Fresnel rim. Bright near the edge for all materials, extra
 * bright for metals. Implemented as a thin annular gradient — no angle
 * dependence on camera (we're 2D) but a genuine edge bias.
 */
function drawFresnelRim(tx, b) {
  const inner = b.r * 0.70;
  const outer = b.r * 1.0;
  const g = tx.createRadialGradient(b.x, b.y, inner, b.x, b.y, outer);
  const baseAlpha = b.mat.metallic > 0.5 ? 0.55 : 0.28;
  g.addColorStop(0,    'rgba(255,255,255,0)');
  g.addColorStop(0.75, withAlpha('#ffffff', baseAlpha * 0.15));
  g.addColorStop(1,    withAlpha('#ffffff', baseAlpha));
  tx.fillStyle = g;
  tx.beginPath(); tx.arc(b.x, b.y, b.r, 0, TAU); tx.fill();
}

export function drawBall(tx, b) {
  const { x, y, r, mat } = b;
  const squashAmt = b.squash;

  // fade fragments in their last 0.8 s of life
  let alphaScale = 1;
  if (b.lifespan !== undefined && b.lifespan < 0.8) {
    alphaScale = Math.max(0, b.lifespan / 0.8);
    tx.save();
    tx.globalAlpha = alphaScale;
  }

  drawMotionStreak(tx, b);

  tx.save();
  tx.translate(x, y);
  tx.rotate(b.squashAng);
  const rx = r * squashAmt, ry = r * (1 + (1 - squashAmt) * 0.28);
  tx.scale(rx / r, ry / r);
  tx.translate(-x, -y);

  const refracted = drawRefraction(tx, b);

  const lx = light.x * W.cw, ly = light.y * W.ch;
  const ldx = x - lx, ldy = y - ly;
  const ldlen = len(ldx, ldy) || 1;
  const offX = -ldx / ldlen * r * 0.45;
  const offY = -ldy / ldlen * r * 0.45;

  const hotGlow = PHYS.heatFx && b.heat > 0.15;
  const glowAmt = Math.max(mat.glow || 0, b.heat * 0.9);
  if (glowAmt > 0.05) {
    const gr = r * (2 + glowAmt);
    const g = tx.createRadialGradient(x, y, r * 0.8, x, y, gr);
    const gc = hotGlow ? mix(mat.color, '#ff6020', b.heat) : mat.color;
    g.addColorStop(0,    withAlpha(gc, hotGlow ? 0.8 : 0.73));
    g.addColorStop(0.45, withAlpha(gc, 0.27));
    g.addColorStop(1,    withAlpha(gc, 0));
    tx.fillStyle = g;
    tx.beginPath(); tx.arc(x, y, gr, 0, TAU); tx.fill();
  }

  const bodyColor = b.effectiveColor();
  const g = tx.createRadialGradient(x + offX, y + offY, 0, x, y, r);
  if (refracted) {
    g.addColorStop(0,   'rgba(255,255,255,0.55)');
    g.addColorStop(0.5, 'rgba(255,255,255,0.04)');
    g.addColorStop(1,   'rgba(0,0,0,0.32)');
  } else if (mat.metallic > 0.7) {
    // near-mirror: sharp hot core + deep dark fringe
    g.addColorStop(0,    '#ffffff');
    g.addColorStop(0.28, lighten(bodyColor, 0.5));
    g.addColorStop(0.6,  bodyColor);
    g.addColorStop(0.88, darken(bodyColor, 0.55));
    g.addColorStop(1,    darken(bodyColor, 0.78));
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

  // Fresnel edge bias — uniform bright rim regardless of light direction.
  tx.save();
  tx.beginPath(); tx.arc(x, y, r, 0, TAU); tx.clip();
  drawFresnelRim(tx, b);

  // metallic faux env — sky + horizon + ground bands
  if (mat.metallic > 0.5) {
    const sg = tx.createLinearGradient(x, y - r, x, y);
    sg.addColorStop(0,   'rgba(255,255,255,0.5)');
    sg.addColorStop(0.5, 'rgba(255,255,255,0.15)');
    sg.addColorStop(1,   'rgba(255,255,255,0)');
    tx.fillStyle = sg;
    tx.fillRect(x - r, y - r, r * 2, r);

    const hgEnv = tx.createLinearGradient(x, y + r * 0.08, x, y + r * 0.38);
    hgEnv.addColorStop(0,   'rgba(255,255,255,0)');
    hgEnv.addColorStop(0.5, 'rgba(255,240,200,0.22)');
    hgEnv.addColorStop(1,   'rgba(255,255,255,0)');
    tx.fillStyle = hgEnv;
    tx.fillRect(x - r, y + r * 0.08, r * 2, r * 0.32);

    const gg = tx.createLinearGradient(x, y + r * 0.5, x, y + r);
    gg.addColorStop(0, 'rgba(0,0,0,0)');
    gg.addColorStop(1, 'rgba(0,0,0,0.35)');
    tx.fillStyle = gg;
    tx.fillRect(x - r, y + r * 0.5, r * 2, r * 0.5);
  }
  tx.restore();

  // primary specular (directional)
  const hx = x + offX * 1.3, hy = y + offY * 1.3;
  const hr = r * (mat.metallic > 0.5 ? 0.26 : 0.18);
  const hg = tx.createRadialGradient(hx, hy, 0, hx, hy, hr);
  hg.addColorStop(0,   'rgba(255,255,255,0.98)');
  hg.addColorStop(0.5, 'rgba(255,255,255,0.38)');
  hg.addColorStop(1,   'rgba(255,255,255,0)');
  tx.fillStyle = hg;
  tx.beginPath(); tx.arc(hx, hy, hr, 0, TAU); tx.fill();

  if (mat.metallic > 0.3 || mat.refract > 0.4) {
    const hx2 = x + offX * 0.6, hy2 = y + offY * 0.6;
    const hr2 = hr * 0.5;
    const hg2 = tx.createRadialGradient(hx2, hy2, 0, hx2, hy2, hr2);
    hg2.addColorStop(0, 'rgba(255,255,255,0.82)');
    hg2.addColorStop(1, 'rgba(255,255,255,0)');
    tx.fillStyle = hg2;
    tx.beginPath(); tx.arc(hx2, hy2, hr2, 0, TAU); tx.fill();
  }

  // rotation markers so spin is visible
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

  // sleeping balls get a subtle z (only visible with vectors toggle)
  if (b.sleeping && PHYS.showVec) {
    tx.fillStyle = withAlpha('#6fb9ff', 0.55);
    tx.font = '10px JetBrains Mono, monospace';
    tx.textAlign = 'center';
    tx.fillText('z', x, y - r - 6);
  }

  tx.restore();

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

  if (b.lifespan !== undefined && b.lifespan < 0.8) {
    tx.restore();
  }
}

export function drawTrail(tx, b) {
  if (!b.trail || b.trail.length < 2) return;
  tx.strokeStyle = withAlpha(b.mat.color, 0.33);
  tx.lineWidth = 2; tx.lineCap = 'round';
  tx.beginPath();
  for (let i = 0; i < b.trail.length; i++) {
    const pt = b.trail[i];
    if (i === 0) tx.moveTo(pt.x, pt.y); else tx.lineTo(pt.x, pt.y);
  }
  tx.stroke();
}
