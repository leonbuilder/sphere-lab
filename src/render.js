'use strict';

/* Rendering pipeline — fully 2D canvas, with:
   - a half-resolution bloom buffer (offscreen canvas + filter blur)
   - a scene snapshot canvas used as a texture source for glass refraction
   - a precomputed grain tile for cheap film-grain overlay
   - per-scene animated backdrops (stars/nebula/vortex streaks/felt)
   Everything is pure: no simulation state is mutated here. */

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
let dpr = 1;

// offscreen buffers
const bloomCanvas = document.createElement('canvas');
const bloomCtx = bloomCanvas.getContext('2d');
const sceneCanvas = document.createElement('canvas');
const sceneCtx = sceneCanvas.getContext('2d');

function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width  = Math.floor(window.innerWidth  * dpr);
  canvas.height = Math.floor(window.innerHeight * dpr);
  canvas.style.width  = window.innerWidth  + 'px';
  canvas.style.height = window.innerHeight + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  W.cw = window.innerWidth;
  W.ch = window.innerHeight;
  bloomCanvas.width  = Math.floor(W.cw * 0.5);
  bloomCanvas.height = Math.floor(W.ch * 0.5);
  sceneCanvas.width  = Math.floor(W.cw);
  sceneCanvas.height = Math.floor(W.ch);
}

/* primary scene light direction (0..1 relative to canvas) */
const light = { x: 0.28, y: 0.24 };

/* persistent starfield for solar scene */
let BG_STARS = null;
function ensureStars() {
  if (BG_STARS) return;
  BG_STARS = [];
  for (let i = 0; i < 400; i++) {
    BG_STARS.push({
      x: Math.random() * 2000, y: Math.random() * 2000,
      s: Math.random() * 1.8 + 0.3,
      tw: Math.random() * TAU,
      c: pick(['#ffffff', '#aaccff', '#ffddaa', '#ddddff'])
    });
  }
}
ensureStars();

function drawBackground(tx) {
  // radial base gradient gives a "depth" feel
  const g = tx.createRadialGradient(W.cw / 2, W.ch * 0.35, 40, W.cw / 2, W.ch / 2, Math.max(W.cw, W.ch) * 0.75);
  g.addColorStop(0,   lighten(W.bgColor1, 0.08));
  g.addColorStop(0.6, W.bgColor1);
  g.addColorStop(1,   W.bgColor2);
  tx.fillStyle = g;
  tx.fillRect(0, 0, W.cw, W.ch);

  const t = performance.now() * 0.001;

  if (W.scene === 'solar') {
    for (const st of BG_STARS) {
      const x = st.x % W.cw, y = st.y % W.ch;
      const tw = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * 2 + st.tw));
      tx.fillStyle = st.c;
      tx.globalAlpha = tw * 0.9;
      tx.fillRect(x, y, st.s, st.s);
    }
    tx.globalAlpha = 1;
    for (let i = 0; i < 3; i++) {
      const cx = (i * 0.37 + t * 0.008) % 1.2 * W.cw;
      const cy = (i * 0.29) % 1 * W.ch;
      const rg = tx.createRadialGradient(cx, cy, 0, cx, cy, 400);
      rg.addColorStop(0, ['rgba(100,50,200,0.10)', 'rgba(200,50,100,0.08)', 'rgba(50,100,200,0.09)'][i]);
      rg.addColorStop(1, 'rgba(0,0,0,0)');
      tx.fillStyle = rg;
      tx.fillRect(0, 0, W.cw, W.ch);
    }
  } else if (W.scene === 'vortex') {
    tx.strokeStyle = 'rgba(200,120,255,0.05)';
    tx.lineWidth = 1;
    for (let r = 80; r < 900; r += 30) {
      tx.beginPath();
      for (let a = 0; a < TAU + 0.1; a += 0.08) {
        const rr = r + Math.sin(a * 4 + t * 0.6 + r * 0.02) * 8;
        const x = W.cw / 2 + Math.cos(a) * rr;
        const y = W.ch / 2 + Math.sin(a) * rr;
        if (a === 0) tx.moveTo(x, y); else tx.lineTo(x, y);
      }
      tx.stroke();
    }
  } else if (W.scene === 'billiards') {
    tx.fillStyle = 'rgba(255,255,255,0.015)';
    for (let i = 0; i < 2000; i++) {
      const x = ((i * 7919) % 10000) * W.cw / 10000;
      const y = ((i * 6151) % 10000) * W.ch / 10000;
      tx.fillRect(x, y, 1, 1);
    }
  } else if (W.scene === 'cloth') {
    for (let i = 0; i < 8; i++) {
      tx.fillStyle = `rgba(${80 + i * 8},${60 + i * 5},${120 + i * 10},0.03)`;
      tx.fillRect(0, i * W.ch / 8, W.cw, W.ch / 8);
    }
  }

  // animated world-space grid
  tx.strokeStyle = 'rgba(255,255,255,0.018)';
  tx.lineWidth = 1;
  const step = 40;
  const ox = ((cam.x % step) + step) % step;
  const oy = ((cam.y % step) + step) % step;
  tx.beginPath();
  for (let x = -ox; x < W.cw + step; x += step) { tx.moveTo(x, 0); tx.lineTo(x, W.ch); }
  for (let y = -oy; y < W.ch + step; y += step) { tx.moveTo(0, y); tx.lineTo(W.cw, y); }
  tx.stroke();

  // vignette
  const vg = tx.createRadialGradient(
    W.cw / 2, W.ch / 2, Math.min(W.cw, W.ch) * 0.38,
    W.cw / 2, W.ch / 2, Math.max(W.cw, W.ch) * 0.82
  );
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,0.65)');
  tx.fillStyle = vg;
  tx.fillRect(0, 0, W.cw, W.ch);
}

