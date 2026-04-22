'use strict';

/* World state + camera.
   W    — mutable scene geometry (walls, pegs, springs, constraints, bg colors, etc.)
   cam  — renderer camera; tx/ty/tz are targets that smooth toward x/y/zoom. */

const W = {
  cw: 0, ch: 0,
  walls: [], pegs: [], constraints: [], springs: [], flippers: [], bumpers: [],
  scene: 'sandbox',
  bgColor1: '#0b1324', bgColor2: '#02040b',
  rainSpawn: false,
  vortexX: 0, vortexY: 0,
  solar: false,
  waterY: undefined
};

const cam = { x: 0, y: 0, zoom: 1, tx: 0, ty: 0, tz: 1 };

function screenToWorld(sx, sy) {
  return {
    x: (sx - W.cw / 2) / cam.zoom + cam.x,
    y: (sy - W.ch / 2) / cam.zoom + cam.y
  };
}

function addBox(x, y, w, h) {
  W.walls.push(
    { x1: x,     y1: y,     x2: x + w, y2: y     },
    { x1: x + w, y1: y,     x2: x + w, y2: y + h },
    { x1: x + w, y1: y + h, x2: x,     y2: y + h },
    { x1: x,     y1: y + h, x2: x,     y2: y     }
  );
}

/* Reset all scene-scoped state. Ball pool (defined in ball.js) is cleared
   from here via the `balls` global; keeping that coupling here avoids having
   every scene reset its own arrays. */
function clearWorld() {
  balls.length = 0;
  W.walls.length = 0;
  W.pegs.length = 0;
  W.constraints.length = 0;
  W.springs.length = 0;
  W.flippers.length = 0;
  W.bumpers.length = 0;
  particles.length = 0;
  W.solar = false;
  W.waterY = undefined;
}

/* Keep the HUD gravity button + slider in sync when scenes flip gravity. */
function setGravityUI(on, g) {
  PHYS.gravityOn = on;
  if (typeof g === 'number') {
    PHYS.gravity = g;
    const s = document.getElementById('s-g');
    if (s) { s.value = g; document.getElementById('v-g').textContent = g; }
  }
  const b = document.getElementById('btn-gravity');
  if (b) {
    b.textContent = on ? 'GRAVITY ON [G]' : 'GRAVITY OFF [G]';
    b.classList.toggle('active', !on);
  }
}
