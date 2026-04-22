/** Plinko board: staggered peg grid + bin dividers at the bottom. */

import { W, addBox, setGravityUI } from '../core/world.js';

export default function plinko() {
  const pad = 40;
  addBox(pad, pad, W.cw - pad * 2, W.ch - pad * 2);

  const rows = 9, cols = 14, startY = 200;
  const sx = (W.cw - pad * 2) / cols, sy = 60;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const offset = r % 2 === 0 ? 0 : sx / 2;
      const x = pad + 30 + c * sx + offset;
      const y = startY + r * sy;
      if (x < pad + 10 || x > W.cw - pad - 10) continue;
      W.pegs.push({ x, y, r: 6 });
    }
  }

  const binCount = 10;
  const binY = W.ch - 200;
  for (let i = 0; i <= binCount; i++) {
    const bx = pad + (i / binCount) * (W.cw - pad * 2);
    W.walls.push({ x1: bx, y1: binY, x2: bx, y2: W.ch - pad });
  }

  W.bgColor1 = '#1a0f28';
  W.bgColor2 = '#0a0614';
  setGravityUI(true, 900);
}
