/**
 * Scene backdrop: radial gradient + per-scene flavor layer (stars / vortex
 * streaks / billiards felt / cloth bands) + world-aligned grid + vignette.
 */

import { W, cam } from '../core/world.js';
import { TAU, pick } from '../core/math.js';
import { lighten } from '../core/color.js';

/** Persistent star field for the SOLAR scene. */
/** @type {{x:number,y:number,s:number,tw:number,c:string}[] | null} */
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

/** @param {CanvasRenderingContext2D} tx */
export function drawBackground(tx) {
  // base radial gradient — brighter near the top, fading to bg2 at the corners
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
    // nebula drift
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
    // deterministic "felt" stipple — reproducible per frame so it doesn't crawl
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

  // world-aligned grid (shifts with the camera)
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
