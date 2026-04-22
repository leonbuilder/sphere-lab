'use strict';

/* Physics solver:
   - Impulse-based ball/ball and ball/wall collisions (normal + tangential)
   - Spin-aware friction with a small tangential restitution term
   - Uniform grid broadphase (adaptive cell size = max radius · 2.2)
   - Multi-iteration contact pass for stacking stability
   - Velocity-dependent coefficient of restitution (real materials lose more
     energy at high impact speed)
   - Heat coupling: frictional work heats balls; heated rubber/ice/steel get
     progressively less elastic, plasma gets bouncier (drama over realism)
   - Field forces: gravity, wind, vortex, solar attractor, Archimedes buoyancy
   - Fixed-step sub-stepping (CCD) for fast-moving balls to avoid tunneling

   Public surface used elsewhere:
     collisionCount, collisionWindow, pairsChecked
     physicsStep(dt), explode(x,y,force,radius) */

let collisionCount = 0;
const collisionWindow = [];
let pairsChecked = 0;

/* ===== Material-modifier helpers ===== */

/* Restitution falls smoothly with impact speed — a high-speed steel impact
   is noticeably more plastic than a gentle tap. Tuned against qualitative
   feel; not meant to match any particular experimental curve. */
function velRestScale(vMag) {
  return 0.35 + 0.65 / (1 + vMag * vMag * 0.0000015);
}

/* Per-ball elasticity modifier based on heat + material identity. */
function heatRestMod(b) {
  if (!PHYS.heatFx) return 1;
  const h = b.heat;
  if (h < 0.1) return 1;
  const n = b.mat.name;
  if (n === 'RUBBER') return clamp(1 - (h - 0.1) * 0.9, 0.25, 1);
  if (n === 'ICE')    return clamp(1 - (h - 0.1) * 1.8, 0.1,  1);
  if (n === 'STEEL')  return clamp(1 - (h - 0.3) * 0.6, 0.4,  1);
  if (n === 'PLASMA') return 1 + (h * 0.2);
  return 1 - h * 0.15;
}

function heatFricMod(b) {
  if (!PHYS.heatFx) return 1;
  if (b.mat.name === 'RUBBER') return 1 + b.heat * 0.5;
  if (b.mat.name === 'ICE')    return 1 + b.heat * 0.8;
  return 1 + b.heat * 0.2;
}

/* Geometric mean — a smooth low-friction + high-friction ≈ moderately low,
   which feels more physical than an arithmetic average. */
function combineFriction(muA, muB) { return Math.sqrt(muA * muB); }

function invMass(b) { return b.pinned ? 0 : 1 / b.mass; }

/* ===== Contacts ===== */

function separateBalls(a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const d = Math.sqrt(dx * dx + dy * dy) || 0.0001;
  const overlap = (a.r + b.r) - d;
  if (overlap <= 0) return false;
  const nx = dx / d, ny = dy / d;
  const ma = a.pinned ? 1e9 : a.mass;
  const mb = b.pinned ? 1e9 : b.mass;
  const total = ma + mb;
  if (!a.pinned) { a.x -= nx * overlap * (mb / total); a.y -= ny * overlap * (mb / total); }
  if (!b.pinned) { b.x += nx * overlap * (ma / total); b.y += ny * overlap * (ma / total); }
  return true;
}

