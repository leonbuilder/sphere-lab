/**
 * Wire up scene buttons, tool buttons, action buttons, and visual-toggle
 * buttons. Called once at init from `src/main.js`.
 */

import { PHYS } from '../core/config.js';
import { W, cam, setGravityUI } from '../core/world.js';
import { balls } from '../entities/ball.js';
import { particles } from '../entities/particles.js';
import { loadScene } from '../scenes/index.js';
import { setTool } from '../input/tools.js';
import { updatePauseBtn, updateToggle } from './hud.js';

export function bindButtons() {
  // top bar — scene buttons
  document.querySelectorAll('#top .btn').forEach(b => { b.onclick = () => loadScene(b.dataset.scene); });

  // left sidebar — tool buttons
  document.querySelectorAll('#tool-row .btn').forEach(b => { b.onclick = () => setTool(b.dataset.tool); });

  // left sidebar — action buttons
  document.getElementById('btn-clear').onclick = () => {
    balls.length = 0; particles.length = 0; W.springs.length = 0;
  };

  document.getElementById('btn-pause').onclick = () => { PHYS.paused = !PHYS.paused; updatePauseBtn(); };

  document.getElementById('btn-slowmo').onclick = () => {
    PHYS.slowmo = PHYS.slowmo === 1 ? 0.15 : 1;
    const b = document.getElementById('btn-slowmo');
    b.textContent = PHYS.slowmo === 1 ? 'SLOW-MO [F]' : 'NORMAL [F]';
    b.classList.toggle('active', PHYS.slowmo !== 1);
  };

  document.getElementById('btn-gravity').onclick = () => { PHYS.gravityOn = !PHYS.gravityOn; setGravityUI(PHYS.gravityOn); };
  document.getElementById('btn-reset-cam').onclick = () => { cam.tx = W.cw / 2; cam.ty = W.ch / 2; cam.tz = 1; };

  // right sidebar — visual toggles → PHYS boolean flag
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
