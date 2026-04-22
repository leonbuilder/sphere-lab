/** Pool/billiards rack: a 5-row triangle of balls + a fast cue ball. No gravity. */

import { W, addBox, setGravityUI } from '../core/world.js';
import { rand } from '../core/math.js';
import { Ball } from '../entities/ball.js';
import { balls } from '../entities/ball.js';
import { MATERIALS } from '../entities/materials.js';

export default function billiards() {
  const pad = 80;
  addBox(pad, pad, W.cw - pad * 2, W.ch - pad * 2);

  // pocket nibblers in the four corners
  const p = pad;
  W.walls.push({ x1: p + 30,           y1: p,             x2: p,               y2: p + 30 });
  W.walls.push({ x1: W.cw - p - 30,    y1: p,             x2: W.cw - p,        y2: p + 30 });
  W.walls.push({ x1: p,                y1: W.ch - p - 30, x2: p + 30,          y2: W.ch - p });
  W.walls.push({ x1: W.cw - p,         y1: W.ch - p - 30, x2: W.cw - p - 30,   y2: W.ch - p });

  // triangle rack
  const cx = W.cw * 0.7, cy = W.ch * 0.5, r = 14;
  const mats = ['gold', 'rubber', 'glass', 'plasma', 'neon'];
  let idx = 0;
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col <= row; col++) {
      const bx = cx + row * r * 2 * 0.92;
      const by = cy + (col - row / 2) * r * 2;
      balls.push(new Ball(bx, by, r, MATERIALS[mats[idx % mats.length]]));
      idx++;
    }
  }

  // cue ball
  const cue = new Ball(W.cw * 0.22, W.ch * 0.5, 14, MATERIALS.steel);
  cue.vx = 900;
  cue.vy = rand(-20, 20);
  balls.push(cue);

  W.bgColor1 = '#0a3b22';
  W.bgColor2 = '#052818';
  setGravityUI(false, 0);
}
