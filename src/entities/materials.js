/**
 * Ball materials.
 *
 * Each entry is a constant describing how a ball of that material looks,
 * collides, and sounds. Adding a material? It will automatically appear in the
 * sidebar palette, and the first 9 get the 1..9 hotkeys.
 *
 * `magnetic` is an optional flag read by `physics/forces.js::applyMagnetism`
 * to decide whether two balls should attract each other.
 */

/**
 * @typedef {'steel'|'rubber'|'glass'|'bowling'|'neon'|'gold'|'plasma'|'ice'|'magnet'|'mercury'} MaterialId
 */

/**
 * @typedef {Object} Material
 * @property {string} name         — display name, uppercase for back-compat
 * @property {string} color        — base color, `#rrggbb`
 * @property {number} density      — mass = r²·density·0.001
 * @property {number} restitution  — base coefficient of restitution [0..1]
 * @property {number} friction     — surface friction μ
 * @property {number} metallic     — 0..1, drives metallic env reflection
 * @property {number} glow         — bloom contribution
 * @property {number} refract      — glass lens strength [0..1]; <0.3 = solid
 * @property {number} pitch        — impact synth base frequency (Hz)
 * @property {OscillatorType} timbre
 * @property {boolean} [magnetic]  — if true, attracts/repels other magnetic balls
 */

/** @type {Record<MaterialId, Material>} */
export const MATERIALS = {
  steel:   { name: 'STEEL',   color: '#b8c5d4', density: 2.8, restitution: 0.55, friction: 0.35, metallic: 0.9,  glow: 0,    refract: 0,   pitch: 600,  timbre: 'triangle' },
  rubber:  { name: 'RUBBER',  color: '#ff5576', density: 1.0, restitution: 0.88, friction: 0.75, metallic: 0.05, glow: 0,    refract: 0,   pitch: 260,  timbre: 'sine'     },
  glass:   { name: 'GLASS',   color: '#8fd0ff', density: 1.4, restitution: 0.95, friction: 0.12, metallic: 0.2,  glow: 0,    refract: 0.9, pitch: 1400, timbre: 'sine'     },
  bowling: { name: 'BOWLING', color: '#1a1f28', density: 4.5, restitution: 0.25, friction: 0.85, metallic: 0.4,  glow: 0,    refract: 0,   pitch: 140,  timbre: 'square'   },
  neon:    { name: 'NEON',    color: '#4affb4', density: 0.9, restitution: 0.78, friction: 0.4,  metallic: 0,    glow: 1.0,  refract: 0,   pitch: 900,  timbre: 'sine'     },
  gold:    { name: 'GOLD',    color: '#ffc850', density: 6.0, restitution: 0.5,  friction: 0.3,  metallic: 1.0,  glow: 0.2,  refract: 0,   pitch: 420,  timbre: 'triangle' },
  plasma:  { name: 'PLASMA',  color: '#c878ff', density: 0.6, restitution: 0.65, friction: 0.2,  metallic: 0,    glow: 1.2,  refract: 0,   pitch: 1600, timbre: 'sawtooth' },
  ice:     { name: 'ICE',     color: '#c8e8ff', density: 1.1, restitution: 0.3,  friction: 0.05, metallic: 0.1,  glow: 0.15, refract: 0.6, pitch: 1100, timbre: 'sine'     },
  magnet:  { name: 'MAGNET',  color: '#e65050', density: 3.2, restitution: 0.4,  friction: 0.5,  metallic: 0.55, glow: 0.3,  refract: 0,   pitch: 340,  timbre: 'square',   magnetic: true },
  mercury: { name: 'MERCURY', color: '#d6dfe8', density: 9.0, restitution: 0.35, friction: 0.08, metallic: 1.0,  glow: 0.05, refract: 0.15,pitch: 300,  timbre: 'triangle' }
};

/** @type {MaterialId[]} — stable iteration order; first 9 get 1..9 hotkeys. */
export const MAT_KEYS = /** @type {MaterialId[]} */ (Object.keys(MATERIALS));
