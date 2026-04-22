'use strict';

/* Scene builders + the SCENES dispatch table + loadScene(name).
   Each function assumes a clean world (clearWorld already ran) and populates
   the world with balls, walls, pegs, constraints, and springs as needed.
   Scenes also set background colors and can flip gravity. */

function sceneSandbox() {
  const pad = 40;
  addBox(pad, pad, W.cw - pad * 2, W.ch - pad * 2);
  W.bgColor1 = '#0b1324'; W.bgColor2 = '#02040b';
  PHYS.gravityOn = true;
}

function sceneBilliards() {
  const pad = 80;
  addBox(pad, pad, W.cw - pad * 2, W.ch - pad * 2);
  const p = pad;
  W.walls.push({ x1: p + 30,      y1: p,           x2: p,            y2: p + 30 });
  W.walls.push({ x1: W.cw - p - 30, y1: p,         x2: W.cw - p,     y2: p + 30 });
  W.walls.push({ x1: p,           y1: W.ch - p - 30, x2: p + 30,     y2: W.ch - p });
  W.walls.push({ x1: W.cw - p,    y1: W.ch - p - 30, x2: W.cw - p - 30, y2: W.ch - p });

  const cx = W.cw * 0.7, cy = W.ch * 0.5, r = 14;
  const mats = ['gold', 'rubber', 'glass', 'plasma', 'neon'];
  let idx = 0;
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col <= row; col++) {
      const bx = cx + row * r * 2 * 0.92;
      const by = cy + (col - row / 2) * r * 2 * 1.0;
      balls.push(new Ball(bx, by, r, MATERIALS[mats[idx % mats.length]]));
      idx++;
    }
  }
  const cue = new Ball(W.cw * 0.22, W.ch * 0.5, 14, MATERIALS.steel);
  cue.vx = 900; cue.vy = rand(-20, 20);
  balls.push(cue);

  W.bgColor1 = '#0a3b22'; W.bgColor2 = '#052818';
  setGravityUI(false, 0);
}

function scenePlinko() {
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
  const binCount = 10, binY = W.ch - 200;
  for (let i = 0; i <= binCount; i++) {
    const bx = pad + (i / binCount) * (W.cw - pad * 2);
    W.walls.push({ x1: bx, y1: binY, x2: bx, y2: W.ch - pad });
  }
  W.bgColor1 = '#1a0f28'; W.bgColor2 = '#0a0614';
  setGravityUI(true, 900);
}

function sceneCradle() {
  const pad = 40;
  addBox(pad, pad, W.cw - pad * 2, W.ch - pad * 2);
  const cy = W.ch * 0.3;
  const n = 6, r = 28;
  const chainLen = W.ch * 0.42;
  const startX = W.cw / 2 - (n - 1) * r;
  for (let i = 0; i < n; i++) {
    const ax = startX + i * r * 2;
    const b = new Ball(ax, cy + chainLen, r, MATERIALS.steel);
    balls.push(b);
    W.constraints.push({ a: b, ax, ay: cy, len: chainLen });
  }
  if (balls[0]) {
    balls[0].x = startX - chainLen * 0.6;
    balls[0].y = cy + Math.sqrt(chainLen * chainLen - (chainLen * 0.6) * (chainLen * 0.6));
  }
  W.bgColor1 = '#14202a'; W.bgColor2 = '#060a12';
  setGravityUI(true, 900);
}

function sceneVortex() {
  const pad = 40;
  addBox(pad, pad, W.cw - pad * 2, W.ch - pad * 2);
  W.vortexX = W.cw / 2; W.vortexY = W.ch / 2;
  for (let i = 0; i < 50; i++) {
    const a = rand(0, TAU), d = rand(150, 400);
    const mat = MATERIALS[pick(MAT_KEYS)];
    const bb = new Ball(W.cw / 2 + Math.cos(a) * d, W.ch / 2 + Math.sin(a) * d, rand(10, 22), mat);
    bb.vx = -Math.sin(a) * 200; bb.vy = Math.cos(a) * 200;
    balls.push(bb);
  }
  W.bgColor1 = '#201028'; W.bgColor2 = '#080410';
  setGravityUI(false, 0);
}

