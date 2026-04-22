/**
 * Global keyboard shortcuts.
 *
 * Arrow keys pass through to the flipper system in PINBALL scene.
 * All other handlers are no-ops if focus is inside an <input> (so slider
 * interaction doesn't trigger shortcuts).
 */

import { PHYS, TOOL_KEYS } from '../core/config.js';
import { W, cam, setGravityUI } from '../core/world.js';
import { balls, selectedMat } from '../entities/ball.js';
import { particles } from '../entities/particles.js';
import { MAT_KEYS } from '../entities/materials.js';
import { loadScene } from '../scenes/index.js';
import { setTool } from './tools.js';
import { updatePauseBtn, updateSlowmoBtn, updateToggle, updateMatButtons } from '../ui/hud.js';

export const keys = { left: false, right: false };

addEventListener('keydown', e => {
  const key = e.key.toLowerCase();
  if (e.target instanceof HTMLInputElement) return;

  // pinball flippers
  if (key === 'arrowleft')  { keys.left  = true; for (const f of W.flippers) if (f.side < 0) f.active = true; e.preventDefault(); return; }
  if (key === 'arrowright') { keys.right = true; for (const f of W.flippers) if (f.side > 0) f.active = true; e.preventDefault(); return; }

  if (key === ' ') { PHYS.paused = !PHYS.paused; updatePauseBtn(); e.preventDefault(); }
  else if (key === 'f') {
    PHYS.slowmo = PHYS.slowmo === 1 ? 0.15 : 1;
    updateSlowmoBtn();
  }
  else if (key === 'g')              { PHYS.gravityOn = !PHYS.gravityOn; setGravityUI(PHYS.gravityOn); }
  else if (key === 'c')              { balls.length = 0; particles.length = 0; W.springs.length = 0; }
  else if (key === 'r' && e.ctrlKey) { loadScene(W.scene); }
  else if (key === 'm')              { PHYS.motionBlur = !PHYS.motionBlur; updateToggle('t-blur', PHYS.motionBlur); }
  else if (key === 'b')              { PHYS.bloom   = !PHYS.bloom;   updateToggle('t-bloom', PHYS.bloom); }
  else if (key === 'v')              { PHYS.showVec = !PHYS.showVec; updateToggle('t-vec',   PHYS.showVec); }
  else if (key === 's')              { PHYS.sound   = !PHYS.sound;   updateToggle('t-sound', PHYS.sound); }
  else if (key === 'h')              { PHYS.heatFx  = !PHYS.heatFx;  updateToggle('t-heat',  PHYS.heatFx); }
  else if (key === '0')              { cam.tx = W.cw / 2; cam.ty = W.ch / 2; cam.tz = 1; }
  else if (TOOL_KEYS[key])           { setTool(TOOL_KEYS[key]); }
  else if (key >= '1' && key <= '9') {
    const idx = parseInt(key) - 1;
    if (idx < MAT_KEYS.length) { selectedMat.id = MAT_KEYS[idx]; updateMatButtons(); }
  }
});

addEventListener('keyup', e => {
  const key = e.key.toLowerCase();
  if (key === 'arrowleft')  { keys.left  = false; for (const f of W.flippers) if (f.side < 0) f.active = false; }
  if (key === 'arrowright') { keys.right = false; for (const f of W.flippers) if (f.side > 0) f.active = false; }
});
