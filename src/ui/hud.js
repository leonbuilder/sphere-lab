/**
 * Small HUD update helpers — imported by buttons / keyboard / material palette.
 * These touch DOM elements defined in index.html.
 */

import { PHYS } from '../core/config.js';
import { selectedMat } from '../entities/ball.js';

export function updatePauseBtn() {
  const b = document.getElementById('btn-pause');
  b.textContent = PHYS.paused ? 'RESUME [SPACE]' : 'PAUSE [SPACE]';
  b.classList.toggle('active', PHYS.paused);
}

export function updateToggle(id, on) {
  const b = document.getElementById(id);
  if (b) b.classList.toggle('active', on);
}

export function updateMatButtons() {
  document.querySelectorAll('#ball-types .btn').forEach(b => b.classList.toggle('active', b.dataset.mat === selectedMat.id));
}
