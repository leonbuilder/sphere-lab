/**
 * Active tool + hit-testing helpers.
 *
 * `getTool()` is how every other module reads the current tool — it returns
 * the current string. Importing a primitive directly wouldn't see updates
 * because ES module primitive exports are live bindings only through named
 * imports that refer to *bindings*, which can be tricky; a function call is
 * unambiguous.
 */

import { clamp } from '../core/math.js';
import { balls } from '../entities/ball.js';
import { W } from '../core/world.js';
import { canvas } from '../render/canvas.js';

/** @type {'spawn'|'grab'|'draw'|'erase'|'link'|'pin'|'push'|'heat'} */
let TOOL = 'spawn';

export function getTool() { return TOOL; }

export function setTool(t) {
  TOOL = t;
  document.querySelectorAll('#tool-row .btn').forEach(b => b.classList.toggle('active', b.dataset.tool === t));
  document.getElementById('stat-tool').textContent = t.toUpperCase();
  document.getElementById('mode-indicator').textContent = t.toUpperCase() + ' MODE';
  canvas.style.cursor =
    t === 'grab'  ? 'grab'        :
    t === 'draw'  ? 'crosshair'   :
    t === 'erase' ? 'not-allowed' :
                    'crosshair';
}

/** Top-most ball at world-space (x,y), or null. Iterates newest-first. */
export function ballAt(x, y) {
  for (let i = balls.length - 1; i >= 0; i--) {
    const b = balls[i];
    if ((b.x - x) ** 2 + (b.y - y) ** 2 < b.r * b.r) return b;
  }
  return null;
}

/** Index of the wall within `W.walls` that's within `tol` of (x,y), or -1. */
export function wallAt(x, y, tol = 8) {
  for (let i = 0; i < W.walls.length; i++) {
    const w = W.walls[i];
    const wx = w.x2 - w.x1, wy = w.y2 - w.y1;
    const l2 = wx * wx + wy * wy;
    let t = ((x - w.x1) * wx + (y - w.y1) * wy) / l2;
    t = clamp(t, 0, 1);
    const cx = w.x1 + wx * t, cy = w.y1 + wy * t;
    if ((x - cx) ** 2 + (y - cy) ** 2 < tol * tol) return i;
  }
  return -1;
}
