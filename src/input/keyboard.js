/**
 * Global keyboard shortcuts. Arrow keys → flippers. Ctrl-Z → undo.
 * All other handlers are no-ops when focus is inside an <input>.
 */

import { PHYS, TOOL_KEYS } from '../core/config.js';
import { W, cam, setGravityUI } from '../core/world.js';
import { balls, selectedMat } from '../entities/ball.js';
import { particles } from '../entities/particles.js';
import { MAT_KEYS } from '../entities/materials.js';
import { loadScene } from '../scenes/index.js';
import { setTool } from './tools.js';
import { updatePauseBtn, updateSlowmoBtn, updateToggle, updateMatButtons } from '../ui/hud.js';
import { undo } from '../core/undo.js';
import { savePref, getPref } from '../core/persistence.js';
import { setPanelOpen } from '../ui/buttons.js';

export const keys = { left: false, right: false };

addEventListener('keydown', e => {
  const key = e.key.toLowerCase();
  if (e.target instanceof HTMLInputElement) return;

  // Modifier-required handlers first — these intentionally consume the
  // modifier. Placed before the plain-key guard below so they fire.
  if (key === 'z' && (e.ctrlKey || e.metaKey)) { undo(); e.preventDefault(); return; }
  if (key === 'r' && e.ctrlKey)                { loadScene(W.scene); e.preventDefault(); return; }

  // flippers — arrow keys (no modifier involved)
  if (key === 'arrowleft')  { keys.left  = true; for (const f of W.flippers) if (f.side < 0) f.active = true; e.preventDefault(); return; }
  if (key === 'arrowright') { keys.right = true; for (const f of W.flippers) if (f.side > 0) f.active = true; e.preventDefault(); return; }

  // All remaining shortcuts are plain keys. Yield to the browser if any
  // modifier is held so Cmd-S (save page), Ctrl-F (find), Alt-Tab, etc.
  // work normally without also toggling our physics.
  if (e.ctrlKey || e.metaKey || e.altKey) return;

  if (key === ' ') { PHYS.paused = !PHYS.paused; updatePauseBtn(); e.preventDefault(); }
  else if (key === 'f') {
    PHYS.slowmo = PHYS.slowmo === 1 ? 0.15 : 1;
    updateSlowmoBtn();
  }
  else if (key === 'g')              { PHYS.gravityOn = !PHYS.gravityOn; setGravityUI(PHYS.gravityOn); }
  else if (key === 'c')              { balls.length = 0; particles.length = 0; W.springs.length = 0; W.constraints.length = 0; }
  else if (key === 'm')              { PHYS.motionBlur = !PHYS.motionBlur; updateToggle('t-blur', PHYS.motionBlur); savePref('t-blur', PHYS.motionBlur); }
  else if (key === 'b')              { PHYS.bloom   = !PHYS.bloom;   updateToggle('t-bloom', PHYS.bloom);   savePref('t-bloom', PHYS.bloom); }
  else if (key === 'v')              { PHYS.showVec = !PHYS.showVec; updateToggle('t-vec',   PHYS.showVec); savePref('t-vec', PHYS.showVec); }
  else if (key === 's')              { PHYS.sound   = !PHYS.sound;   updateToggle('t-sound', PHYS.sound);   savePref('t-sound', PHYS.sound); }
  else if (key === 'h')              { PHYS.heatFx  = !PHYS.heatFx;  updateToggle('t-heat',  PHYS.heatFx);  savePref('t-heat', PHYS.heatFx); }
  else if (key === '0')              { cam.tx = W.cw / 2; cam.ty = W.ch / 2; cam.tz = 1; }
  else if (key === ',')              { setPanelOpen('left',  !getPref('panel-left-open',  1)); }
  else if (key === '.')              { setPanelOpen('right', !getPref('panel-right-open', 1)); }
  else if (TOOL_KEYS[key])           { setTool(TOOL_KEYS[key]); }
  else if (key >= '1' && key <= '9') {
    const idx = parseInt(key) - 1;
    if (idx < MAT_KEYS.length) { selectedMat.id = MAT_KEYS[idx]; updateMatButtons(); savePref('mat', selectedMat.id); }
  }
});

addEventListener('keyup', e => {
  const key = e.key.toLowerCase();
  if (key === 'arrowleft')  { keys.left  = false; for (const f of W.flippers) if (f.side < 0) f.active = false; }
  if (key === 'arrowright') { keys.right = false; for (const f of W.flippers) if (f.side > 0) f.active = false; }
});
