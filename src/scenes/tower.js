/** Pyramid stack of balls — drop something heavy on it to see everything fly. */

import { W, addBox, setGravityUI } from '../core/world.js';
import { rand, pick } from '../core/math.js';
import { Ball, balls } from '../entities/ball.js';
import { MATERIALS } from '../entities/materials.js';

export default function tower() {
  const pad = 40;
  addBox(pad, pad, W.cw - pad * 2, W.ch - pad * 2);

  const cx = W.cw / 2;
  const floorY = W.ch - pad - 1;
  const r = 20;

  for (let row = 0; row < 12; row++) {
    const count = 10 - Math.min(row, 8);
    for (let c = 0; c < count; c++) {
      const mat = MATERIALS[pick(['steel', 'bowling', 'rubber', 'gold'])];
      const x = cx + (c - (count - 1) / 2) * r * 2.05;
      const y = floorY - r - row * r * 2 - rand(0, 2);
      balls.push(new Ball(x, y, r, mat));
    }
  }

  W.bgColor1 = '#1e1a0a';
  W.bgColor2 = '#0c0a04';
  setGravityUI(true, 900);
}
