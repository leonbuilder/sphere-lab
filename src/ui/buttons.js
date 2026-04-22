/**
 * Wire up scene tabs, tool grid, action buttons, and visual toggles.
 * Called once at init from `src/main.js`.
 */

import { PHYS } from '../core/config.js';
import { W, cam, setGravityUI } from '../core/world.js';
import { balls } from '../entities/ball.js';
import { particles } from '../entities/particles.js';
import { loadScene } from '../scenes/index.js';
import { setTool } from '../input/tools.js';
import { updatePauseBtn, updateSlowmoBtn, updateToggle } from './hud.js';

export function bindButtons() {
  // scene tabs
  document.querySelectorAll('#top .tab').forEach(b => { b.onclick = () => loadScene(b.dataset.scene); });

  // tool grid
  document.querySelectorAll('#tool-row .tool').forEach(b => { b.onclick = () => setTool(b.dataset.tool); });

  // action buttons
  document.getElementById('btn-clear').onclick = () => {
    balls.length = 0; particles.length = 0; W.springs.length = 0;
  };
  document.getElementById('btn-pause').onclick = () => { PHYS.paused = !PHYS.paused; updatePauseBtn(); };
  document.getElementById('btn-slowmo').onclick = () => {
    PHYS.slowmo = PHYS.slowmo === 1 ? 0.15 : 1;
    updateSlowmoBtn();
  };
  document.getElementById('btn-gravity').onclick = () => { PHYS.gravityOn = !PHYS.gravityOn; setGravityUI(PHYS.gravityOn); };
  document.getElementById('btn-reset-cam').onclick = () => { cam.tx = W.cw / 2; cam.ty = W.ch / 2; cam.tz = 1; };

  // visual toggles → PHYS boolean flag
  const toggles = [
    ['t-bloom',      'bloom'],
    ['t-shadow',     'shadow'],
    ['t-blur',       'motionBlur'],
    ['t-trail',      'trails'],
    ['t-vec',        'showVec'],
    ['t-sound',      'sound'],
    ['t-refract',    'refract'],
    ['t-heat',       'heatFx'],
    ['t-ao',         'ao'],
    ['t-aberration', 'aberration'],
    ['t-grain',      'grain'],
    ['t-streaks',    'streaks'],
    ['t-flare',      'flare']
  ];
  for (const [id, k] of toggles) {
    const b = document.getElementById(id);
    b.onclick = () => { PHYS[k] = !PHYS[k]; updateToggle(id, PHYS[k]); };
  }

  // help overlay
  document.getElementById('help-btn').onclick = () => document.getElementById('help').classList.add('show');
  document.getElementById('help').addEventListener('click', e => {
    if (e.target.id === 'help') e.currentTarget.classList.remove('show');
  });
}
