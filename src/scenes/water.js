/** Water tank at ~55% height. Various materials dropped in to demonstrate
 *  Archimedes sorting: steel/bowling/gold sink; glass/ice/neon/plasma/rubber float. */

import { W, addBox, setGravityUI } from '../core/world.js';
import { rand } from '../core/math.js';
import { Ball, balls } from '../entities/ball.js';
import { MATERIALS } from '../entities/materials.js';

export default function water() {
  const pad = 40;
  addBox(pad, pad, W.cw - pad * 2, W.ch - pad * 2);

  W.waterY = W.ch * 0.55;

  const kinds = ['steel', 'rubber', 'glass', 'bowling', 'neon', 'gold', 'plasma', 'ice', 'steel', 'rubber'];
  for (let i = 0; i < kinds.length; i++) {
    const x = W.cw * 0.15 + i * (W.cw * 0.72 / kinds.length);
    balls.push(new Ball(x, W.waterY - 100, rand(14, 26), MATERIALS[kinds[i]]));
  }

  W.bgColor1 = '#06162a';
  W.bgColor2 = '#020814';
  setGravityUI(true, 900);
}
