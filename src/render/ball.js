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

/* ------------------------------------------------------------------ */
/*  Material surface micro-textures                                    */
/* ------------------------------------------------------------------ */
/* A small offscreen canvas per material, tiled across the ball body
 * as a `createPattern` with `setTransform` so the pattern rotates with
 * the ball. Bakes once on first use, then reused for all balls of the
 * same material. The pattern is drawn through `overlay` blend at low
 * alpha — preserves the radial gradient shading and highlights under
 * it while adding per-material surface character.                     */
const _texCache = {};
const TEX_SIZE = 96;
function getMatTexture(matName) {
  const cached = _texCache[matName];
  if (cached !== undefined) return cached;
  const c = document.createElement('canvas');
  c.width = TEX_SIZE; c.height = TEX_SIZE;
  const tc = c.getContext('2d');
  tc.clearRect(0, 0, TEX_SIZE, TEX_SIZE);
  switch (matName) {
    case 'STEEL': {
      // brushed metal — dense near-horizontal scratches, light + dark mix
      for (let y = 0; y < TEX_SIZE; y += 0.8) {
        tc.strokeStyle = `rgba(255,255,255,${0.04 + Math.random() * 0.09})`;
        tc.lineWidth = 0.4;
        tc.beginPath(); tc.moveTo(0, y); tc.lineTo(TEX_SIZE, y + (Math.random() - 0.5) * 0.3); tc.stroke();
      }
      for (let i = 0; i < 22; i++) {
        tc.strokeStyle = `rgba(0,0,0,${0.05 + Math.random() * 0.08})`;
        tc.lineWidth = 0.5;
        const y = Math.random() * TEX_SIZE;
        tc.beginPath(); tc.moveTo(0, y); tc.lineTo(TEX_SIZE, y + (Math.random() - 0.5) * 0.4); tc.stroke();
      }
      break;
    }
    case 'RUBBER': {
      // fine dense grain
      const imd = tc.createImageData(TEX_SIZE, TEX_SIZE);
      for (let i = 0; i < imd.data.length; i += 4) {
        const v = (Math.random() - 0.5) * 80;
        imd.data[i]     = clamp255(128 + v);
        imd.data[i + 1] = clamp255(128 + v);
        imd.data[i + 2] = clamp255(128 + v);
        imd.data[i + 3] = 55;
      }
      tc.putImageData(imd, 0, 0);
      break;
    }
    case 'GLASS': {
      // rare tiny bright specks
      for (let i = 0; i < 8; i++) {
        tc.fillStyle = `rgba(255,255,255,${0.35 + Math.random() * 0.4})`;
        tc.beginPath();
        tc.arc(Math.random() * TEX_SIZE, Math.random() * TEX_SIZE, 0.5, 0, TAU);
        tc.fill();
      }
      break;
    }
    case 'BOWLING': {
      // colored polymer flecks
      const cols = ['#b06030', '#70401e', '#201810', '#504030', '#c09070'];
      for (let i = 0; i < 55; i++) {
        tc.fillStyle = cols[Math.floor(Math.random() * cols.length)];
        tc.globalAlpha = 0.4 + Math.random() * 0.35;
        tc.beginPath();
        tc.arc(Math.random() * TEX_SIZE, Math.random() * TEX_SIZE, 0.6 + Math.random() * 1.3, 0, TAU);
        tc.fill();
      }
      tc.globalAlpha = 1;
      break;
    }
    case 'GOLD': {
      // scattered light specks (glitter)
      for (let i = 0; i < 28; i++) {
        tc.fillStyle = `rgba(255,230,150,${0.45 + Math.random() * 0.35})`;
        tc.beginPath();
        tc.arc(Math.random() * TEX_SIZE, Math.random() * TEX_SIZE, 0.4 + Math.random() * 0.6, 0, TAU);
        tc.fill();
      }
      for (let i = 0; i < 12; i++) {
        tc.fillStyle = `rgba(120,80,20,${0.18 + Math.random() * 0.14})`;
        tc.beginPath();
        tc.arc(Math.random() * TEX_SIZE, Math.random() * TEX_SIZE, 0.5 + Math.random() * 0.8, 0, TAU);
        tc.fill();
      }
      break;
    }
    case 'PLASMA': {
      // wavy energy filaments
      for (let i = 0; i < 7; i++) {
        tc.strokeStyle = `rgba(240,180,255,${0.20 + Math.random() * 0.25})`;
        tc.lineWidth = 0.5 + Math.random() * 0.4;
        tc.beginPath();
        const y0 = Math.random() * TEX_SIZE;
        tc.moveTo(0, y0);
        for (let px = 0; px <= TEX_SIZE; px += 6) {
          tc.lineTo(px, y0 + Math.sin((px + i * 14) * 0.12) * (3 + i * 0.7));
        }
        tc.stroke();
      }
      break;
    }
    case 'ICE': {
      // crystalline sparkles
      for (let i = 0; i < 20; i++) {
        tc.fillStyle = `rgba(220,240,255,${0.30 + Math.random() * 0.4})`;
        tc.beginPath();
        tc.arc(Math.random() * TEX_SIZE, Math.random() * TEX_SIZE, 0.4 + Math.random() * 0.5, 0, TAU);
        tc.fill();
      }
      // a few tiny hairline fractures
      for (let i = 0; i < 3; i++) {
        tc.strokeStyle = `rgba(255,255,255,${0.15 + Math.random() * 0.10})`;
        tc.lineWidth = 0.4;
        tc.beginPath();
        const x0 = Math.random() * TEX_SIZE, y0 = Math.random() * TEX_SIZE;
        tc.moveTo(x0, y0);
        tc.lineTo(x0 + (Math.random() - 0.5) * 20, y0 + (Math.random() - 0.5) * 20);
        tc.stroke();
      }
      break;
    }
    case 'NEON': {
      // fine bright fizz
      for (let i = 0; i < 70; i++) {
        tc.fillStyle = `rgba(255,255,255,${0.08 + Math.random() * 0.16})`;
        tc.beginPath();
        tc.arc(Math.random() * TEX_SIZE, Math.random() * TEX_SIZE, 0.4, 0, TAU);
        tc.fill();
      }
      break;
    }
    case 'MAGNET': {
      // iron filing flecks
      for (let i = 0; i < 55; i++) {
        tc.fillStyle = `rgba(40,14,14,${0.35 + Math.random() * 0.35})`;
        tc.beginPath();
        tc.arc(Math.random() * TEX_SIZE, Math.random() * TEX_SIZE, 0.4 + Math.random() * 0.7, 0, TAU);
        tc.fill();
      }
      break;
    }
    case 'MERCURY': {
      // faint surface ripples
      for (let i = 0; i < 5; i++) {
        tc.strokeStyle = `rgba(200,215,225,${0.15 + Math.random() * 0.10})`;
        tc.lineWidth = 0.4;
        tc.beginPath();
        const y0 = Math.random() * TEX_SIZE;
        tc.moveTo(0, y0);
        for (let px = 0; px <= TEX_SIZE; px += 10) {
          tc.lineTo(px, y0 + Math.sin((px + i * 12) * 0.08) * 1.6);
        }
        tc.stroke();
      }
      break;
    }
    case 'OBSIDIAN': {
      // Polished volcanic glass — faint conchoidal striations + sparse glossy
      // bright glints. Dark base so only the brightest micro-highlights read.
      for (let i = 0; i < 5; i++) {
        tc.strokeStyle = `rgba(255,255,255,${0.07 + Math.random() * 0.08})`;
        tc.lineWidth = 0.4;
        tc.beginPath();
        const cx = Math.random() * TEX_SIZE;
        const cy = Math.random() * TEX_SIZE;
        const rad = 20 + Math.random() * 30;
        tc.arc(cx, cy, rad, Math.random() * TAU, Math.random() * TAU + 0.9);
        tc.stroke();
      }
      for (let i = 0; i < 8; i++) {
        tc.fillStyle = `rgba(220,200,255,${0.25 + Math.random() * 0.25})`;
        tc.beginPath();
        tc.arc(Math.random() * TEX_SIZE, Math.random() * TEX_SIZE, 0.4 + Math.random() * 0.7, 0, TAU);
        tc.fill();
      }
      break;
    }
    case 'DIAMOND': {
      // Sparse brilliant facet highlights — bright specks of light
      for (let i = 0; i < 14; i++) {
        tc.fillStyle = `rgba(255,255,255,${0.55 + Math.random() * 0.4})`;
        tc.beginPath();
        tc.arc(Math.random() * TEX_SIZE, Math.random() * TEX_SIZE, 0.5 + Math.random() * 0.8, 0, TAU);
        tc.fill();
      }
      // Dispersion hint — soft rainbow-tinged specks to suggest diamond's
      // characteristic "fire" when the texture catches the light.
      const rainbow = [
        'rgba(255,170,210,0.32)', 'rgba(170,215,255,0.32)',
        'rgba(200,255,215,0.28)', 'rgba(255,220,170,0.28)',
        'rgba(210,180,255,0.30)'
      ];
      for (let i = 0; i < 9; i++) {
        tc.fillStyle = rainbow[i % rainbow.length];
        tc.beginPath();
        tc.arc(Math.random() * TEX_SIZE, Math.random() * TEX_SIZE, 1.4 + Math.random() * 1.8, 0, TAU);
        tc.fill();
      }
      break;
    }
    default:
      _texCache[matName] = null;
      return null;
  }
  _texCache[matName] = c;
  return c;
}
function clamp255(v) { return v < 0 ? 0 : v > 255 ? 255 : v | 0; }

