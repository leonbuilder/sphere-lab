/** Two soft-body jelly blobs: center particle + ring + spokes + cross-bracing. */

import { W, addBox, setGravityUI } from '../core/world.js';
import { TAU } from '../core/math.js';
import { Ball, balls } from '../entities/ball.js';
import { Spring } from '../entities/spring.js';
import { MATERIALS } from '../entities/materials.js';

/**
 * Build one soft blob at (cx, cy) with given size + material + stiffness.
 * Topology:
 *   - a center particle
 *   - 20 ring particles evenly around
 *   - radial spokes (center → each ring particle)
 *   - ring perimeter (neighbors)
 *   - short cross braces (i → i+3) to resist local shear
 *   - long cross braces (i → i+10) for pressure response
 */
function buildJelly(cx, cy, size, mat, stiffness) {
  const ringN = 20;
  /** @type {Ball[]} */
  const ring = [];
  const center = new Ball(cx, cy, 7, mat);
  balls.push(center);

  for (let i = 0; i < ringN; i++) {
    const a = (i / ringN) * TAU;
    const bx = cx + Math.cos(a) * size;
    const by = cy + Math.sin(a) * size;
    const b = new Ball(bx, by, 6, mat);
    balls.push(b); ring.push(b);
  }

  for (const rb of ring) {
    W.springs.push(new Spring(center, rb, size, stiffness * 0.5, 0.1));
  }
  for (let i = 0; i < ringN; i++) {
    const a = ring[i], b2 = ring[(i + 1) % ringN];
    const d = Math.hypot(a.x - b2.x, a.y - b2.y);
    W.springs.push(new Spring(a, b2, d, stiffness, 0.12));
  }
  for (let i = 0; i < ringN; i++) {
    const a = ring[i], b2 = ring[(i + 3) % ringN];
    const d = Math.hypot(a.x - b2.x, a.y - b2.y);
    W.springs.push(new Spring(a, b2, d, stiffness * 0.3, 0.06));
  }
  for (let i = 0; i < ringN / 2; i++) {
    const a = ring[i], b2 = ring[(i + ringN / 2) % ringN];
    const d = Math.hypot(a.x - b2.x, a.y - b2.y);
    W.springs.push(new Spring(a, b2, d, stiffness * 0.15, 0.05));
  }
}

export default function jelly() {
  const pad = 40;
  addBox(pad, pad, W.cw - pad * 2, W.ch - pad * 2);

  buildJelly(W.cw * 0.35, 200, 80, MATERIALS.rubber, 0.7);
  buildJelly(W.cw * 0.65, 200, 60, MATERIALS.neon,   1.0);

  // an angled launcher platform near the bottom
  W.walls.push({ x1: W.cw * 0.2, y1: W.ch * 0.7, x2: W.cw * 0.8, y2: W.ch * 0.78 });

  W.bgColor1 = '#1a0f1e';
  W.bgColor2 = '#080410';
  setGravityUI(true, 900);
}
