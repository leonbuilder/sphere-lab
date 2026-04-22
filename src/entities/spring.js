/**
 * Soft distance constraint between two balls (Hooke + axial damping).
 *
 * Used by cloth, domino stacks, jelly blobs, and the LINK tool.
 * `solve(dt)` applies an impulse along the axis proportional to (d - rest),
 * with a damping term that absorbs approach/recede velocity.
 *
 * Solver loop runs this multiple times per step for stiff configurations —
 * see `physics/step.js`.
 */

export class Spring {
  /**
   * @param {import('./ball.js').Ball} a
   * @param {import('./ball.js').Ball} b
   * @param {number} rest       — equilibrium length (px)
   * @param {number} stiffness  — spring constant, 0..~2 (higher = stiffer)
   * @param {number} damp       — axial velocity damping
   */
  constructor(a, b, rest, stiffness = 0.35, damp = 0.05) {
    this.a = a;
    this.b = b;
    this.rest = rest;
    this.k = stiffness;
    this.damp = damp;
  }

  solve(dt) {
    const a = this.a, b = this.b;
    const dx = b.x - a.x, dy = b.y - a.y;
    const d = Math.sqrt(dx * dx + dy * dy) || 0.0001;
    const diff = d - this.rest;
    const nx = dx / d, ny = dy / d;
    // relative velocity projected onto the spring axis
    const rv = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
    const force = diff * this.k * 60 + rv * this.damp * 60;
    const fx = nx * force, fy = ny * force;
    if (!a.pinned) { a.vx += fx / a.mass * dt; a.vy += fy / a.mass * dt; }
    if (!b.pinned) { b.vx -= fx / b.mass * dt; b.vy -= fy / b.mass * dt; }
  }
}
