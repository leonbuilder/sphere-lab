/**
 * Scene registry + the `loadScene(name)` entry point.
 *
 * To add a new scene:
 *   1. Drop a file in this directory that `default export`s a (no-arg) builder.
 *   2. Import it here and add to the SCENES dict below.
 *   3. Add a corresponding <button data-scene="…"> to index.html.
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

/** @type {Record<string, () => void>} */
const SCENES = {
  sandbox, billiards, plinko, cradle, vortex, tower, galton, pinball,
  cloth, domino, solar, rain, jelly, water
};

/** Names in their display order. */
export const SCENE_NAMES = Object.keys(SCENES);

/**
 * Swap to a scene by name. Clears world state, re-centers the camera, runs
 * the builder, and updates the top-bar button's active highlight.
 */
export function loadScene(name) {
  clearWorld();
  W.scene = name;
  W.rainSpawn = false;

  // center camera on the world so scene-built coordinates map to screen
  cam.tx = W.cw / 2; cam.ty = W.ch / 2; cam.tz = 1;
  cam.x  = W.cw / 2; cam.y  = W.ch / 2; cam.zoom = 1;

  (SCENES[name] || sandbox)();

  document.getElementById('stat-scene').textContent = name.toUpperCase();
  document.querySelectorAll('#top .btn').forEach(b => b.classList.toggle('active', b.dataset.scene === name));
}
