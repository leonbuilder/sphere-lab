/** 24 spring-chained "dominos" + a heavy kicker ball that bowls through them. */

import { W, addBox, setGravityUI } from '../core/world.js';
import { Ball, balls } from '../entities/ball.js';
import { Spring } from '../entities/spring.js';
import { MATERIALS } from '../entities/materials.js';

export default function domino() {
  const pad = 40;
  addBox(pad, pad, W.cw - pad * 2, W.ch - pad * 2);

  const floorY = W.ch - pad;
  const count = 24;
  const spacing = 50;

  for (let i = 0; i < count; i++) {
    const x = pad + 120 + i * spacing;
    // stack 5 small balls and link them vertically — they act like a domino
    for (let j = 0; j < 5; j++) {
      const b = new Ball(x, floorY - 18 - j * 18, 9, MATERIALS.bowling);
      balls.push(b);
      if (j > 0) {
        W.springs.push(new Spring(balls[balls.length - 1], balls[balls.length - 2], 18, 1.5, 0.12));
      }
    }
  }

  const kicker = new Ball(pad + 80, floorY - 40, 18, MATERIALS.steel);
  kicker.vx = 600;
  balls.push(kicker);

  W.bgColor1 = '#151b14';
  W.bgColor2 = '#080c08';
  setGravityUI(true, 1200);
}