/* ------------------------------------------------------------------ */
/*  Steel-specific environment reflection                              */
/* ------------------------------------------------------------------ */
/* Chrome steel is a near-perfect mirror, so its body doesn't have a
 * colour of its own — what you see IS the environment. To approximate
 * that in 2D we bake a tall sky / horizon / ground panorama once, then
 * tile it vertically across a clipped ball with an offset driven by
 * the ball's rotation. Spinning steel shows a visibly scrolling
 * reflection, which is the single strongest cue for "this is metal."
 */
let _steelEnvCanvas = null;
function getSteelEnv() {
  if (_steelEnvCanvas) return _steelEnvCanvas;
  const C = document.createElement('canvas');
  C.width = 64; C.height = 256;
  const tc = C.getContext('2d');

  // Sky (top 38%) — cool deep zenith fading to near-horizon brightness
  const sky = tc.createLinearGradient(0, 0, 0, C.height * 0.38);
  sky.addColorStop(0,    '#161f33');
  sky.addColorStop(0.55, '#3a5278');
  sky.addColorStop(1,    '#8aa6c8');
  tc.fillStyle = sky;
  tc.fillRect(0, 0, C.width, C.height * 0.38);

  // Horizon band (38-50%) — warm bright strip, the brightest zone on the ball
  const hz = tc.createLinearGradient(0, C.height * 0.38, 0, C.height * 0.50);
  hz.addColorStop(0,   '#d6c090');
  hz.addColorStop(0.4, '#fff3d0');
  hz.addColorStop(1,   '#b87840');
  tc.fillStyle = hz;
  tc.fillRect(0, C.height * 0.38, C.width, C.height * 0.12);

  // Ground (50-100%) — warm dark earth tones fading to black at the base
  const gr = tc.createLinearGradient(0, C.height * 0.50, 0, C.height);
  gr.addColorStop(0,   '#3e3424');
  gr.addColorStop(0.45,'#15110c');
  gr.addColorStop(1,   '#050403');
  tc.fillStyle = gr;
  tc.fillRect(0, C.height * 0.50, C.width, C.height * 0.50);

  // Soft cloud bands in the sky for variation — breaks up the plain gradient
  tc.fillStyle = 'rgba(255,255,255,0.14)';
  tc.beginPath();
  tc.ellipse(C.width * 0.45, C.height * 0.18, C.width * 0.50, C.height * 0.035, 0, 0, TAU);
  tc.fill();
  tc.fillStyle = 'rgba(255,255,255,0.09)';
  tc.beginPath();
  tc.ellipse(C.width * 0.20, C.height * 0.29, C.width * 0.30, C.height * 0.025, 0, 0, TAU);
  tc.fill();

  _steelEnvCanvas = C;
  return C;
}

