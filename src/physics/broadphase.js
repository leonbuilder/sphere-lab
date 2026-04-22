/**
 * Uniform-grid broadphase.
 *
 * Hashes every ball into a grid cell, then emits pairs from the same cell plus
 * 4 forward-directional neighbors — this covers all real neighbors without
 * double-counting. Cell size adapts to the largest ball (2.2× its radius) so
 * a single huge ball never tunnels through the hash.
 */

import { balls } from '../entities/ball.js';
import { stats } from './stats.js';

const _gridMap = /** @type {Map<string, import('../entities/ball.js').Ball[]>} */ (new Map());
const _key = (cx, cy) => cx + ':' + cy;

/**
 * @returns {[import('../entities/ball.js').Ball, import('../entities/ball.js').Ball][]}
 * Candidate pairs for narrow-phase testing.
 */
export function buildPairs() {
  let maxR = 20;
  for (const b of balls) if (b.r > maxR) maxR = b.r;
  const cell = Math.max(40, maxR * 2.2);

  _gridMap.clear();
  for (let i = 0; i < balls.length; i++) {
    const b = balls[i];
    const cx = Math.floor(b.x / cell), cy = Math.floor(b.y / cell);
    const k = _key(cx, cy);
    let list = _gridMap.get(k);
    if (!list) { list = []; _gridMap.set(k, list); }
    list.push(b);
    b._cx = cx; b._cy = cy;
  }

  /** @type {[import('../entities/ball.js').Ball, import('../entities/ball.js').Ball][]} */
  const pairs = [];
  for (const list of _gridMap.values()) {
    const cx = list[0]._cx, cy = list[0]._cy;

    // same cell
    for (let i = 0; i < list.length; i++) {
      const a = list[i];
      for (let j = i + 1; j < list.length; j++) pairs.push([a, list[j]]);
    }

    // 4 forward-directional neighbors (never back, so no duplicates)
    const dirs = [[1, 0], [0, 1], [1, 1], [1, -1]];
    for (const [dx, dy] of dirs) {
      const nl = _gridMap.get(_key(cx + dx, cy + dy));
      if (!nl) continue;
      for (const a of list) for (const b of nl) pairs.push([a, b]);
    }
  }

  stats.pairs = pairs.length;
  return pairs;
}
