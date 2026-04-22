/**
 * Ball materials — physically-motivated properties.
 *
 * Densities are relative to water (g/cm³), scaled down slightly so simulation
 * stays numerically nice. They produce realistic mass ratios: a gold ball is
 * ~14× heavier than a rubber ball of the same size.
 *
 * `deform` (0..1) drives impact visuals + squash recovery speed:
 *   0   — fully rigid (glass, ice). Squash is bypassed; fracture may occur.
 *   0.3 — stiff (bowling, magnet, steel). Brief flicker of compression.
 *   0.6 — malleable (gold). Holds the dent a while.
 *   1.0 — elastomer (rubber, mercury). Big compression, slow recovery.
 *
 * `fragile` materials break apart above a velocity threshold (see
 * `physics/fracture.js`).
 *
 * `chip` materials leave a small debris particle on every collision.
 *
 * `fluid` materials try to merge with each other at low relative speed
 * (mercury, intended).
 */

/**
 * @typedef {'steel'|'rubber'|'glass'|'bowling'|'neon'|'gold'|'plasma'|'ice'|'magnet'|'mercury'} MaterialId
 */

/**
 * @typedef {Object} Material
 * @property {string} name
 * @property {string} color
 * @property {number} density
 * @property {number} restitution
 * @property {number} friction
 * @property {number} metallic
 * @property {number} glow
 * @property {number} refract
 * @property {number} pitch
 * @property {OscillatorType} timbre
 * @property {number}  [deform]    — 0 rigid .. 1 elastomer (squash amount + hold)
 * @property {boolean} [fragile]   — can shatter on hard impact
 * @property {number}  [chip]      — probability of a debris chip per collision (0..1)
 * @property {boolean} [magnetic]  — attracts other magnetic balls
 * @property {boolean} [fluid]     — tries to merge with similar fluid on contact
 * @property {number}  [roll]      — rolling resistance (0 = glides forever, 0.2 = grinds to halt fast)
 * @property {number}  [heatKeep]  — per-step heat retention factor at 240 Hz (higher = holds heat longer)
 * @property {boolean} [dentable]  — accumulates permanent dents from hard impacts
 * @property {number}  [cond]      — thermal conductivity (0 insulator .. 1 fast heat flow)
 */

/** @type {Record<MaterialId, Material>} */
export const MATERIALS = {
  steel:   { name: 'STEEL',   color: '#c0ccdc', density: 7.8,  restitution: 0.62, friction: 0.35, metallic: 0.95, glow: 0,    refract: 0,    pitch: 680,  timbre: 'triangle', deform: 0.12, roll: 0.010, heatKeep: 0.9985, cond: 0.90 },
  rubber:  { name: 'RUBBER',  color: '#ff5576', density: 1.1,  restitution: 0.88, friction: 0.80, metallic: 0.03, glow: 0,    refract: 0,    pitch: 260,  timbre: 'sine',     deform: 1.0 , roll: 0.150, heatKeep: 0.9930, cond: 0.05 },
  glass:   { name: 'GLASS',   color: '#8fd0ff', density: 2.5,  restitution: 0.95, friction: 0.10, metallic: 0.20, glow: 0,    refract: 0.9,  pitch: 1500, timbre: 'sine',     deform: 0.0,  roll: 0.008, heatKeep: 0.9955, cond: 0.25, fragile: true },
  bowling: { name: 'BOWLING', color: '#1a1f28', density: 3.5,  restitution: 0.22, friction: 0.60, metallic: 0.35, glow: 0,    refract: 0,    pitch: 120,  timbre: 'square',   deform: 0.35, roll: 0.055, heatKeep: 0.9955, cond: 0.15 },
  neon:    { name: 'NEON',    color: '#4affb4', density: 0.9,  restitution: 0.78, friction: 0.40, metallic: 0,    glow: 1.0,  refract: 0,    pitch: 900,  timbre: 'sine',     deform: 0.55, roll: 0.070, heatKeep: 0.9960, cond: 0.35 },
  gold:    { name: 'GOLD',    color: '#ffc850', density: 15.0, restitution: 0.35, friction: 0.32, metallic: 1.0,  glow: 0.2,  refract: 0,    pitch: 440,  timbre: 'triangle', deform: 0.60, roll: 0.095, heatKeep: 0.9988, cond: 0.95, dentable: true },
  plasma:  { name: 'PLASMA',  color: '#c878ff', density: 0.3,  restitution: 0.70, friction: 0.18, metallic: 0,    glow: 1.2,  refract: 0,    pitch: 1700, timbre: 'sawtooth', deform: 0.85, roll: 0.030, heatKeep: 0.9975, cond: 0.70 },
  ice:     { name: 'ICE',     color: '#c8e8ff', density: 0.92, restitution: 0.32, friction: 0.04, metallic: 0.10, glow: 0.15, refract: 0.55, pitch: 1100, timbre: 'sine',     deform: 0.0,  roll: 0.004, heatKeep: 0.9993, cond: 0.50, fragile: true, chip: 0.25 },
  magnet:  { name: 'MAGNET',  color: '#e65050', density: 5.0,  restitution: 0.40, friction: 0.55, metallic: 0.55, glow: 0.3,  refract: 0,    pitch: 320,  timbre: 'square',   deform: 0.25, roll: 0.080, heatKeep: 0.9980, cond: 0.80, magnetic: true },
  mercury: { name: 'MERCURY', color: '#d6dfe8', density: 13.5, restitution: 0.22, friction: 0.08, metallic: 1.0,  glow: 0.05, refract: 0.15, pitch: 260,  timbre: 'triangle', deform: 0.95, roll: 0.040, heatKeep: 0.9960, cond: 0.82, fluid: true }
};

/** @type {MaterialId[]} */
export const MAT_KEYS = /** @type {MaterialId[]} */ (Object.keys(MATERIALS));