/** Draw steel's body as a rotation-scrolled env reflection + metallic depth. */
function drawSteelBody(tx, b, offX, offY) {
  const { x, y, r, mat } = b;
  const env = getSteelEnv();

  tx.save();
  tx.beginPath(); tx.arc(x, y, r, 0, TAU); tx.clip();

  // Tile the panorama vertically across the ball with a rotation-driven
  // scroll offset. Vertical world-position adds a small tilt so balls
  // near the top of the scene show more sky than balls near the floor.
  const envH = r * 2.2;
  const worldBias = clamp((y / (W.ch || 1000) - 0.5) * 0.6, -0.5, 0.5);
  const phase = ((b.angle / TAU + worldBias) % 1 + 1) % 1;
  let envY = y - r - phase * envH;
  while (envY + envH > y - r) envY -= envH;
  for (let k = 0; k < 3; k++) {
    tx.drawImage(env, x - r, envY, r * 2, envH);
    envY += envH;
  }

  // Metallic depth — bright highlight biased toward the light, dark fringe
  // at the lower rim. This is on top of the env panorama so the ball reads
  // as 3D rather than a flat textured disc.
  const depth = tx.createRadialGradient(x + offX, y + offY, 0, x, y, r);
  depth.addColorStop(0,   'rgba(255,255,255,0.22)');
  depth.addColorStop(0.5, 'rgba(255,255,255,0)');
  depth.addColorStop(0.9, 'rgba(0,0,0,0.30)');
  depth.addColorStop(1,   'rgba(0,0,0,0.55)');
  tx.fillStyle = depth;
  tx.beginPath(); tx.arc(x, y, r, 0, TAU); tx.fill();

  // Subtle desaturation toward the steel tint — real chrome is slightly
  // cool-blue; pure env reflection would look too vivid.
  tx.globalCompositeOperation = 'multiply';
  tx.fillStyle = withAlpha(mat.color, 0.18);
  tx.beginPath(); tx.arc(x, y, r, 0, TAU); tx.fill();
  tx.globalCompositeOperation = 'source-over';

  tx.restore();
}