function drawWalls(tx) {
  tx.strokeStyle = '#4a607c';
  tx.shadowColor = '#8fd0ff'; tx.shadowBlur = 4;
  tx.lineWidth = 3; tx.lineCap = 'round';
  for (const w of W.walls) {
    if (w.bouncy)      tx.strokeStyle = '#ff7aa8';
    else if (w.flipper) tx.strokeStyle = '#ffb340';
    else                tx.strokeStyle = '#4a607c';
    tx.beginPath(); tx.moveTo(w.x1, w.y1); tx.lineTo(w.x2, w.y2); tx.stroke();
  }
  tx.shadowBlur = 0;
  tx.strokeStyle = 'rgba(255,255,255,0.18)';
  tx.lineWidth = 1;
  for (const w of W.walls) {
    tx.beginPath(); tx.moveTo(w.x1, w.y1); tx.lineTo(w.x2, w.y2); tx.stroke();
  }
}

function drawPegs(tx) {
  for (const p of W.pegs) {
    const bumper = p.bumper;
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

function drawConstraints(tx) {
  tx.strokeStyle = 'rgba(200,220,255,0.6)';
  tx.lineWidth = 1;
  for (const c of W.constraints) {
    if (!c.a) continue;
    tx.beginPath(); tx.moveTo(c.ax, c.ay); tx.lineTo(c.a.x, c.a.y); tx.stroke();
    tx.fillStyle = '#8a9fba';
    tx.beginPath(); tx.arc(c.ax, c.ay, 3, 0, TAU); tx.fill();
  }
}

function drawSprings(tx) {
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

function drawWater(tx) {
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

  // caustic highlights along the surface
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

function drawVortex(tx) {
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

function drawBallShadows(tx) {
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

/* Sample the pre-rendered sceneCanvas, scale/clip around the ball to fake a
   lens. Returns true if the ball is refractive (caller skips solid fill). */
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

/* Crude screen-space AO: darken the gap between nearby balls. O(n²) but
   bounded by balls.length ≤ 260 from the spawn cap. */
function drawAO(tx) {
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
      if (d < rsum * 0.98) continue;
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

function drawBall(tx, b) {
  const { x, y, r, mat } = b;
  const squashAmt = b.squash;

  drawMotionStreak(tx, b);

  tx.save();
  tx.translate(x, y);
  tx.rotate(b.squashAng);
  const rx = r * squashAmt, ry = r * (1 + (1 - squashAmt) * 0.28);
  tx.scale(rx / r, ry / r);
  tx.translate(-x, -y);

  const refracted = drawRefraction(tx, b);

  // light direction
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
    g.addColorStop(0,    gc + (hotGlow ? 'cc' : 'bb'));
    g.addColorStop(0.45, gc + '44');
    g.addColorStop(1,    gc + '00');
    tx.fillStyle = g;
    tx.beginPath(); tx.arc(x, y, gr, 0, TAU); tx.fill();
  }

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

  // rim + metallic env reflection
  tx.save();
  tx.beginPath(); tx.arc(x, y, r, 0, TAU); tx.clip();
  const rg = tx.createRadialGradient(x - offX * 1.1, y - offY * 1.1, r * 0.8, x, y, r);
  rg.addColorStop(0, 'rgba(255,255,255,0)');
  rg.addColorStop(1, mat.metallic > 0.5 ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.15)');
  tx.fillStyle = rg;
  tx.fillRect(x - r, y - r, r * 2, r * 2);

  if (mat.metallic > 0.5) {
    const sg = tx.createLinearGradient(x, y - r, x, y);
    sg.addColorStop(0,   'rgba(255,255,255,0.45)');
    sg.addColorStop(0.5, 'rgba(255,255,255,0.12)');
    sg.addColorStop(1,   'rgba(255,255,255,0)');
    tx.fillStyle = sg;
    tx.fillRect(x - r, y - r, r * 2, r);

    const hg = tx.createLinearGradient(x, y + r * 0.1, x, y + r * 0.4);
    hg.addColorStop(0,   'rgba(255,255,255,0)');
    hg.addColorStop(0.5, 'rgba(255,240,200,0.2)');
    hg.addColorStop(1,   'rgba(255,255,255,0)');
    tx.fillStyle = hg;
    tx.fillRect(x - r, y + r * 0.1, r * 2, r * 0.3);

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

  // secondary micro-specular on polished materials
  if (mat.metallic > 0.3 || mat.refract > 0.4) {
    const hx2 = x + offX * 0.6, hy2 = y + offY * 0.6;
    const hr2 = hr * 0.5;
    const hg2 = tx.createRadialGradient(hx2, hy2, 0, hx2, hy2, hr2);
    hg2.addColorStop(0, 'rgba(255,255,255,0.8)');
    hg2.addColorStop(1, 'rgba(255,255,255,0)');
    tx.fillStyle = hg2;
    tx.beginPath(); tx.arc(hx2, hy2, hr2, 0, TAU); tx.fill();
  }

  // rotation dots
  tx.save();
  tx.beginPath(); tx.arc(x, y, r, 0, TAU); tx.clip();
  const mAng = b.angle;
  const mk = [0, Math.PI];
  for (const a of mk) {
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

  // velocity + spin debug overlay
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
      tx.moveTo(ex, ey);
      tx.lineTo(ex - Math.cos(ang - 0.35) * 8, ey - Math.sin(ang - 0.35) * 8);
      tx.moveTo(ex, ey);
      tx.lineTo(ex - Math.cos(ang + 0.35) * 8, ey - Math.sin(ang + 0.35) * 8);
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

function drawTrail(tx, b) {
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

function drawParticles(tx) {
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

function drawLensFlares(tx) {
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

function drawSolarCenter(tx) {
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

/* ---------- film grain (precomputed RGBA noise tile, panned each frame) ---------- */
const grainCanvas = document.createElement('canvas');
const grainCtx = grainCanvas.getContext('2d');
let grainT = 0;
function buildGrain() {
  grainCanvas.width = 180;
  grainCanvas.height = 180;
  const img = grainCtx.createImageData(180, 180);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() * 255) | 0;
    img.data[i] = n;
    img.data[i + 1] = n;
    img.data[i + 2] = n;
    img.data[i + 3] = 28;
  }
  grainCtx.putImageData(img, 0, 0);
}
buildGrain();

function doPostFX() {
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

function doBloomPass() {
  if (!PHYS.bloom) return;
  bloomCtx.setTransform(0.5, 0, 0, 0.5, 0, 0);
  bloomCtx.fillStyle = '#000';
  bloomCtx.fillRect(0, 0, W.cw, W.ch);
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
  for (const p of particles) {
    if (p.type !== 'spark') continue;
    bloomCtx.globalAlpha = p.life / p.maxLife;
    bloomCtx.fillStyle = p.color;
    bloomCtx.beginPath();
    bloomCtx.arc(p.x, p.y, p.size * 2, 0, TAU);
    bloomCtx.fill();
  }
  bloomCtx.globalAlpha = 1;
  for (const p of W.pegs) {
    if (!p.bumper) continue;
    const g = bloomCtx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 2);
    g.addColorStop(0, 'rgba(255,200,80,0.7)');
    g.addColorStop(1, 'rgba(255,200,80,0)');
    bloomCtx.fillStyle = g;
    bloomCtx.beginPath(); bloomCtx.arc(p.x, p.y, p.r * 2, 0, TAU); bloomCtx.fill();
  }
  if (W.solar) {
    const cx = W.cw / 2, cy = W.ch / 2;
    const g = bloomCtx.createRadialGradient(cx, cy, 0, cx, cy, 200);
    g.addColorStop(0,   'rgba(255,220,120,0.8)');
    g.addColorStop(0.6, 'rgba(255,140,40,0.3)');
    g.addColorStop(1,   'rgba(255,140,40,0)');
    bloomCtx.fillStyle = g;
    bloomCtx.beginPath(); bloomCtx.arc(cx, cy, 200, 0, TAU); bloomCtx.fill();
  }
  bloomCtx.setTransform(1, 0, 0, 1, 0, 0);
  bloomCtx.filter = 'blur(14px)';
  bloomCtx.drawImage(bloomCanvas, 0, 0);
  bloomCtx.filter = 'none';

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.9;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.drawImage(bloomCanvas, 0, 0, W.cw, W.ch);
  ctx.restore();
}

/* FPS sparkline drawn into the sidebar mini-canvas. */
const fpsCanvas = document.getElementById('fps-canvas');
const fpsCtx = fpsCanvas.getContext('2d');
function renderFpsGraph(fpsHistory) {
  const w = fpsCanvas.width, h = fpsCanvas.height;
  fpsCtx.clearRect(0, 0, w, h);
  fpsCtx.strokeStyle = '#ffb340';
  fpsCtx.lineWidth = 1.2;
  fpsCtx.beginPath();
  for (let i = 0; i < fpsHistory.length; i++) {
    const x = (i / fpsHistory.length) * w;
    const y = h - (Math.min(60, fpsHistory[i]) / 60) * h;
    if (i === 0) fpsCtx.moveTo(x, y); else fpsCtx.lineTo(x, y);
  }
  fpsCtx.stroke();
  fpsCtx.strokeStyle = 'rgba(255,255,255,0.15)';
  fpsCtx.setLineDash([2, 2]);
  fpsCtx.beginPath(); fpsCtx.moveTo(0, 0); fpsCtx.lineTo(w, 0); fpsCtx.stroke();
  fpsCtx.setLineDash([]);
}
