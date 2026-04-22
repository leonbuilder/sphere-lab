/**
 * Canvas ownership — the main render target plus two offscreen buffers:
 *
 *   canvas / ctx          : the DOM canvas, what the user sees
 *   bloomCanvas / bloomCtx: half-resolution glow buffer (postfx.js)
 *   sceneCanvas / sceneCtx: snapshot of the scene under refractive balls
 *
 * `resize()` must be called once on init and again on `window.resize`.
 */

import { W } from '../core/world.js';

export const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('canvas'));
export const ctx = canvas.getContext('2d');

/** Device pixel ratio, capped at 2 to keep draw cost bounded. */
export let dpr = 1;

export const bloomCanvas = document.createElement('canvas');
export const bloomCtx = bloomCanvas.getContext('2d');

export const sceneCanvas = document.createElement('canvas');
export const sceneCtx = sceneCanvas.getContext('2d');

/** Primary light direction in [0..1] canvas-relative coordinates. */
export const light = { x: 0.28, y: 0.24 };

export function resize() {
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
