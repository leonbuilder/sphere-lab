/** Hanging cloth: grid of tiny rubber balls with horizontal + vertical + diagonal
 *  springs. First row pins every 4th ball to create the hang pattern. */

import { W, addBox, setGravityUI } from '../core/world.js';
import { Ball, balls } from '../entities/ball.js';
import { Spring } from '../entities/spring.js';
import { MATERIALS } from '../entities/materials.js';

export default function cloth() {
  const pad = 40;
  addBox(pad, pad, W.cw - pad * 2, W.ch - pad * 2);

  const cols = 22, rows = 14;
  const gx = 40, gy = 40;
  const startX = W.cw / 2 - (cols - 1) * gx / 2;
  const startY = 120;

  /** @type {Ball[][]} */
  const grid = [];
  for (let r = 0; r < rows; r++) {
    grid.push([]);
    for (let c = 0; c < cols; c++) {
      const x = startX + c * gx, y = startY + r * gy;
      const b = new Ball(x, y, 6, MATERIALS.rubber);
      if (r === 0 && (c === 0 || c === cols - 1 || c % 4 === 0)) b.pinned = true;
      balls.push(b);
      grid[r][c] = b;
    }
  }

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (c < cols - 1) W.springs.push(new Spring(grid[r][c], grid[r][c + 1], gx, 0.8, 0.1));
      if (r < rows - 1) W.springs.push(new Spring(grid[r][c], grid[r + 1][c], gy, 0.8, 0.1));
      // diagonals keep the cloth from shearing
      if (r < rows - 1 && c < cols - 1) W.springs.push(new Spring(grid[r][c], grid[r + 1][c + 1], Math.hypot(gx, gy), 0.3, 0.05));
      if (r < rows - 1 && c > 0)        W.springs.push(new Spring(grid[r][c], grid[r + 1][c - 1], Math.hypot(gx, gy), 0.3, 0.05));
    }
  }

  W.bgColor1 = '#0f0c1e';
  W.bgColor2 = '#04040a';
  setGravityUI(true, 600);
}
