/**
 * Builds the material palette buttons in the left sidebar. Called once at init.
 * Uses the material's `color` for the swatch (with a glow so GLASS/ICE are
 * still visible against the dark background).
 */

import { MATERIALS, MAT_KEYS } from '../entities/materials.js';
import { selectedMat } from '../entities/ball.js';
import { updateMatButtons } from './hud.js';

export function buildMatButtons() {
  const wrap = document.getElementById('ball-types');
  MAT_KEYS.forEach((k, i) => {
    const m = MATERIALS[k];
    const b = document.createElement('button');
    b.className = 'btn ball';
    b.dataset.mat = k;
    b.innerHTML =
      `<span class="swatch" style="background:${m.color};box-shadow:0 0 6px ${m.color}"></span>` +
      `${m.name}` +
      `<span style="margin-left:auto;color:var(--dim);font-size:0.65rem">${i + 1}</span>`;
    b.onclick = () => { selectedMat.id = k; updateMatButtons(); };
    wrap.appendChild(b);
  });
  updateMatButtons();
}