function collideBalls(a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const d2 = dx * dx + dy * dy;
  const rsum = a.r + b.r;
  if (d2 >= rsum * rsum) return;
  const d = Math.sqrt(d2) || 0.0001;
  const nx = dx / d, ny = dy / d;
  const tx = -ny, ty = nx;

  separateBalls(a, b);

  const rvx = b.vx - a.vx, rvy = b.vy - a.vy;
  const vn = rvx * nx + rvy * ny;
  if (vn > 0) return;

  const baseE = (a.mat.restitution + b.mat.restitution) * 0.5;
  const e = baseE * PHYS.restitutionMul * velRestScale(Math.abs(vn)) * heatRestMod(a) * heatRestMod(b);
  const invMa = a.pinned ? 0 : 1 / a.mass;
  const invMb = b.pinned ? 0 : 1 / b.mass;
  const invSum = invMa + invMb || 1;
  const j = -(1 + e) * vn / invSum;
  a.vx -= j * nx * invMa; a.vy -= j * ny * invMa;
  b.vx += j * nx * invMb; b.vy += j * ny * invMb;

  // tangential friction + small tangential restitution (superball effect)
  const surfVA = a.omega * a.r;
  const surfVB = -b.omega * b.r;
  const rvt = (b.vx - a.vx) * tx + (b.vy - a.vy) * ty + (surfVA - surfVB);
  const mu  = combineFriction(a.mat.friction, b.mat.friction) * PHYS.frictionMul * heatFricMod(a) * heatFricMod(b);
  const et  = baseE * 0.12;
  const denom = invSum + (a.pinned ? 0 : a.r * a.r / a.inertia) + (b.pinned ? 0 : b.r * b.r / b.inertia);
  let jt = -rvt * (1 + et) / denom;
  const maxJt = Math.abs(j) * mu;
  if (jt > maxJt) jt = maxJt; else if (jt < -maxJt) jt = -maxJt;
  a.vx -= jt * tx * invMa; a.vy -= jt * ty * invMa;
  b.vx += jt * tx * invMb; b.vy += jt * ty * invMb;
  if (!a.pinned) a.omega -= jt * a.r / a.inertia;
  if (!b.pinned) b.omega -= jt * b.r / b.inertia;

  // Coulomb-ish charge interaction (weak — mostly for fun).
  if (a.charge && b.charge) {
    const f = a.charge * b.charge * 500 / (d2 + 10);
    a.vx -= f * nx * invMa;
    a.vy -= f * ny * invMa;
  }

  // heat from friction + normal impact work
  const heatGain = Math.abs(jt) * 0.00005 + Math.abs(vn) * 0.00002;
  a.heat = Math.min(1, a.heat + heatGain);
  b.heat = Math.min(1, b.heat + heatGain);

  const mag = Math.abs(j);
  if (mag > 2) {
    const hx = (a.x + b.x) * 0.5;
    const hy = (a.y + b.y) * 0.5;
    spawnImpact(hx, hy, nx, ny, mag, a.heat > 0.3 ? '#ffb040' : '#ffffff');
    a.squash = 1 - Math.min(0.32, mag * 0.0025);
    a.squashAng = Math.atan2(ny, nx);
    b.squash = 1 - Math.min(0.32, mag * 0.0025);
    b.squashAng = Math.atan2(-ny, -nx);
    Snd.collision(a.mat, b.mat, mag);
  }
  collisionCount++;
}

function collideWall(b, wall) {
  const { x1, y1, x2, y2 } = wall;
  const wx = x2 - x1, wy = y2 - y1;
  const wlen2 = wx * wx + wy * wy;
  let t = ((b.x - x1) * wx + (b.y - y1) * wy) / wlen2;
  t = clamp(t, 0, 1);
  const cx = x1 + wx * t, cy = y1 + wy * t;
  const dx = b.x - cx, dy = b.y - cy;
  const d2 = dx * dx + dy * dy;
  if (d2 >= b.r * b.r) return;
  const d = Math.sqrt(d2) || 0.0001;
  const nx = dx / d, ny = dy / d;
  b.x = cx + nx * b.r;
  b.y = cy + ny * b.r;
  const vn = b.vx * nx + b.vy * ny;
  if (vn >= 0) return;
  const baseE = b.mat.restitution * (wall.bouncy ? 1.4 : 1);
  const e = baseE * PHYS.restitutionMul * velRestScale(Math.abs(vn)) * heatRestMod(b);
  const tx = -ny, ty = nx;
  const vt = b.vx * tx + b.vy * ty;
  const surfV = b.omega * b.r;
  const relT = vt + surfV;
  b.vx -= vn * nx * (1 + e);
  b.vy -= vn * ny * (1 + e);
  // Amplify friction at low normal speed so balls roll + come to rest
  // rather than jitter indefinitely.
  const restFactor = Math.abs(vn) < 80 ? 1.6 : 1;
  const mu = b.mat.friction * PHYS.frictionMul * heatFricMod(b) * restFactor;
  const denom = 1 + b.r * b.r / b.inertia * b.mass;
  let jt = -relT * b.mass * (1 + baseE * 0.08) / denom;
  const maxJt = Math.abs(vn) * mu * b.mass;
  if (jt > maxJt) jt = maxJt; else if (jt < -maxJt) jt = -maxJt;
  b.vx += jt * tx / b.mass; b.vy += jt * ty / b.mass;
  b.omega += jt * b.r / b.inertia;

  const heatGain = Math.abs(jt) * 0.00007;
  b.heat = Math.min(1, b.heat + heatGain);

  const mag = Math.abs(vn) * b.mass;
  if (mag > 5) {
    spawnImpact(cx, cy, nx, ny, mag * 0.8, '#b0c0d0');
    b.squash = 1 - Math.min(0.38, Math.abs(vn) * 0.0008);
    b.squashAng = Math.atan2(ny, nx);
    Snd.wall(b.mat, mag);
  }
  collisionCount++;
}

