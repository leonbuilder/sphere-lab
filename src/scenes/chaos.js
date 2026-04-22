/** Double pendulum — the canonical chaotic system.
 *  First bob hangs from a fixed pivot (constraint), second hangs from first (stiff
 *  spring). Tiny differences in initial angle cause wildly divergent motion. */

import { W, addBox, setGravityUI } from '../core/world.js';
import { Ball, balls } from '../entities/ball.js';
import { Spring } from '../entities/spring.js';
import { MATERIALS } from '../entities/materials.js';
import { PHYS } from '../core/config.js';

export default function chaos() {
  const pad = 40;
  addBox(pad, pad, W.cw - pad * 2, W.ch - pad * 2);

  const cx = W.cw / 2;
  const anchorY = 150;
  const len1 = 180;
  const len2 = 160;

  // a long trail looks great on chaotic motion
  PHYS.trails = true;
  document.getElementById('t-trail')?.classList.add('active');

  // first bob, offset so it starts with energy
  const b1 = new Ball(cx + len1 * Math.sin(1.1), anchorY + len1 * Math.cos(1.1), 18, MATERIALS.gold);
  balls.push(b1);
  W.constraints.push({ a: b1, ax: cx, ay: anchorY, len: len1 });

  // second bob, stiff-spring-attached to first (distance ≈ len2)
  const b2 = new Ball(b1.x + len2 * Math.sin(2.1), b1.y + len2 * Math.cos(2.1), 14, MATERIALS.rubber);
  balls.push(b2);
  W.springs.push(new Spring(b1, b2, len2, 1.8, 0.02));

  // a third guest pendulum with slightly different starting angle to show divergence
  const b3 = new Ball(cx + len1 * Math.sin(1.100001), anchorY + len1 * Math.cos(1.100001), 18, MATERIALS.neon);
  balls.push(b3);
  W.constraints.push({ a: b3, ax: cx + 2, ay: anchorY, len: len1 });
  const b4 = new Ball(b3.x + len2 * Math.sin(2.1), b3.y + len2 * Math.cos(2.1), 14, MATERIALS.plasma);
  balls.push(b4);
  W.springs.push(new Spring(b3, b4, len2, 1.8, 0.02));

  W.bgColor1 = '#0e0b20';
  W.bgColor2 = '#04030c';
  setGravityUI(true, 1200);
}
