/**
 * Scene registry + `loadScene(name)` entry point.
 *
 * To add a new scene:
 *   1. Drop a file in this directory whose default export is a (no-arg) builder.
 *   2. Import it below and add to SCENES.
 *   3. Add `<button class="tab" data-scene="NAME">Label</button>` to index.html.
 */

import { W, cam, clearWorld } from '../core/world.js';

import sandbox   from './sandbox.js';
import billiards from './billiards.js';
import plinko    from './plinko.js';
import cradle    from './cradle.js';
import vortex    from './vortex.js';
import tower     from './tower.js';
import galton    from './galton.js';
import pinball   from './pinball.js';
import cloth     from './cloth.js';
import domino    from './domino.js';
import solar     from './solar.js';
import rain      from './rain.js';
import jelly     from './jelly.js';
import water     from './water.js';
import magnets   from './magnets.js';

/** @type {Record<string, () => void>} */
const SCENES = {
  sandbox, billiards, plinko, cradle, vortex, tower, galton, pinball,
  cloth, domino, solar, rain, jelly, water, magnets
};

export const SCENE_NAMES = Object.keys(SCENES);

const LABELS = {
  sandbox: 'Sandbox', billiards: 'Billiards', plinko: 'Plinko', cradle: 'Cradle',
  vortex: 'Vortex', tower: 'Tower', galton: 'Galton', pinball: 'Pinball',
  cloth: 'Cloth', domino: 'Domino', solar: 'Solar', rain: 'Rain',
  jelly: 'Jelly', water: 'Water', magnets: 'Magnets'
};

/** Clear world state, re-center the camera, run the scene builder, sync HUD. */
export function loadScene(name) {
  clearWorld();
  W.scene = name;
  W.rainSpawn = false;

  cam.tx = W.cw / 2; cam.ty = W.ch / 2; cam.tz = 1;
  cam.x  = W.cw / 2; cam.y  = W.ch / 2; cam.zoom = 1;

  (SCENES[name] || sandbox)();

  document.getElementById('stat-scene').textContent = LABELS[name] || name;
  document.querySelectorAll('#top .tab')
    .forEach(b => b.classList.toggle('active', b.dataset.scene === name));
}