function collidePeg(b, peg) {
  const dx = b.x - peg.x, dy = b.y - peg.y;
  const d2 = dx * dx + dy * dy;
  const rsum = b.r + peg.r;
  if (d2 >= rsum * rsum) return;
  const d = Math.sqrt(d2) || 0.0001;
  const nx = dx / d, ny = dy / d;
  b.x = peg.x + nx * rsum;
  b.y = peg.y + ny * rsum;
  const vn = b.vx * nx + b.vy * ny;
  if (vn >= 0) return;
  const e = b.mat.restitution * PHYS.restitutionMul * (peg.bumper ? 1.8 : 1);
  b.vx -= vn * nx * (1 + e);
  b.vy -= vn * ny * (1 + e);
  const tx = -ny, ty = nx;
  const vt = b.vx * tx + b.vy * ty;
  const surfV = b.omega * b.r;
  let jt = -(vt + surfV) * 0.3;
  const maxJ = Math.abs(vn) * b.mat.friction * PHYS.frictionMul * 3;
  jt = clamp(jt, -maxJ, maxJ);
  b.vx += jt * tx; b.vy += jt * ty;
  b.omega += jt * b.r / b.inertia * b.mass;

  const mag = Math.abs(vn) * b.mass;
  if (mag > 4) {
    spawnImpact(peg.x + nx * peg.r, peg.y + ny * peg.r, nx, ny, mag, peg.bumper ? '#ffcc40' : '#ffcc66');
    if (peg.bumper) {
      // Pinball-style kicker: add a normal-direction impulse on top of the bounce.
      b.vx += nx * 500 * invMass(b);
      b.vy += ny * 500 * invMass(b);
      Snd.bonk(800 + rand(-100, 100), 0.2, 0.1, 'square');
    } else {
      Snd.wall(b.mat, mag);
    }
  }
  collisionCount++;
}

/* ===== Broadphase ===== */

/* Hashes balls into grid cells; emits candidate pairs from each cell plus its
   4 forward-directional neighbors (no duplicates). Cell size adapts to the
   largest ball so a fat bowling ball can't escape its neighborhood. */
const _gridMap = new Map();
function _key(cx, cy) { return cx + ':' + cy; }

function buildPairs() {
  let maxR = 20;
  for (const b of balls) if (b.r > maxR) maxR = b.r;
  const cell = Math.max(40, maxR * 2.2);
  _gridMap.clear();
  for (let i = 0; i < balls.length; i++) {
    const b = balls[i];
    const cx = Math.floor(b.x / cell), cy = Math.floor(b.y / cell);
    const k = _key(cx, cy);
    let list = _gridMap.get(k);
    if (!list) { list = []; _gridMap.set(k, list); }
    list.push(b);
    b._cx = cx; b._cy = cy;
  }
  const pairs = [];
  for (const list of _gridMap.values()) {
    const cx = list[0]._cx, cy = list[0]._cy;
    for (let i = 0; i < list.length; i++) {
      const a = list[i];
      for (let j = i + 1; j < list.length; j++) pairs.push([a, list[j]]);
    }
    const dirs = [[1, 0], [0, 1], [1, 1], [1, -1]];
    for (const [dx, dy] of dirs) {
      const nl = _gridMap.get(_key(cx + dx, cy + dy));
      if (!nl) continue;
      for (const a of list) for (const b of nl) pairs.push([a, b]);
    }
  }
  return pairs;
}

/* ===== Field forces ===== */

function applyVortex(b, dt) {
  if (W.scene !== 'vortex') return;
  const dx = W.vortexX - b.x, dy = W.vortexY - b.y;
  const d2 = dx * dx + dy * dy;
  const d = Math.sqrt(d2) || 0.001;
  const f = 50000 / (d2 + 1000);
  b.vx += (dx / d) * f * dt;
  b.vy += (dy / d) * f * dt;
  b.vx += (-dy / d) * f * dt * 0.7;
  b.vy += (dx / d) * f * dt * 0.7;
}

function applySolar(b, dt) {
  if (!W.solar) return;
  const cx = W.cw / 2, cy = W.ch / 2;
  const dx = cx - b.x, dy = cy - b.y;
  const d2 = dx * dx + dy * dy;
  const d = Math.sqrt(d2) || 0.001;
  if (d < 50) return;
  const f = 120000 / (d2 + 100);
  b.vx += (dx / d) * f * dt;
  b.vy += (dy / d) * f * dt;
}

