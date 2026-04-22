/** Galton/bean machine: funnel + triangular peg grid + collection bins.
 *  Rain-spawn keeps dropping balls so the bins fill up over time. */

import { W, addBox, setGravityUI } from '../core/world.js';

export default function galton() {
  const pad = 40;
  addBox(pad, pad, W.cw - pad * 2, W.ch - pad * 2);

  // funnel walls narrowing the top into the peg array
  const funnelY = 120;
  W.walls.push({ x1: pad,        y1: funnelY, x2: W.cw / 2 - 40, y2: 200 });
  W.walls.push({ x1: W.cw - pad, y1: funnelY, x2: W.cw / 2 + 40, y2: 200 });

  const rows = 14;
  const topY = 240;
  for (let r = 0; r < rows; r++) {
    const count = r + 1;
    const yy = topY + r * 42;
    for (let c = 0; c < count; c++) {
      const xx = W.cw / 2 + (c - (count - 1) / 2) * 42;
      W.pegs.push({ x: xx, y: yy, r: 5 });
    }
  }

  // collection bins
  const binTop = topY + rows * 42 + 40;
  const binCount = rows + 2;
  const binW = (W.cw - pad * 2) / binCount;
  for (let i = 0; i <= binCount; i++) {
    const bx = pad + i * binW;
    W.walls.push({ x1: bx, y1: binTop, x2: bx, y2: W.ch - pad });
  }

  W.rainSpawn = true;
  W.bgColor1 = '#0f1a28';
  W.bgColor2 = '#04080e';
  setGravityUI(true, 900);
}
