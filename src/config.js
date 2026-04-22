'use strict';

/* Global physics and render-toggle configuration. Mutated live by the UI sliders
   and toggle buttons in ui.js, and read everywhere the simulation runs. */

const PHYS = {
  // forces
  gravity: 900, drag: 0.05, restitutionMul: 1.0, frictionMul: 0.5, magnus: 0.6, wind: 0,
  // spawn / time
  spawnRadius: 20,
  gravityOn: true, slowmo: 1, paused: false,
  // render toggles
  motionBlur: false, trails: false, showVec: false,
  bloom: true, shadow: true, sound: true, refract: true, heatFx: true,
  ao: true, aberration: true, grain: true, streaks: true, flare: true
};

/* keyboard → tool mapping (QWERTY row under the tool buttons) */
const TOOL_KEYS = { q: 'spawn', w: 'grab', e: 'draw', r: 'erase', t: 'link', y: 'pin', u: 'push', i: 'heat' };