/* Archimedes buoyancy — F_buoy = ρ_fluid · V_submerged · g, compared against
   the ball's weight. Water column starts at W.waterY (set by sceneWater). */
function applyBuoyancy(b, dt) {
  if (W.waterY === undefined) return;
  const submerged = Math.min(b.r * 2, (b.y + b.r) - W.waterY);
  if (submerged <= 0) return;
  const frac = clamp(submerged / (b.r * 2), 0, 1);
  const fluidDensity = 1.0;
  const ballVol = Math.PI * b.r * b.r * 0.001;
  const buoyForce = fluidDensity * ballVol * frac * PHYS.gravity * 1.2;
  b.vy -= buoyForce / b.mass * dt;
  // viscous drag (linear + quadratic in speed)
  const v = len(b.vx, b.vy);
  const drag = (2 + v * 0.002) * frac;
  b.vx *= Math.max(0, 1 - drag * dt);
  b.vy *= Math.max(0, 1 - drag * dt);
  b.omega *= Math.max(0, 1 - drag * dt * 1.5);
  // splash on entry
  if (b.py + b.r < W.waterY && b.y + b.r >= W.waterY && b.vy > 60) {
    const mag = Math.min(10, b.vy * 0.03);
    for (let i = 0; i < mag * 3; i++) {
      const a = -Math.PI / 2 + rand(-0.9, 0.9);
      particles.push({
        x: b.x + rand(-b.r, b.r), y: W.waterY,
        vx: Math.cos(a) * rand(60, 180), vy: Math.sin(a) * rand(80, 220),
        life: 0.9, maxLife: 0.9,
        color: '#6fb0e0', size: rand(1.5, 3.2), type: 'spark'
      });
    }
    Snd.noise(0.12, Math.min(0.15, b.vy * 0.0005), 3000);
  }
}

/* ===== Public: physicsStep + explode ===== */

