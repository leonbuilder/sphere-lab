/** Magnet playground — scattered magnet balls + a few neutral ones to knock
 *  them around with. Drop more MAGNET material in via the sidebar. */

import { W, addBox, setGravityUI } from '../core/world.js';
import { TAU, rand, pick } from '../core/math.js';
import { Ball, balls } from '../entities/ball.js';
import { MATERIALS } from '../entities/materials.js';

export default function magnets() {
  const pad = 40;
  addBox(pad, pad, W.cw - pad * 2, W.ch - pad * 2);
  W.magnetic = true;

  // scatter a ring of magnets
  const count = 14;
  for (let i = 0; i < count; i++) {
    const a = (i / count) * TAU;
    const d = 210;
    const x = W.cw / 2 + Math.cos(a) * d;
    const y = W.ch / 2 + Math.sin(a) * d;
    const b = new Ball(x, y, 14, MATERIALS.magnet);
    b.vx = rand(-20, 20); b.vy = rand(-20, 20);
    balls.push(b);
  }

  // a few neutral "bullets" for the user to fling with
  for (let i = 0; i < 4; i++) {
    const b = new Ball(rand(pad + 40, W.cw - pad - 40), rand(pad + 40, pad + 120), 12, MATERIALS[pick(['steel', 'glass', 'gold'])]);
    balls.push(b);
  }

  W.bgColor1 = '#1e0810';
  W.bgColor2 = '#0b0408';
  setGravityUI(false, 0);
}
