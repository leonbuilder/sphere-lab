/**
 * Floating "what is this ball" panel — appears next to the cursor when it's
 * hovering over a ball (any tool). Hidden while dragging. Values update every
 * frame while visible.
 *
 * Called from loop.js after mouse coords are known.
 */

import { mouse } from '../input/mouse.js';
import { ballAt } from '../input/tools.js';
import { len } from '../core/math.js';

const el       = document.getElementById('inspector');
const swatch   = document.getElementById('ins-swatch');
const name     = document.getElementById('ins-name');
const idEl     = document.getElementById('ins-id');
const speedEl  = document.getElementById('ins-speed');
const spinEl   = document.getElementById('ins-spin');
const massEl   = document.getElementById('ins-mass');
const radiusEl = document.getElementById('ins-radius');
const pinnedEl = document.getElementById('ins-pinned');
const heatBar  = document.getElementById('ins-heat');

let current = null;

export function updateInspector() {
  // hide while the user is mid-drag — distracting otherwise
  if (mouse.down || mouse.middle) { if (current) { el.classList.remove('show'); current = null; } return; }

  const b = ballAt(mouse.wx, mouse.wy);
  if (!b) {
    if (current) { el.classList.remove('show'); current = null; }
    return;
  }

  if (current !== b) {
    current = b;
    name.textContent = b.mat.name;
    swatch.style.background = b.mat.color;
    swatch.style.boxShadow = `0 0 8px ${b.mat.color}`;
    idEl.textContent = '#' + b.id;
    el.classList.add('show');
  }

  // position near cursor, clamped inside viewport
  const pad = 18;
  const x = Math.min(window.innerWidth  - 210, mouse.x + pad);
  const y = Math.min(window.innerHeight - 180, mouse.y + pad);
  el.style.left = x + 'px';
  el.style.top  = y + 'px';

  // live stats
  speedEl.textContent  = Math.round(len(b.vx, b.vy));
  spinEl.textContent   = b.omega.toFixed(2);
  massEl.textContent   = b.mass.toFixed(2);
  radiusEl.textContent = String(b.r);
  pinnedEl.textContent = b.pinned ? 'yes' : 'no';
  heatBar.style.width  = Math.round(b.heat * 100) + '%';
}