function physicsStep(dt) {
  // random rain/galton spawning
  if (W.rainSpawn && Math.random() < 0.1 && balls.length < 200) {
    const mat = MATERIALS[pick(MAT_KEYS)];
    const b = new Ball(rand(W.cw * 0.1, W.cw * 0.9), 60, rand(7, 16), mat);
    b.vx = rand(-30, 30) + PHYS.wind * 0.1;
    balls.push(b);
  }

  for (const b of balls) {
    b.life += dt;
    b.squash = lerp(b.squash, 1, clamp(dt * 20, 0, 1));
    b.heat *= 0.996;
    if (b.heat > 0.3) spawnHeatShimmer(b.x, b.y - b.r, b.heat);

    if (b.pinned) { b.vx = b.vy = b.omega = 0; continue; }

    if (b.grabbed) {
      b.vx = (mouse.wx - b.x) * 25 - b.vx * 8 * dt;
      b.vy = (mouse.wy - b.y) * 25 - b.vy * 8 * dt;
    }

    if (PHYS.gravityOn) b.vy += PHYS.gravity * dt;
    if (PHYS.wind) b.vx += PHYS.wind * dt;

    applyVortex(b, dt);
    applySolar(b, dt);
    applyBuoyancy(b, dt);

    // tool-driven forces
    if (mouse.down && TOOL === 'push') {
      const dx = b.x - mouse.wx, dy = b.y - mouse.wy;
      const d2 = dx * dx + dy * dy;
      if (d2 < 200 * 200) {
        const d = Math.sqrt(d2) || 0.001;
        const f = (200 - d) * 800 / b.mass;
        b.vx += dx / d * f * dt;
        b.vy += dy / d * f * dt;
      }
    }
    if (mouse.down && TOOL === 'heat') {
      const dx = b.x - mouse.wx, dy = b.y - mouse.wy;
      if (dx * dx + dy * dy < 100 * 100) {
        b.heat = Math.min(1, b.heat + dt * 3);
      }
    }

    // quadratic drag
    const vmag = len(b.vx, b.vy);
    const dragK = PHYS.drag * (1 + vmag * 0.0018);
    const dragFactor = Math.max(0, 1 - dragK * dt);
    b.vx *= dragFactor; b.vy *= dragFactor;
    b.omega *= Math.max(0, 1 - PHYS.drag * dt * 0.8);

    // 2D Magnus effect — pre-snapshot v to avoid mutual mutation
    if (vmag > 10 && Math.abs(b.omega) > 0.1) {
      const magK = PHYS.magnus * 0.002;
      const mvx = -b.vy * b.omega * magK * dt;
      const mvy =  b.vx * b.omega * magK * dt;
      b.vx += mvx;
      b.vy += mvy;
    }

    // speed cap (prevents numeric runaway / tunneling despite CCD)
    const maxV = 4000;
    const spd = len(b.vx, b.vy);
    if (spd > maxV) { b.vx *= maxV / spd; b.vy *= maxV / spd; }

    // CCD: split motion into sub-steps small enough that no ball travels
    // more than ~60% of its radius per step.
    const steps = Math.max(1, Math.ceil(spd * dt / (b.r * 0.6)));
    const sdt = dt / steps;
    b.px = b.x; b.py = b.y;
    for (let s = 0; s < steps; s++) {
      b.x += b.vx * sdt;
      b.y += b.vy * sdt;
      for (const w of W.walls) collideWall(b, w);
      for (const peg of W.pegs) collidePeg(b, peg);
    }
    b.angle += b.omega * dt;

    if (PHYS.trails) {
      b.trailT -= dt;
      if (b.trailT <= 0) {
        b.trailT = 0.02;
        b.trail.push({ x: b.x, y: b.y });
        if (b.trail.length > 30) b.trail.shift();
      }
    } else if (b.trail.length) {
      b.trail.length = 0;
    }
  }

  // springs + pendulum constraints (more iters when stiff)
  const springIters = W.springs.length > 200 ? 3 : 6;
  for (let i = 0; i < springIters; i++) {
    for (const s of W.springs) s.solve(dt / springIters * 4);
    for (const c of W.constraints) {
      if (!c.a || c.a.pinned) continue;
      const a = c.a;
      const dx = a.x - c.ax, dy = a.y - c.ay;
      const d = Math.sqrt(dx * dx + dy * dy) || 0.0001;
      const nx = dx / d, ny = dy / d;
      const corr = d - c.len;
      if (Math.abs(corr) < 0.001) continue;
      a.x -= nx * corr;
      a.y -= ny * corr;
      const vn = a.vx * nx + a.vy * ny;
      if ((corr > 0 && vn > 0) || (corr < 0 && vn < 0)) {
        a.vx -= vn * nx; a.vy -= vn * ny;
      }
    }
  }

  // grid broadphase + multi-pass contact solve
  if (balls.length > 0) {
    const pairs = buildPairs();
    pairsChecked = pairs.length;
    const iters = balls.length > 120 ? 2 : 3;
    for (let it = 0; it < iters; it++) {
      for (const pr of pairs) collideBalls(pr[0], pr[1]);
    }
  }

  // particles
  for (const p of particles) {
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (p.type === 'smoke') {
      p.size *= 1 + dt * 0.4;
      p.vx *= 1 - dt * 1.2;
      p.vy *= 1 - dt * 1.2;
    } else {
      p.vx *= 1 - dt * 0.6;
      p.vy *= 1 - dt * 0.6;
      if (PHYS.gravityOn) p.vy += 400 * dt;
    }
  }
  for (let i = particles.length - 1; i >= 0; i--) if (particles[i].life <= 0) particles.splice(i, 1);

  // cull escaped
  for (let i = balls.length - 1; i >= 0; i--) {
    const b = balls[i];
    if (b.x < -800 || b.x > W.cw + 800 || b.y > W.ch + 600 || b.y < -500) {
      balls.splice(i, 1);
    }
  }
}

/* Radial explosion — pushes balls outward + spawns sparks + smoke + noise. */
function explode(x, y, force, radius) {
  for (const b of balls) {
    if (b.pinned) continue;
    const dx = b.x - x, dy = b.y - y;
    const d2 = dx * dx + dy * dy;
    if (d2 > radius * radius) continue;
    const d = Math.sqrt(d2) || 0.001;
    const falloff = 1 - d / radius;
    const f = force * falloff / b.mass;
    b.vx += dx / d * f * 0.02;
    b.vy += dy / d * f * 0.02;
    b.omega += rand(-5, 5) * falloff;
  }
  for (let i = 0; i < 60; i++) {
    const a = rand(0, TAU);
    const sp = rand(120, 440);
    particles.push({
      x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
      life: rand(0.3, 0.8), maxLife: 0.8,
      color: pick(['#ffcc66', '#ff8844', '#ffffff']),
      size: rand(1, 3.2), type: 'spark'
    });
  }
  for (let i = 0; i < 20; i++) {
    particles.push({
      x, y, vx: rand(-40, 40), vy: rand(-100, 20),
      life: 1.2, maxLife: 1.2,
      color: '#80808088', size: rand(6, 14), type: 'smoke'
    });
  }
  Snd.bonk(120, 0.3, 0.4, 'sawtooth');
  Snd.noise(0.3, 0.2, 2000);
}
