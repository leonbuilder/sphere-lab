/** Sun (pinned gold ball) + 5 planets on circular orbits + moons + asteroid belt.
 *  Uses `physics/forces.js::applySolar` as the gravitational attractor. */

import { W, setGravityUI } from '../core/world.js';
import { TAU, rand } from '../core/math.js';
import { Ball, balls } from '../entities/ball.js';
import { MATERIALS } from '../entities/materials.js';

export default function solar() {
  W.solar = true;

  const sun = new Ball(W.cw / 2, W.ch / 2, 40, MATERIALS.gold);
  sun.pinned = true;
  sun.heat = 1;
  balls.push(sun);

  // planets — orbital velocity v = √(GM/r) with "GM" tuned for feel
  const mats = ['rubber', 'glass', 'neon', 'ice', 'plasma'];
  for (let i = 0; i < 5; i++) {
    const r = 120 + i * 90;
    const mat = MATERIALS[mats[i]];
    const size = rand(10, 22);
    const b = new Ball(W.cw / 2 + r, W.ch / 2, size, mat);
    const v = Math.sqrt(120000 / r) * 3.2;
    b.vy = v;
    balls.push(b);

    if (i === 2 || i === 4) {
      const moon = new Ball(b.x + 30, b.y, 5, MATERIALS.steel);
      moon.vx = b.vx;
      moon.vy = b.vy + 180;
      balls.push(moon);
    }
  }

  // asteroid belt
  for (let i = 0; i < 60; i++) {
    const a = rand(0, TAU);
    const r = rand(380, 440);
    const x = W.cw / 2 + Math.cos(a) * r;
    const y = W.ch / 2 + Math.sin(a) * r;
    const b = new Ball(x, y, rand(3, 6), MATERIALS.steel);
    const v = Math.sqrt(120000 / r) * 3.2;
    b.vx = -Math.sin(a) * v;
    b.vy =  Math.cos(a) * v;
    balls.push(b);
  }

  W.bgColor1 = '#000008';
  W.bgColor2 = '#000000';
  setGravityUI(false, 0);
}
