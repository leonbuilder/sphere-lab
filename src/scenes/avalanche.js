/** Steep ramp on the left + pile of balls at the top, waiting to cascade. */

import { W, addBox, setGravityUI } from '../core/world.js';
import { rand, pick } from '../core/math.js';
import { Ball, balls } from '../entities/ball.js';
import { MATERIALS } from '../entities/materials.js';

export default function avalanche() {
  const pad = 40;
  addBox(pad, pad, W.cw - pad * 2, W.ch - pad * 2);

  // the slope itself, from upper-left to lower-right, steep
  const slopeY1 = 180;
  const slopeY2 = W.ch - pad - 40;
  const slopeX1 = pad;
  const slopeX2 = W.cw * 0.65;
  W.walls.push({ x1: slopeX1, y1: slopeY1, x2: slopeX2, y2: slopeY2 });

  // a shelf at the top to hold the stack
  const shelfLeft  = pad + 40;
  const shelfRight = pad + 250;
  const shelfY     = slopeY1 - 20;
  W.walls.push({ x1: shelfLeft,  y1: shelfY - 120, x2: shelfLeft,  y2: shelfY });
  W.walls.push({ x1: shelfLeft,  y1: shelfY,      x2: shelfRight, y2: shelfY });

  // pile ≈ 60 balls stacked
  const r = 12;
  const kinds = ['steel', 'bowling', 'rubber', 'gold', 'ice'];
  let id = 0;
  for (let row = 0; row < 10; row++) {
    const count = 10 - Math.min(row, 6);
    for (let c = 0; c < count; c++) {
      const x = shelfLeft + 12 + c * r * 2 + (row & 1 ? r : 0);
      if (x > shelfRight - 8) continue;
      const y = shelfY - r - 2 - row * r * 1.95 + rand(0, 1.5);
      balls.push(new Ball(x, y, r, MATERIALS[kinds[(id++) % kinds.length]]));
    }
  }

  // catcher platform to hold stuff at the bottom
  W.walls.push({ x1: slopeX2 + 20, y1: slopeY2 + 30, x2: W.cw - pad - 20, y2: slopeY2 + 30 });

  // a single heavy bowling ball to trigger the cascade
  const trigger = new Ball(shelfLeft + 120, shelfY - 20, 18, MATERIALS.bowling);
  balls.push(trigger);

  // a few decorative pegs along the slope to bounce balls around
  for (let i = 0; i < 4; i++) {
    const t = (i + 1) / 6;
    const px = slopeX1 + (slopeX2 - slopeX1) * t;
    const py = slopeY1 + (slopeY2 - slopeY1) * t - 60;
    W.pegs.push({ x: px, y: py, r: 8 });
  }

  W.bgColor1 = '#1a1814';
  W.bgColor2 = '#0a0906';
  setGravityUI(true, 1100);
}
