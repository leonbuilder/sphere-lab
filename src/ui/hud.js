/**
 * Small HUD update helpers — imported by buttons / keyboard / material palette.
 * These touch DOM elements defined in index.html.
 *
 * Action buttons have structure `<span>Label</span><span class="kbd">K</span>`,
 * so we target the first child span when swapping labels (never `textContent`).
 */

import { PHYS } from '../core/config.js';
import { selectedMat } from '../entities/ball.js';

/** Swap the label (first span) on an action button. */
export function setActionLabel(id, text) {
  const b = document.getElementById(id);
  if (!b) return;
  const span = b.querySelector('span:not(.kbd)');
  if (span) span.textContent = text;
}

export function updatePauseBtn() {
  setActionLabel('btn-pause', PHYS.paused ? 'Resume' : 'Pause');
  document.getElementById('btn-pause').classList.toggle('active', PHYS.paused);
}

export function updateSlowmoBtn() {
  setActionLabel('btn-slowmo', PHYS.slowmo === 1 ? 'Slow-motion' : 'Normal speed');
  document.getElementById('btn-slowmo').classList.toggle('active', PHYS.slowmo !== 1);
}

export function updateToggle(id, on) {
  const b = document.getElementById(id);
  if (b) b.classList.toggle('active', on);
}

export function updateMatButtons() {
  document.querySelectorAll('#ball-types .mat')
    .forEach(b => b.classList.toggle('active', b.dataset.mat === selectedMat.id));
}
