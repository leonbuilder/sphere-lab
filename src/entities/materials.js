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
 * @typedef {'steel'|'rubber'|'glass'|'bowling'|'neon'|'gold'|'plasma'|'ice'|'magnet'|'mercury'|'diamond'|'obsidian'} MaterialId
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
 * @property {number}  [deform]     — 0 rigid .. 1 elastomer (squash amount + hold)
 * @property {boolean} [fragile]    — can shatter on hard impact
 * @property {number}  [chip]       — probability of a debris chip per collision (0..1)
 * @property {boolean} [magnetic]   — attracts other magnetic balls
 * @property {boolean} [fluid]      — tries to merge with similar fluid on contact
 * @property {number}  [roll]       — rolling resistance (0 = glides forever, 0.2 = grinds to halt fast)
 * @property {number}  [heatKeep]   — per-step heat retention factor at 240 Hz (higher = holds heat longer)
 * @property {boolean} [dentable]   — accumulates permanent dents from hard impacts
 * @property {number}  [cond]       — thermal conductivity (0 insulator .. 1 fast heat flow)
 * @property {number}  [bounceBack] — 0 overdamped (snaps back) .. 1 lightly damped (jiggles visibly)
 * @property {number}  [hardness]   — 0..1 Mohs-ish. Harder material damages softer in asymmetric hits
 * @property {number}  [anisotropy] — 0..1 strength of directional (brushed) highlight
 * @property {number}  [brushAxis]  — brush direction in ball-local frame, radians
 * @property {number}  [clearcoat]  — 0..1 thin glossy top layer on metals (sharp specular lobe)
 * @property {number}  [squashMax]  — peak compression depth (0..1). Default 0.35 for balls / 0.40 for walls
 */

/** @type {Record<MaterialId, Material>} */
export const MATERIALS = {
  steel:   { name: 'STEEL',   color: '#c2cedc', density: 7.85, restitution: 0.86, friction: 0.33, metallic: 0.98, glow: 0,    refract: 0,    pitch: 680,  timbre: 'triangle', deform: 0.05, roll: 0.003, heatKeep: 0.9985, cond: 0.90, bounceBack: 0.00, hardness: 0.88, anisotropy: 0.65, brushAxis: 0, clearcoat: 0.40 },
  rubber:  { name: 'RUBBER',  color: '#e84a66', density: 1.15, restitution: 0.82, friction: 0.90, metallic: 0.03, glow: 0,    refract: 0,    pitch: 260,  timbre: 'sine',     deform: 1.0 , roll: 0.180, heatKeep: 0.9930, cond: 0.05, bounceBack: 0.85, hardness: 0.10, squashMax: 0.48 },
  glass:   { name: 'GLASS',   color: '#8fd0ff', density: 2.5,  restitution: 0.95, friction: 0.10, metallic: 0.20, glow: 0,    refract: 0.9,  pitch: 1500, timbre: 'sine',     deform: 0.0,  roll: 0.008, heatKeep: 0.9955, cond: 0.25, bounceBack: 0.00, fragile: true },
  bowling: { name: 'BOWLING', color: '#1a1f28', density: 2.20, restitution: 0.32, friction: 0.58, metallic: 0.12, glow: 0,    refract: 0,    pitch: 120,  timbre: 'square',   deform: 0.30, roll: 0.035, heatKeep: 0.9955, cond: 0.15, bounceBack: 0.15, hardness: 0.55 },
  neon:    { name: 'NEON',    color: '#4affb4', density: 0.9,  restitution: 0.78, friction: 0.40, metallic: 0,    glow: 1.0,  refract: 0,    pitch: 900,  timbre: 'sine',     deform: 0.55, roll: 0.070, heatKeep: 0.9960, cond: 0.35, bounceBack: 0.55 },
  gold:    { name: 'GOLD',    color: '#f7c15a', density: 17.5, restitution: 0.38, friction: 0.42, metallic: 1.0,  glow: 0.15, refract: 0,    pitch: 440,  timbre: 'triangle', deform: 0.55, roll: 0.040, heatKeep: 0.9988, cond: 0.95, bounceBack: 0.10, dentable: true, hardness: 0.25, anisotropy: 0.30, brushAxis: 0, clearcoat: 0.28 },
  plasma:  { name: 'PLASMA',  color: '#c878ff', density: 0.3,  restitution: 0.70, friction: 0.18, metallic: 0,    glow: 1.2,  refract: 0,    pitch: 1700, timbre: 'sawtooth', deform: 0.85, roll: 0.030, heatKeep: 0.9975, cond: 0.70, bounceBack: 0.70 },
  ice:     { name: 'ICE',     color: '#c8e8ff', density: 0.92, restitution: 0.32, friction: 0.04, metallic: 0.10, glow: 0.15, refract: 0.55, pitch: 1100, timbre: 'sine',     deform: 0.0,  roll: 0.004, heatKeep: 0.9993, cond: 0.50, bounceBack: 0.00, fragile: true, chip: 0.25 },
  magnet:  { name: 'MAGNET',  color: '#c84848', density: 7.5,  restitution: 0.62, friction: 0.42, metallic: 0.85, glow: 0.18, refract: 0,    pitch: 320,  timbre: 'square',   deform: 0.10, roll: 0.010, heatKeep: 0.9980, cond: 0.80, bounceBack: 0.08, magnetic: true, hardness: 0.78, anisotropy: 0.40, brushAxis: 0, clearcoat: 0.30 },
  mercury: { name: 'MERCURY', color: '#d6dfe8', density: 13.55, restitution: 0.22, friction: 0.08, metallic: 1.0,  glow: 0.05, refract: 0.15, pitch: 260,  timbre: 'triangle', deform: 0.95, roll: 0.040, heatKeep: 0.9960, cond: 0.82, bounceBack: 0.45, fluid: true, hardness: 0, anisotropy: 0.10, brushAxis: 0, clearcoat: 0.30 },
  // Diamond — hardest natural material, peak refractive index, best thermal
  // conductor on the periodic table. Extremely rigid (no squash), very
  // elastic bounce, exceptional "fire" (chromatic dispersion), crystalline
  // ring that outlasts glass. Effectively unbreakable in normal use — it
  // doesn't get the `fragile` flag, so it never cracks or shatters.
  diamond: { name: 'DIAMOND', color: '#e8f4ff', density: 3.52, restitution: 0.94, friction: 0.06, metallic: 0.20, glow: 0.10, refract: 1.00, pitch: 2200, timbre: 'sine',     deform: 0.0,  roll: 0.004, heatKeep: 0.9976, cond: 0.99, bounceBack: 0.00 },
  // Obsidian — volcanic glass. Dark polished surface, brittle core: cleaves
  // easier than glass (lower fracture threshold) and breaks into jagged
  // angular spikes instead of soft shards. Low thermal conductivity, poor
  // bounce, glossy metallic sheen.
  obsidian: { name: 'OBSIDIAN', color: '#1f1824', density: 2.55, restitution: 0.32, friction: 0.14, metallic: 0.70, glow: 0,    refract: 0.20, pitch: 900,  timbre: 'sine',     deform: 0.0,  roll: 0.010, heatKeep: 0.9960, cond: 0.18, bounceBack: 0.00, fragile: true }
};

/** @type {MaterialId[]} */
export const MAT_KEYS = /** @type {MaterialId[]} */ (Object.keys(MATERIALS));
