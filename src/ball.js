'use strict';

/* Ball entity + the global `balls` pool + the `spawnBall` factory.
   Mass scales with r² (a disk's area); inertia uses the disk formula I = ½mr².
   `squash`/`squashAng` drive the render-time deformation on impact. */

let BID = 0;
class Ball {
  constructor(x, y, r, mat) {
    this.id = ++BID;
    this.x = x; this.y = y;
    this.px = x; this.py = y;
    this.vx = 0; this.vy = 0;
    this.r = r;
    this.mat = mat;
    this.mass = r * r * mat.density * 0.001;
    this.inertia = 0.5 * this.mass * r * r;
    this.angle = rand(0, TAU);
    this.omega = 0;
    this.grabbed = false;
    this.pinned = false;
    this.life = 0;
    this.squash = 1;
    this.squashAng = 0;
    this.trailT = 0;
    this.trail = [];
    this.heat = 0;
    this.charge = 0;
    this.sparkT = 0;
  }

  kineticEnergy() {
    return 0.5 * this.mass * (this.vx * this.vx + this.vy * this.vy)
         + 0.5 * this.inertia * this.omega * this.omega;
  }

  effectiveColor() {
    let c = this.mat.color;
    if (PHYS.heatFx && this.heat > 0.05) c = mix(c, '#ffc040', Math.min(1, this.heat));
    if (this.heat > 0.5) c = mix(c, '#ff4020', (this.heat - 0.5) * 2);
    return c;
  }
}

const balls = [];

/* Currently-selected spawn material. Mutated by buildMatButtons/keyboard in ui.js. */
let selectedMat = 'rubber';

/* Capped to keep the solver friendly on slower machines. */
function spawnBall(x, y) {
  if (balls.length > 260) return null;
  const mat = MATERIALS[selectedMat];
  const b = new Ball(x, y, PHYS.spawnRadius, mat);
  b.vx = rand(-30, 30); b.vy = rand(-30, 30);
  b.omega = rand(-2, 2);
  balls.push(b);
  return b;
}
