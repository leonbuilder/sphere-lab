/**
 * Ball materials.
 *
 * Each entry is a constant describing how a ball of that material looks,
 * collides, and sounds. Adding a material? Also add its key to a new keyboard
 * shortcut in `src/input/keyboard.js` if you want a hotkey, and it will
 * automatically appear in the sidebar palette.
 */

/**
 * @typedef {'steel'|'rubber'|'glass'|'bowling'|'neon'|'gold'|'plasma'|'ice'} MaterialId
 */

/**
 * @typedef {Object} Material
 * @property {string} name         — UPPERCASE display name
 * @property {string} color        — base color, `#rrggbb`
 * @property {number} density      — mass = r²·density·0.001
 * @property {number} restitution  — base coefficient of restitution [0..1]
 * @property {number} friction     — surface friction μ
 * @property {number} metallic     — 0..1, drives metallic env reflection pass
 * @property {number} glow         — bloom contribution; also used by lens flare
 * @property {number} refract      — glass lens strength [0..1]; <0.3 = solid
 * @property {number} pitch        — impact synth base frequency (Hz)
 * @property {OscillatorType} timbre — Web Audio oscillator wave
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
  ice:     { name: 'ICE',     color: '#c8e8ff', density: 1.1, restitution: 0.3,  friction: 0.05, metallic: 0.1,  glow: 0.15, refract: 0.6, pitch: 1100, timbre: 'sine'     }
};

/** @type {MaterialId[]} — stable iteration order; also determines 1..9 hotkeys. */
export const MAT_KEYS = /** @type {MaterialId[]} */ (Object.keys(MATERIALS));
