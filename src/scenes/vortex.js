/** Central swirl pulling balls inward with a tangential component. No gravity. */

import { W, addBox, setGravityUI } from '../core/world.js';
import { TAU, rand, pick } from '../core/math.js';
import { Ball, balls } from '../entities/ball.js';
import { MATERIALS, MAT_KEYS } from '../entities/materials.js';

export default function vortex() {
  const pad = 40;
  addBox(pad, pad, W.cw - pad * 2, W.ch - pad * 2);

  W.vortexX = W.cw / 2;
  W.vortexY = W.ch / 2;

  for (let i = 0; i < 50; i++) {
    const a = rand(0, TAU);
    const d = rand(150, 400);
    const mat = MATERIALS[pick(MAT_KEYS)];
    const bb = new Ball(W.cw / 2 + Math.cos(a) * d, W.ch / 2 + Math.sin(a) * d, rand(10, 22), mat);
    // give each ball a tangential orbital velocity
    bb.vx = -Math.sin(a) * 200;
    bb.vy =  Math.cos(a) * 200;
    balls.push(bb);
  }

  W.bgColor1 = '#201028';
  W.bgColor2 = '#080410';
  setGravityUI(false, 0);
}
