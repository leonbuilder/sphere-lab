'use strict';

/* Transient visual particles (sparks + smoke + heat shimmer).
   Integration + cleanup is done inside physicsStep; this file just owns
   the pool and the spawn helpers. */
const particles = [];

function spawnImpact(x, y, nx, ny, magnitude, color) {
  const n = Math.min(18, Math.floor(magnitude * 0.03));
  for (let i = 0; i < n; i++) {
    const a = Math.atan2(ny, nx) + rand(-0.85, 0.85);
    const sp = rand(80, 340) * Math.min(1, magnitude * 0.003);
    particles.push({
      x, y,
      vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
      life: rand(0.25, 0.7), maxLife: 0.7,
      color: color || '#ffffff',
      size: rand(1, 3.2),
      type: 'spark'
    });
  }
}

function spawnSmoke(x, y, vx, vy, color, life = 0.9) {
  particles.push({
    x, y,
    vx: vx * 0.3 + rand(-15, 15), vy: vy * 0.3 + rand(-15, 15) - 20,
    life, maxLife: life,
    color,
    size: rand(4, 10),
    type: 'smoke'
  });
}

function spawnHeatShimmer(x, y, heat) {
  if (Math.random() > heat * 0.4) return;
  particles.push({
    x: x + rand(-10, 10), y,
    vx: rand(-20, 20), vy: -rand(40, 110),
    life: 0.8, maxLife: 0.8,
    color: '#ff804044',
    size: rand(3, 6),
    type: 'smoke'
  });
}
