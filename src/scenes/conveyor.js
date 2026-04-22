/** Zig-zag of alternating conveyor belts moving balls left/right as they fall. */

import { W, addBox, setGravityUI } from '../core/world.js';

export default function conveyor() {
  const pad = 40;
  addBox(pad, pad, W.cw - pad * 2, W.ch - pad * 2);

  // three pairs of belts, each with opposite drag direction
  const padX = pad + 60;
  const rightX = W.cw - pad - 60;
  const belts = 3;
  for (let i = 0; i < belts; i++) {
    const y = 200 + i * 150;
    if (i % 2 === 0) {
      // belt rightward, gap on the right
      W.walls.push({ x1: padX, y1: y + 40, x2: rightX - 160, y2: y,      conveyorV: 500 });
    } else {
      // belt leftward, gap on the left
      W.walls.push({ x1: padX + 160, y1: y, x2: rightX,      y2: y + 40, conveyorV: -500 });
    }
  }

  // final catcher belt at the bottom, moving toward center
  W.walls.push({ x1: pad + 60,       y1: W.ch - pad - 40, x2: W.cw / 2, y2: W.ch - pad - 40, conveyorV: 350 });
  W.walls.push({ x1: W.cw - pad - 60, y1: W.ch - pad - 40, x2: W.cw / 2, y2: W.ch - pad - 40, conveyorV: 350 });

  // rain-spawn balls from the top so the user sees continuous motion
  W.rainSpawn = true;
  W.bgColor1 = '#0c1b2a';
  W.bgColor2 = '#050a12';
  setGravityUI(true, 800);
}
