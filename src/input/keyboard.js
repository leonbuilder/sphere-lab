/**
 * Global keyboard shortcuts. See CLAUDE.md "CONTROLS" for the full list.
 * All handlers are no-ops if focus is inside an <input>, so slider interaction
 * doesn't trigger shortcuts.
 */

import { PHYS, TOOL_KEYS } from '../core/config.js';
import { W, cam, setGravityUI } from '../core/world.js';
import { balls, selectedMat } from '../entities/ball.js';
import { particles } from '../entities/particles.js';
import { MAT_KEYS } from '../entities/materials.js';
import { loadScene } from '../scenes/index.js';
import { setTool } from './tools.js';
import { updatePauseBtn, updateToggle, updateMatButtons } from '../ui/hud.js';

addEventListener('keydown', e => {
  const key = e.key.toLowerCase();
  if (e.target instanceof HTMLInputElement) return;

  if (key === ' ') { PHYS.paused = !PHYS.paused; updatePauseBtn(); e.preventDefault(); }
  else if (key === 'f') {
    PHYS.slowmo = PHYS.slowmo === 1 ? 0.15 : 1;
    const bt = document.getElementById('btn-slowmo');
    bt.textContent = PHYS.slowmo === 1 ? 'SLOW-MO [F]' : 'NORMAL [F]';
    bt.classList.toggle('active', PHYS.slowmo !== 1);
  }
  else if (key === 'g')              { PHYS.gravityOn = !PHYS.gravityOn; setGravityUI(PHYS.gravityOn); }
  else if (key === 'c')              { balls.length = 0; particles.length = 0; W.springs.length = 0; }
  else if (key === 'r' && e.ctrlKey) { loadScene(W.scene); }
  else if (key === 'm')              { PHYS.motionBlur = !PHYS.motionBlur; }
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
