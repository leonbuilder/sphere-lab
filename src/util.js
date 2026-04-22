'use strict';

/* Math helpers + color utilities.
   Exposes globals: TAU, rand, randI, pick, clamp, lerp, len, dist2,
   hexToRgb, rgbToHex, mix, lighten, darken. */

const TAU = Math.PI * 2;

const rand  = (a = 1, b) => b === undefined ? Math.random() * a : a + Math.random() * (b - a);
const randI = (a, b) => Math.floor(rand(a, b));
const pick  = a => a[Math.floor(Math.random() * a.length)];
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp  = (a, b, t) => a + (b - a) * t;
const len   = (x, y) => Math.sqrt(x * x + y * y);
const dist2 = (ax, ay, bx, by) => { const dx = bx - ax, dy = by - ay; return dx*dx + dy*dy; };

function hexToRgb(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function rgbToHex(r, g, b) {
  const c = v => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0');
  return '#' + c(r) + c(g) + c(b);
}
function mix(h1, h2, t) {
  const [r1, g1, b1] = hexToRgb(h1), [r2, g2, b2] = hexToRgb(h2);
  return rgbToHex(lerp(r1, r2, t), lerp(g1, g2, t), lerp(b1, b2, t));
}
function lighten(h, t) { return mix(h, '#ffffff', t); }
function darken(h, t)  { return mix(h, '#000000', t); }
