/**
 * Entry point — loaded once from index.html via `<script type="module">`.
 *
 * Boot sequence:
 *   1. Load persisted prefs (theme, toggles, volume, selected material).
 *   2. Size canvas + re-init on window resize.
 *   3. Build UI panels (materials, sliders, buttons).
 *   4. Apply saved prefs into the live DOM.
 *   5. Select default tool + default scene.
 *   6. Start the main loop.
 */

import { W } from './core/world.js';
import { PHYS } from './core/config.js';
import { resize } from './render/canvas.js';
import { buildMatButtons } from './ui/materials.js';
import { bindSliders } from './ui/sliders.js';
import { bindButtons } from './ui/buttons.js';
import { setTool } from './input/tools.js';
import { loadScene } from './scenes/index.js';
import { startLoop } from './loop.js';
import { loadPrefs, getPref, savePref } from './core/persistence.js';
import { applyTheme } from './core/theme.js';
import { updateToggle, updatePauseBtn, updateSlowmoBtn, updateMatButtons } from './ui/hud.js';
import { selectedMat } from './entities/ball.js';
import { MATERIALS, MAT_KEYS } from './entities/materials.js';

// side-effecting imports — their top-level code wires up event listeners
import './input/mouse.js';
import './input/keyboard.js';

/** Push persisted prefs into PHYS + DOM on boot. */
function applySavedPrefs() {
  const toggleIds = ['t-bloom','t-shadow','t-blur','t-trail','t-vec','t-sound','t-refract','t-heat','t-ao','t-aberration','t-grain','t-streaks','t-flare','t-fire'];
  const ids2keys = {
    't-bloom':'bloom','t-shadow':'shadow','t-blur':'motionBlur','t-trail':'trails',
    't-vec':'showVec','t-sound':'sound','t-refract':'refract','t-heat':'heatFx',
    't-ao':'ao','t-aberration':'aberration','t-grain':'grain','t-streaks':'streaks','t-flare':'flare',
    't-fire':'fire'
  };
  for (const id of toggleIds) {
    const key = ids2keys[id];
    const saved = getPref(id, PHYS[key]);
    PHYS[key] = !!saved;
    updateToggle(id, PHYS[key]);
  }

  const vol = getPref('volume', PHYS.volume);
  PHYS.volume = vol;
  const sVol = /** @type {HTMLInputElement} */ (document.getElementById('s-vol'));
  const vVol = document.getElementById('v-vol');
  if (sVol) { sVol.value = String(Math.round(vol * 100)); vVol.textContent = String(Math.round(vol * 100)); }

  const matId = getPref('mat', 'rubber');
  if (MATERIALS[matId] && MAT_KEYS.includes(matId)) { selectedMat.id = matId; }

  applyTheme(getPref('theme', 'amber'));
}

function init() {
  loadPrefs();
  resize();
  addEventListener('resize', () => { resize(); loadScene(W.scene); });
  buildMatButtons();
  bindSliders();
  bindButtons();
  applySavedPrefs();
  updateMatButtons();
  updatePauseBtn();
  updateSlowmoBtn();
  setTool('spawn');
  loadScene('sandbox');
  startLoop();
}

init();
