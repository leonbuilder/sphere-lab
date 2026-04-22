/** Walled arena with 4 slanted platforms; balls rain down and bounce off them. */

import { W, addBox, setGravityUI } from '../core/world.js';

export default function rain() {
  const pad = 40;
  addBox(pad, pad, W.cw - pad * 2, W.ch - pad * 2);

  const cx = W.cw / 2;
  for (let i = 0; i < 4; i++) {
    const y = 200 + i * 130;
    const off = (i % 2 === 0) ? -120 : 120;
    W.walls.push({ x1: cx + off - 160, y1: y + 40, x2: cx + off + 160, y2: y - 40 });
  }

  W.rainSpawn = true;
  W.bgColor1 = '#0a1a28';
  W.bgColor2 = '#040a14';
  setGravityUI(true, 900);
}
