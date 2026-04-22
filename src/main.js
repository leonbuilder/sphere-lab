/**
 * Entry point. Initializes canvas size, UI panels, tool, default scene,
 * and kicks off the main loop.
 *
 * Loaded once from index.html via `<script type="module" src="src/main.js">`.
 * The side-effecting imports of `input/mouse.js` and `input/keyboard.js`
 * attach their event listeners; no explicit init call is needed.
 */

import { W } from './core/world.js';
import { resize } from './render/canvas.js';
import { buildMatButtons } from './ui/materials.js';
import { bindSliders } from './ui/sliders.js';
import { bindButtons } from './ui/buttons.js';
import { setTool } from './input/tools.js';
import { loadScene } from './scenes/index.js';
import { startLoop } from './loop.js';

// side-effecting imports — their top-level code wires up event listeners
import './input/mouse.js';
import './input/keyboard.js';

function init() {
  resize();
  addEventListener('resize', () => { resize(); loadScene(W.scene); });
  buildMatButtons();
  bindSliders();
  bindButtons();
  setTool('spawn');
  loadScene('sandbox');
  startLoop();
}

init();
