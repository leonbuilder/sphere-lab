/**
 * Hex color utilities for the render pipeline.
 * Colors are always stored as `#rrggbb` strings; alpha is appended at draw
 * time by string concatenation (e.g. `color + '88'`).
 */

import { clamp, lerp } from './math.js';

/** @param {string} h e.g. '#ff5576' → [r,g,b] each in [0,255] */
export function hexToRgb(h) {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex(r, g, b) {
  const c = v => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0');
  return '#' + c(r) + c(g) + c(b);
}

/** Blend two hex colors by `t` ∈ [0,1]. */
export function mix(h1, h2, t) {
  const [r1, g1, b1] = hexToRgb(h1);
  const [r2, g2, b2] = hexToRgb(h2);
  return rgbToHex(lerp(r1, r2, t), lerp(g1, g2, t), lerp(b1, b2, t));
}

export const lighten = (h, t) => mix(h, '#ffffff', t);
export const darken  = (h, t) => mix(h, '#000000', t);
