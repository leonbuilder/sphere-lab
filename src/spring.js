'use strict';

/* Soft distance constraint between two balls. Hooke's law + axial damping.
   `solve` applies an impulse along the axis proportional to (d - rest).
   Sub-stepping happens in physics.js; springs get several passes per step. */
class Spring {
  constructor(a, b, rest, stiffness = 0.35, damp = 0.05) {
    this.a = a; this.b = b;
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
    const rv = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
    const force = diff * this.k * 60 + rv * this.damp * 60;
    const fx = nx * force, fy = ny * force;
    if (!a.pinned) { a.vx += fx / a.mass * dt; a.vy += fy / a.mass * dt; }
    if (!b.pinned) { b.vx -= fx / b.mass * dt; b.vy -= fy / b.mass * dt; }
  }
}