function sceneTower() {
  const pad = 40;
  addBox(pad, pad, W.cw - pad * 2, W.ch - pad * 2);
  const cx = W.cw / 2;
  const floorY = W.ch - pad - 1;
  const r = 20;
  for (let row = 0; row < 12; row++) {
    const count = 10 - Math.min(row, 8);
    for (let c = 0; c < count; c++) {
      const mat = MATERIALS[pick(['steel', 'bowling', 'rubber', 'gold'])];
      const x = cx + (c - (count - 1) / 2) * r * 2.05;
      const y = floorY - r - row * r * 2 - rand(0, 2);
      balls.push(new Ball(x, y, r, mat));
    }
  }
  W.bgColor1 = '#1e1a0a'; W.bgColor2 = '#0c0a04';
  setGravityUI(true, 900);
}

function sceneGalton() {
  const pad = 40;
  addBox(pad, pad, W.cw - pad * 2, W.ch - pad * 2);
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
  const binTop = topY + rows * 42 + 40;
  const binCount = rows + 2;
  const binW = (W.cw - pad * 2) / binCount;
  for (let i = 0; i <= binCount; i++) {
    const bx = pad + i * binW;
    W.walls.push({ x1: bx, y1: binTop, x2: bx, y2: W.ch - pad });
  }
  W.rainSpawn = true;
  W.bgColor1 = '#0f1a28'; W.bgColor2 = '#04080e';
  setGravityUI(true, 900);
}

function scenePinball() {
  const pad = 40;
  addBox(pad, pad, W.cw - pad * 2, W.ch - pad * 2);
  const cx = W.cw / 2;
  W.walls.push({ x1: pad + 40,      y1: pad, x2: pad,         y2: pad + 160 });
  W.walls.push({ x1: W.cw - pad - 40, y1: pad, x2: W.cw - pad, y2: pad + 160 });
  W.walls.push({ x1: pad,      y1: W.ch - pad, x2: cx - 120, y2: W.ch - pad - 80 });
  W.walls.push({ x1: W.cw - pad, y1: W.ch - pad, x2: cx + 120, y2: W.ch - pad - 80 });
  W.walls.push({ x1: cx - 120, y1: W.ch - pad - 80, x2: cx - 40, y2: W.ch - pad - 30, flipper: true });
  W.walls.push({ x1: cx + 120, y1: W.ch - pad - 80, x2: cx + 40, y2: W.ch - pad - 30, flipper: true });

  W.pegs.push({ x: cx - 140, y: W.ch / 2 - 80,  r: 28, bumper: true });
  W.pegs.push({ x: cx + 140, y: W.ch / 2 - 80,  r: 28, bumper: true });
  W.pegs.push({ x: cx,       y: W.ch / 2 - 180, r: 32, bumper: true });
  W.pegs.push({ x: cx - 80,  y: W.ch / 2 + 40,  r: 22, bumper: true });
  W.pegs.push({ x: cx + 80,  y: W.ch / 2 + 40,  r: 22, bumper: true });

  W.walls.push({ x1: cx - 260, y1: W.ch / 2 + 140, x2: cx - 200, y2: W.ch / 2 + 220, bouncy: true });
  W.walls.push({ x1: cx + 260, y1: W.ch / 2 + 140, x2: cx + 200, y2: W.ch / 2 + 220, bouncy: true });

  const b = new Ball(cx, 160, 14, MATERIALS.steel);
  b.vx = rand(-40, 40);
  balls.push(b);

  W.bgColor1 = '#14081c'; W.bgColor2 = '#08040e';
  setGravityUI(true, 900);
}

