/** Newton's cradle: 6 steel balls on pendulum tethers, first ball offset. */

import { W, addBox, setGravityUI } from '../core/world.js';
import { Ball, balls } from '../entities/ball.js';
import { MATERIALS } from '../entities/materials.js';

export default function cradle() {
  const pad = 40;
  addBox(pad, pad, W.cw - pad * 2, W.ch - pad * 2);

  const cy = W.ch * 0.3;
  const n = 6, r = 28;
  const chainLen = W.ch * 0.42;
  const startX = W.cw / 2 - (n - 1) * r;

  for (let i = 0; i < n; i++) {
    const ax = startX + i * r * 2;
    const b = new Ball(ax, cy + chainLen, r, MATERIALS.steel);
    balls.push(b);
    W.constraints.push({ a: b, ax, ay: cy, len: chainLen });
  }

  // pull the leftmost ball out so it kicks off the chain
  if (balls[0]) {
    balls[0].x = startX - chainLen * 0.6;
    balls[0].y = cy + Math.sqrt(chainLen * chainLen - (chainLen * 0.6) ** 2);
  }

  W.bgColor1 = '#14202a';
  W.bgColor2 = '#060a12';
  setGravityUI(true, 900);
}
