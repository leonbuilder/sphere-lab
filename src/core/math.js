/**
 * Number + geometry helpers used everywhere.
 * Pure functions — safe to import from any layer.
 */

export const TAU = Math.PI * 2;

/** Uniform random in [0, a) when `b` is omitted, else [a, b). */
export const rand = (a = 1, b) => b === undefined ? Math.random() * a : a + Math.random() * (b - a);

/** Uniform integer in [a, b). */
export const randI = (a, b) => Math.floor(rand(a, b));

/** Uniformly pick one element of `a`. */
export const pick = a => a[Math.floor(Math.random() * a.length)];

/** Clamp `v` into `[a, b]`. */
export const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

/** Linear interpolation. */
export const lerp = (a, b, t) => a + (b - a) * t;

/** Euclidean length of a 2D vector. */
export const len = (x, y) => Math.sqrt(x * x + y * y);

/** Squared distance between two points (saves a sqrt when you only need comparisons). */
export const dist2 = (ax, ay, bx, by) => { const dx = bx - ax, dy = by - ay; return dx * dx + dy * dy; };