function sceneCloth() {
  const pad = 40;
  addBox(pad, pad, W.cw - pad * 2, W.ch - pad * 2);
  const cols = 22, rows = 14;
  const gx = 40, gy = 40;
  const startX = W.cw / 2 - (cols - 1) * gx / 2;
  const startY = 120;
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
      if (r < rows - 1 && c < cols - 1) W.springs.push(new Spring(grid[r][c], grid[r + 1][c + 1], Math.hypot(gx, gy), 0.3, 0.05));
      if (r < rows - 1 && c > 0)        W.springs.push(new Spring(grid[r][c], grid[r + 1][c - 1], Math.hypot(gx, gy), 0.3, 0.05));
    }
  }
  W.bgColor1 = '#0f0c1e'; W.bgColor2 = '#04040a';
  setGravityUI(true, 600);
}

function sceneDomino() {
  const pad = 40;
  addBox(pad, pad, W.cw - pad * 2, W.ch - pad * 2);
  const floorY = W.ch - pad;
  const count = 24;
  const spacing = 50;
  for (let i = 0; i < count; i++) {
    const x = pad + 120 + i * spacing;
    for (let j = 0; j < 5; j++) {
      const b = new Ball(x, floorY - 18 - j * 18, 9, MATERIALS.bowling);
      balls.push(b);
      if (j > 0) {
        W.springs.push(new Spring(balls[balls.length - 1], balls[balls.length - 2], 18, 1.5, 0.12));
      }
    }
  }
  const kicker = new Ball(pad + 80, floorY - 40, 18, MATERIALS.steel);
  kicker.vx = 600;
  balls.push(kicker);
  W.bgColor1 = '#151b14'; W.bgColor2 = '#080c08';
  setGravityUI(true, 1200);
}

function sceneSolar() {
  W.solar = true;
  const sun = new Ball(W.cw / 2, W.ch / 2, 40, MATERIALS.gold);
  sun.pinned = true;
  sun.heat = 1;
  balls.push(sun);

  const mats = ['rubber', 'glass', 'neon', 'ice', 'plasma'];
  for (let i = 0; i < 5; i++) {
    const r = 120 + i * 90;
    const mat = MATERIALS[mats[i]];
    const size = rand(10, 22);
    const b = new Ball(W.cw / 2 + r, W.ch / 2, size, mat);
    // orbital velocity sqrt(GM/r) — GM ~ 120000 · k², k tuned for feel
    const v = Math.sqrt(120000 / r) * 3.2;
    b.vy = v;
    balls.push(b);
    if (i === 2 || i === 4) {
      const moon = new Ball(b.x + 30, b.y, 5, MATERIALS.steel);
      moon.vx = b.vx; moon.vy = b.vy + 180;
      balls.push(moon);
    }
  }
  for (let i = 0; i < 60; i++) {
    const a = rand(0, TAU);
    const r = rand(380, 440);
    const x = W.cw / 2 + Math.cos(a) * r;
    const y = W.ch / 2 + Math.sin(a) * r;
    const b = new Ball(x, y, rand(3, 6), MATERIALS.steel);
    const v = Math.sqrt(120000 / r) * 3.2;
    b.vx = -Math.sin(a) * v; b.vy = Math.cos(a) * v;
    balls.push(b);
  }
  W.bgColor1 = '#000008'; W.bgColor2 = '#000000';
  setGravityUI(false, 0);
}

