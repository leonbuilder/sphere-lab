/**
 * Mutable global physics + render toggles.
 * Every frame reads from `PHYS`. UI sliders mutate `PHYS` live.
 *
 * This module is intentionally tiny. If you find yourself adding logic here,
 * it probably belongs somewhere else.
 */

/**
 * @typedef {Object} PhysConfig
 * Sim parameters:
 * @property {number} gravity        — px/s² downward
 * @property {number} drag           — linear drag coefficient (0..~0.5)
 * @property {number} restitutionMul — global bounciness multiplier
 * @property {number} frictionMul    — global friction multiplier
 * @property {number} magnus         — Magnus effect strength
 * @property {number} wind           — horizontal wind acceleration (px/s²)
 * @property {number} spawnRadius    — default spawn radius
 * @property {boolean} gravityOn
 * @property {number} slowmo         — time-scale multiplier (1 = normal)
 * @property {boolean} paused
 * Render toggles:
 * @property {boolean} motionBlur  @property {boolean} trails     @property {boolean} showVec
 * @property {boolean} bloom       @property {boolean} shadow     @property {boolean} sound
 * @property {boolean} refract     @property {boolean} heatFx     @property {boolean} ao
 * @property {boolean} aberration  @property {boolean} grain      @property {boolean} streaks
 * @property {boolean} flare
 */

/** @type {PhysConfig} */
export const PHYS = {
  gravity: 900, drag: 0.05, restitutionMul: 1.0, frictionMul: 0.5, magnus: 0.6, wind: 0,
  spawnRadius: 20,
  gravityOn: true, slowmo: 1, paused: false,
  motionBlur: false, trails: false, showVec: false,
  bloom: true, shadow: true, sound: true, refract: true, heatFx: true,
  ao: true, aberration: true, grain: true, streaks: true, flare: true
};

/** Keyboard → tool id (matches the QWERTY row under the tool buttons). */
export const TOOL_KEYS = { q: 'spawn', w: 'grab', e: 'draw', r: 'erase', t: 'link', y: 'pin', u: 'push', i: 'heat' };
