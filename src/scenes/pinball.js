/** Pinball table: sloped top rails, V-shaped bottom, 5 bumpers, bouncy side walls. */

import { W, addBox, setGravityUI } from '../core/world.js';
import { rand } from '../core/math.js';
import { Ball, balls } from '../entities/ball.js';
import { MATERIALS } from '../entities/materials.js';

export default function pinball() {
  const pad = 40;
  addBox(pad, pad, W.cw - pad * 2, W.ch - pad * 2);

  const cx = W.cw / 2;

  // angled top rails
  W.walls.push({ x1: pad + 40,        y1: pad, x2: pad,        y2: pad + 160 });
  W.walls.push({ x1: W.cw - pad - 40, y1: pad, x2: W.cw - pad, y2: pad + 160 });

  // V at the bottom (drain + gutter sides)
  W.walls.push({ x1: pad,        y1: W.ch - pad, x2: cx - 120, y2: W.ch - pad - 80 });
  W.walls.push({ x1: W.cw - pad, y1: W.ch - pad, x2: cx + 120, y2: W.ch - pad - 80 });

  // flippers (static for now — visual only)
  W.walls.push({ x1: cx - 120, y1: W.ch - pad - 80, x2: cx - 40, y2: W.ch - pad - 30, flipper: true });
  W.walls.push({ x1: cx + 120, y1: W.ch - pad - 80, x2: cx + 40, y2: W.ch - pad - 30, flipper: true });

  // bumpers
  W.pegs.push({ x: cx - 140, y: W.ch / 2 - 80,  r: 28, bumper: true });
  W.pegs.push({ x: cx + 140, y: W.ch / 2 - 80,  r: 28, bumper: true });
  W.pegs.push({ x: cx,       y: W.ch / 2 - 180, r: 32, bumper: true });
  W.pegs.push({ x: cx - 80,  y: W.ch / 2 + 40,  r: 22, bumper: true });
  W.pegs.push({ x: cx + 80,  y: W.ch / 2 + 40,  r: 22, bumper: true });

  // bouncy side rails
  W.walls.push({ x1: cx - 260, y1: W.ch / 2 + 140, x2: cx - 200, y2: W.ch / 2 + 220, bouncy: true });
  W.walls.push({ x1: cx + 260, y1: W.ch / 2 + 140, x2: cx + 200, y2: W.ch / 2 + 220, bouncy: true });

  // initial ball
  const b = new Ball(cx, 160, 14, MATERIALS.steel);
  b.vx = rand(-40, 40);
  balls.push(b);

  W.bgColor1 = '#14081c';
  W.bgColor2 = '#08040e';
  setGravityUI(true, 900);
}