function sceneJelly() {
  const pad = 40;
  addBox(pad, pad, W.cw - pad * 2, W.ch - pad * 2);

  /* build a soft-body blob from a center particle, a ring perimeter, radial
     spokes, and cross-bracing springs to resist shearing. */
  function buildJelly(cx, cy, size, mat, stiffness = 0.7) {
    const ringN = 20;
    const ring = [];
    const center = new Ball(cx, cy, 7, mat);
    balls.push(center);
    for (let i = 0; i < ringN; i++) {
      const a = (i / ringN) * TAU;
      const bx = cx + Math.cos(a) * size;
      const by = cy + Math.sin(a) * size;
      const b = new Ball(bx, by, 6, mat);
      balls.push(b); ring.push(b);
    }
    for (const rb of ring) W.springs.push(new Spring(center, rb, size, stiffness * 0.5, 0.1));
    for (let i = 0; i < ringN; i++) {
      const a = ring[i], b2 = ring[(i + 1) % ringN];
      const d = Math.hypot(a.x - b2.x, a.y - b2.y);
      W.springs.push(new Spring(a, b2, d, stiffness, 0.12));
    }
    for (let i = 0; i < ringN; i++) {
      const a = ring[i], b2 = ring[(i + 3) % ringN];
      const d = Math.hypot(a.x - b2.x, a.y - b2.y);
      W.springs.push(new Spring(a, b2, d, stiffness * 0.3, 0.06));
    }
    for (let i = 0; i < ringN / 2; i++) {
      const a = ring[i], b2 = ring[(i + ringN / 2) % ringN];
      const d = Math.hypot(a.x - b2.x, a.y - b2.y);
      W.springs.push(new Spring(a, b2, d, stiffness * 0.15, 0.05));
    }
  }

  buildJelly(W.cw * 0.35, 200, 80, MATERIALS.rubber, 0.7);
  buildJelly(W.cw * 0.65, 200, 60, MATERIALS.neon,   1.0);
  W.walls.push({ x1: W.cw * 0.2, y1: W.ch * 0.7, x2: W.cw * 0.8, y2: W.ch * 0.78 });
  W.bgColor1 = '#1a0f1e'; W.bgColor2 = '#080410';
  setGravityUI(true, 900);
}

function sceneWater() {
  const pad = 40;
  addBox(pad, pad, W.cw - pad * 2, W.ch - pad * 2);
  W.waterY = W.ch * 0.55;
  const kinds = ['steel', 'rubber', 'glass', 'bowling', 'neon', 'gold', 'plasma', 'ice', 'steel', 'rubber'];
  for (let i = 0; i < kinds.length; i++) {
    const x = W.cw * 0.15 + i * (W.cw * 0.72 / kinds.length);
    balls.push(new Ball(x, W.waterY - 100, rand(14, 26), MATERIALS[kinds[i]]));
  }
  W.bgColor1 = '#06162a'; W.bgColor2 = '#020814';
  setGravityUI(true, 900);
}

function sceneRain() {
  const pad = 40;
  addBox(pad, pad, W.cw - pad * 2, W.ch - pad * 2);
  const cx = W.cw / 2;
  for (let i = 0; i < 4; i++) {
    const y = 200 + i * 130;
    const off = (i % 2 === 0) ? -120 : 120;
    W.walls.push({ x1: cx + off - 160, y1: y + 40, x2: cx + off + 160, y2: y - 40 });
  }
  W.rainSpawn = true;
  W.bgColor1 = '#0a1a28'; W.bgColor2 = '#040a14';
  setGravityUI(true, 900);
}

const SCENES = {
  sandbox: sceneSandbox, billiards: sceneBilliards, plinko: scenePlinko, cradle: sceneCradle,
  vortex: sceneVortex, tower: sceneTower, galton: sceneGalton, pinball: scenePinball,
  cloth: sceneCloth, domino: sceneDomino, solar: sceneSolar, rain: sceneRain,
  jelly: sceneJelly, water: sceneWater
};

function loadScene(name) {
  clearWorld();
  W.scene = name;
  W.rainSpawn = false;

  // center camera on the world so fixed coordinates in scenes map to screen
  cam.tx = W.cw / 2; cam.ty = W.ch / 2; cam.tz = 1;
  cam.x  = W.cw / 2; cam.y  = W.ch / 2; cam.zoom = 1;

  (SCENES[name] || sceneSandbox)();

  document.getElementById('stat-scene').textContent = name.toUpperCase();
  document.querySelectorAll('#top .btn').forEach(b => b.classList.toggle('active', b.dataset.scene === name));
}