function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

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
  // R/G/B at slightly different scales → chromatic aberration. Diamond
  // has much stronger dispersion than glass (that's the literal "fire"),
  // so its spread is nearly 3× wider — the rainbow fringe at the edges
  // reads as a real prism, not just a refractive bubble.
  const spread = b.mat.name === 'DIAMOND' ? 0.055 : 0.020;
  const scales = [ base + spread, base, base - spread ];
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

  // Center-of-mass wobble for dented balls. Each dent removes metal at its
  // location, so the CoM drifts away from the dented side. The drawn body
  // shifts toward the heavy (un-dented) side — as the ball rotates, this
  // traces a tiny orbit, reading as a convincing wobble. Pure visual, no
  // physics impact. Only kicks in once several dents have accumulated.
  let wobbleX = 0, wobbleY = 0;
  if (mat.dentable && b.dents && b.dents.length > 2) {
    let sx = 0, sy = 0, sw = 0;
    for (const d of b.dents) {
      const aa = b.angle + d.localAngle;
      sx += Math.cos(aa) * d.depth;
      sy += Math.sin(aa) * d.depth;
      sw += d.depth;
    }
    if (sw > 0.6) {
      const mag = Math.min(1, (sw - 0.6) * 0.6);
      wobbleX = -(sx / sw) * r * 0.035 * mag;
      wobbleY = -(sy / sw) * r * 0.035 * mag;
    }
  }
  const wobbling = wobbleX !== 0 || wobbleY !== 0;
  if (wobbling) { tx.save(); tx.translate(wobbleX, wobbleY); }

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
  if (!refracted && mat.name === 'STEEL') {
    // Steel replaces the generic metallic body with a rotation-scrolled
    // sky/horizon/ground env panorama — see drawSteelBody above.
    drawSteelBody(tx, b, offX, offY);
  } else {
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
  }

  // Fresnel edge bias — uniform bright rim regardless of light direction.
  tx.save();
  tx.beginPath(); tx.arc(x, y, r, 0, TAU); tx.clip();
  drawFresnelRim(tx, b);

  // metallic faux env — sky + horizon + ground bands.
  // Steel uses its own full env panorama in drawSteelBody, so skip these.
  if (mat.metallic > 0.5 && mat.name !== 'STEEL') {
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

  // Anisotropic brushed streak for steel — a thin bright horizontal band
  // in the ball-local frame, rotated with the ball. This is the "smeared
  // highlight along the brush direction" that separates brushed metal
  // from a plain mirror finish.
  if (mat.name === 'STEEL' && mat.anisotropy > 0) {
    tx.save();
    tx.translate(x, y);
    tx.rotate(b.angle + (mat.brushAxis || 0));
    const streakY = offY * 0.4;
    const bandH = r * 0.20;
    const sg2 = tx.createLinearGradient(0, streakY - bandH, 0, streakY + bandH);
    sg2.addColorStop(0,   'rgba(255,255,255,0)');
    sg2.addColorStop(0.5, `rgba(255,255,255,${0.28 * mat.anisotropy})`);
    sg2.addColorStop(1,   'rgba(255,255,255,0)');
    tx.fillStyle = sg2;
    tx.fillRect(-r * 1.1, streakY - bandH, r * 2.2, bandH * 2);
    tx.restore();
  }
  tx.restore();

  // primary specular (directional). Polished steel has a very tight
  // hotspot plus a wider soft lobe — the dual-lobe structure reads as
  // "real" where a single spot looks like a cartoon reflection.
  const isSteel = (mat.name === 'STEEL');
  const hx = x + offX * 1.3, hy = y + offY * 1.3;
  const hr = r * (isSteel ? 0.085 : (mat.metallic > 0.5 ? 0.26 : 0.18));
  const hg = tx.createRadialGradient(hx, hy, 0, hx, hy, hr);
  hg.addColorStop(0,   'rgba(255,255,255,1.0)');
  hg.addColorStop(0.5, isSteel ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.38)');
  hg.addColorStop(1,   'rgba(255,255,255,0)');
  tx.fillStyle = hg;
  tx.beginPath(); tx.arc(hx, hy, hr, 0, TAU); tx.fill();

  // Wide soft specular lobe — the fuzzy halo surrounding the hotspot on
  // polished metal. Only drawn for steel (other metals use the existing
  // secondary spec below).
  if (isSteel) {
    const hrWide = r * 0.42;
    const hgW = tx.createRadialGradient(hx, hy, 0, hx, hy, hrWide);
    hgW.addColorStop(0,   'rgba(255,255,255,0.22)');
    hgW.addColorStop(0.5, 'rgba(255,255,255,0.07)');
    hgW.addColorStop(1,   'rgba(255,255,255,0)');
    tx.fillStyle = hgW;
    tx.beginPath(); tx.arc(hx, hy, hrWide, 0, TAU); tx.fill();
  }

  if (mat.metallic > 0.3 || mat.refract > 0.4) {
    const hx2 = x + offX * 0.6, hy2 = y + offY * 0.6;
    const hr2 = hr * 0.5;
    const hg2 = tx.createRadialGradient(hx2, hy2, 0, hx2, hy2, hr2);
    hg2.addColorStop(0, 'rgba(255,255,255,0.82)');
    hg2.addColorStop(1, 'rgba(255,255,255,0)');
    tx.fillStyle = hg2;
    tx.beginPath(); tx.arc(hx2, hy2, hr2, 0, TAU); tx.fill();
  }

  // Clearcoat — a sub-pixel bright glint from the thin gloss layer on
  // top of the base metal. Just a tiny pinpoint at the reflection point.
  if (mat.clearcoat) {
    const cc = mat.clearcoat;
    const ccr = r * 0.055;
    const ccx = x + offX * 1.45;
    const ccy = y + offY * 1.45;
    const cg = tx.createRadialGradient(ccx, ccy, 0, ccx, ccy, ccr);
    cg.addColorStop(0, `rgba(255,255,255,${Math.min(1, cc)})`);
    cg.addColorStop(1, 'rgba(255,255,255,0)');
    tx.fillStyle = cg;
    tx.beginPath(); tx.arc(ccx, ccy, ccr, 0, TAU); tx.fill();
  }

  // rotation markers so spin is visible
  tx.save();
  tx.beginPath(); tx.arc(x, y, r, 0, TAU); tx.clip();

  // Magnetic polarity — north/south hemispheres, rotating with the ball.
  // Drawn BEFORE the texture overlay so the iron-filing flecks read on top.
  if (mat.magnetic && b.polarity) {
    const northA = b.angle + (b.polarity < 0 ? Math.PI : 0);
    const nx_ = Math.cos(northA);
    const ny_ = Math.sin(northA);
    const grad = tx.createLinearGradient(x - nx_ * r, y - ny_ * r, x + nx_ * r, y + ny_ * r);
    grad.addColorStop(0,    'rgba(50,110,255,0.42)');    // south (blue)
    grad.addColorStop(0.42, 'rgba(255,255,255,0)');
    grad.addColorStop(0.58, 'rgba(255,255,255,0)');
    grad.addColorStop(1,    'rgba(255,70,70,0.42)');     // north (red)
    tx.fillStyle = grad;
    tx.beginPath(); tx.arc(x, y, r, 0, TAU); tx.fill();
  }

  // Surface micro-texture — brushed-metal for steel, grain for rubber,
  // flecks for bowling, glitter for gold, and so on. Pattern is rotated
  // with the ball via setTransform so it reads as "baked into" the ball,
  // not drifting over it. Overlay blend preserves highlights under it.
  const tex = getMatTexture(mat.name);
  if (tex) {
    const pat = tx.createPattern(tex, 'repeat');
    if (pat && pat.setTransform) {
      const m = new DOMMatrix()
        .translateSelf(x, y)
        .rotateSelf(b.angle * 57.29578);
      pat.setTransform(m);
    }
    tx.save();
    tx.globalAlpha = 0.55;
    tx.globalCompositeOperation = 'overlay';
    tx.fillStyle = pat;
    tx.fillRect(x - r, y - r, r * 2, r * 2);
    tx.restore();
  }

  const mAng = b.angle;
  for (const a of [0, Math.PI]) {
    const mx = x + Math.cos(mAng + a) * r * 0.62;
    const my = y + Math.sin(mAng + a) * r * 0.62;
    tx.fillStyle = darken(bodyColor, 0.6);
    tx.beginPath(); tx.arc(mx, my, r * 0.13, 0, TAU); tx.fill();
  }

  // Hot-metal forge glow — a directed orange/red inner lick when a metallic
  // body is heated. Breathes slightly so it feels alive instead of static.
  if (PHYS.heatFx && b.heat > 0.4 && mat.metallic > 0.4) {
    const hh = Math.min(1, (b.heat - 0.4) / 0.6);
    const breathe = 1 + 0.15 * Math.sin(performance.now() * 0.0032 + b.id);
    const alpha = hh * breathe;
    const hgCol = mat.name === 'GOLD' ? '#ff9830' : '#ff5020';
    const hg = tx.createRadialGradient(x, y, r * 0.05, x, y, r);
    hg.addColorStop(0,    withAlpha(hgCol, 0.38 * alpha));
    hg.addColorStop(0.6,  withAlpha(hgCol, 0.20 * alpha));
    hg.addColorStop(1,    withAlpha(hgCol, 0));
    tx.fillStyle = hg;
    tx.beginPath(); tx.arc(x, y, r, 0, TAU); tx.fill();
  }

  // Ice crystalline interior — sparse white-line lattice inside ice balls,
  // fading out as heat rises (melting erases the crystal structure).
  if (mat.name === 'ICE' && !b.isFragment) {
    const crystalAlpha = Math.max(0, 1 - b.heat * 1.5);
    if (crystalAlpha > 0.05) {
      tx.lineWidth = 0.7;
      tx.strokeStyle = withAlpha('#ffffff', 0.32 * crystalAlpha);
      // Deterministic pattern seeded by ball id so a given ball always has
      // the same lattice — not a new random pattern each frame.
      const seed = b.id * 1337;
      for (let i = 0; i < 4; i++) {
        const s = (seed + i * 97) % 628;
        const e = (seed * 3 + i * 131) % 628;
        const a1 = (s / 100) + b.angle;
        const a2 = (e / 100) + b.angle;
        const r1 = r * (0.35 + (seed >> i) % 50 / 100);
        const r2 = r * (0.55 + ((seed >> (i + 2)) % 40) / 100);
        tx.beginPath();
        tx.moveTo(x + Math.cos(a1) * r1, y + Math.sin(a1) * r1);
        tx.lineTo(x + Math.cos(a2) * r2, y + Math.sin(a2) * r2);
        tx.stroke();
      }
      // a faint frosty sparkle dot
      tx.fillStyle = withAlpha('#ffffff', 0.45 * crystalAlpha);
      const sa = b.angle * 1.1;
      tx.beginPath();
      tx.arc(x + Math.cos(sa) * r * 0.35, y + Math.sin(sa) * r * 0.35, 0.9, 0, TAU);
      tx.fill();
    }
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

  // Diamond brilliance — flickering cross-stars at fixed ball-local angles,
  // additive-blended so they genuinely glint. Each star has its own drift
  // in radius + brightness so they don't pulse in lockstep. Drawn OUTSIDE
  // the squash transform (pinned to world) so they don't jump on impacts.
  if (mat.name === 'DIAMOND' && !b.isFragment) {
    tx.save();
    tx.beginPath(); tx.arc(x, y, r, 0, TAU); tx.clip();
    tx.globalCompositeOperation = 'lighter';
    tx.lineCap = 'round';
    const now = performance.now();
    const count = 3;
    for (let i = 0; i < count; i++) {
      const localA = (i / count) * TAU + 0.55 + b.id * 0.17;
      const aa = b.angle + localA;
      const radial = 0.40 + 0.30 * Math.sin(now * 0.0022 + i * 2.3 + b.id);
      const px = x + Math.cos(aa) * r * radial;
      const py = y + Math.sin(aa) * r * radial;
      const twinkle = 0.5 + 0.5 * Math.sin(now * 0.0038 + i * 1.7 + b.id * 1.3);
      const ss = r * 0.22 * (0.6 + 0.4 * twinkle);
      const alpha = 0.50 * twinkle + 0.15;
      tx.strokeStyle = `rgba(255,255,255,${alpha})`;
      tx.lineWidth = 0.9;
      tx.beginPath();
      tx.moveTo(px - ss, py); tx.lineTo(px + ss, py);
      tx.moveTo(px, py - ss); tx.lineTo(px, py + ss);
      tx.stroke();
      // thinner diagonal rays for that gem-sparkle shape
      const diag = ss * 0.60;
      tx.lineWidth = 0.45;
      tx.beginPath();
      tx.moveTo(px - diag, py - diag); tx.lineTo(px + diag, py + diag);
      tx.moveTo(px - diag, py + diag); tx.lineTo(px + diag, py - diag);
      tx.stroke();
      // tiny solid core
      tx.fillStyle = `rgba(255,255,255,${alpha + 0.3})`;
      tx.beginPath(); tx.arc(px, py, 0.95, 0, TAU); tx.fill();
    }
    tx.restore();
  }

  // Fragile-ball cracks — same pin-to-world-surface pattern as dents.
  // Each crack is a short dark line extending inward from the impact
  // point, with an optional sub-branch for deeper cracks. Drawn slightly
  // inside the clip (r * 0.97) so the line ends are clipped cleanly.
  if (mat.fragile && b.cracks && b.cracks.length) {
    tx.save();
    tx.beginPath(); tx.arc(x, y, r, 0, TAU); tx.clip();
    const crackCol =
      mat.name === 'ICE'      ? 'rgba(60,100,140,0.85)' :
      mat.name === 'DIAMOND'  ? 'rgba(180,210,240,0.80)' :
      mat.name === 'OBSIDIAN' ? 'rgba(150,120,170,0.75)' :
                                'rgba(30,50,80,0.85)';
    tx.lineCap = 'round';
    tx.strokeStyle = crackCol;
    for (const c of b.cracks) {
      const aa = b.angle + c.localAngle;
      const x0 = x + Math.cos(aa) * r * 0.96;
      const y0 = y + Math.sin(aa) * r * 0.96;
      const da = aa + Math.PI + c.angle; // inward + wander
      const L = r * c.length * 0.55;
      const x1 = x0 + Math.cos(da) * L;
      const y1 = y0 + Math.sin(da) * L;
      tx.lineWidth = 1.1;
      tx.beginPath();
      tx.moveTo(x0, y0); tx.lineTo(x1, y1);
      tx.stroke();
      // a small fork at the midpoint for deeper cracks
      if (c.length > 0.6) {
        const mx = x0 + Math.cos(da) * L * 0.55;
        const my = y0 + Math.sin(da) * L * 0.55;
        const fa = da + (c.localAngle > 0 ? 0.9 : -0.9);
        tx.lineWidth = 0.7;
        tx.beginPath();
        tx.moveTo(mx, my);
        tx.lineTo(mx + Math.cos(fa) * L * 0.35, my + Math.sin(fa) * L * 0.35);
        tx.stroke();
      }
    }
    tx.restore();
  }

  // Gold dents — drawn AFTER the squash transform restore so they stay
  // pinned to the ball's actual world-space surface. (Inside the squash
  // transform, every hit changes `squashAng` and visibly re-rotates every
  // stored dent, which is why they looked like they weren't at the impact
  // site.) Ball-local angle is converted to world via `b.angle + localAngle`.
  if (mat.dentable && b.dents && b.dents.length) {
    tx.save();
    tx.beginPath(); tx.arc(x, y, r, 0, TAU); tx.clip();
    for (const d of b.dents) {
      const aa = b.angle + d.localAngle;
      const cosA = Math.cos(aa), sinA = Math.sin(aa);
      const dx = x + cosA * r * 0.80;
      const dy = y + sinA * r * 0.80;
      const dr = r * (0.22 + 0.30 * d.depth);
      // 1. raised rim — hammered gold bulges outward around the pit
      const rg = tx.createRadialGradient(dx, dy, dr * 0.75, dx, dy, dr * 1.15);
      rg.addColorStop(0,   withAlpha('#6a4a10', 0));
      rg.addColorStop(0.4, withAlpha('#ffe6a0', 0.45 * d.depth));
      rg.addColorStop(1,   withAlpha('#6a4a10', 0));
      tx.fillStyle = rg;
      tx.beginPath(); tx.arc(dx, dy, dr * 1.15, 0, TAU); tx.fill();
      // 2. dark crater body
      const dg = tx.createRadialGradient(dx, dy, 0, dx, dy, dr);
      dg.addColorStop(0,    withAlpha('#120700', 0.85 * d.depth));
      dg.addColorStop(0.55, withAlpha('#3a2000', 0.55 * d.depth));
      dg.addColorStop(1,    withAlpha('#3a2000', 0));
      tx.fillStyle = dg;
      tx.beginPath(); tx.arc(dx, dy, dr, 0, TAU); tx.fill();
      // 3. inner-wall shadow crescent — the far side of the pit
      const sx = dx + cosA * dr * 0.30;
      const sy = dy + sinA * dr * 0.30;
      const sg = tx.createRadialGradient(sx, sy, 0, sx, sy, dr * 0.70);
      sg.addColorStop(0, withAlpha('#000000', 0.55 * d.depth));
      sg.addColorStop(1, withAlpha('#000000', 0));
      tx.fillStyle = sg;
      tx.beginPath(); tx.arc(sx, sy, dr * 0.70, 0, TAU); tx.fill();
    }
    tx.restore();
  }

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
  if (wobbling) tx.restore();
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
