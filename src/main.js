'use strict';

/* Entry point + main frame loop.
   - Fixed-timestep physics (240 Hz) with accumulator + max-iter clamp to
     avoid the "spiral of death" when the main thread stalls.
   - Rendering runs once per animation frame, after the physics has caught up.
   - HUD stats are read out of module-level physics counters. */

let lastT = performance.now();
let fpsTime = 0, fpsCount = 0, fps = 0;
const fpsHistory = [];
let accumulator = 0;
const FIXED_STEP = 1 / 240;

function frame(now) {
  const dt = Math.min(0.05, (now - lastT) / 1000);
  lastT = now;

  fpsTime += dt;
  fpsCount++;
  if (fpsTime >= 0.3) {
    fps = Math.round(fpsCount / fpsTime);
    fpsTime = 0; fpsCount = 0;
    fpsHistory.push(fps);
    if (fpsHistory.length > 70) fpsHistory.shift();
    renderFpsGraph(fpsHistory);
  }

  // camera smoothing toward target
  cam.x    = lerp(cam.x,    cam.tx, clamp(dt * 10, 0, 1));
  cam.y    = lerp(cam.y,    cam.ty, clamp(dt * 10, 0, 1));
  cam.zoom = lerp(cam.zoom, cam.tz, clamp(dt * 12, 0, 1));

  if (!PHYS.paused) {
    accumulator += dt * PHYS.slowmo;
    let its = 0;
    while (accumulator >= FIXED_STEP && its < 8) {
      physicsStep(FIXED_STEP);
      accumulator -= FIXED_STEP;
      its++;
    }
    if (its === 8) accumulator = 0;
  }

  // rolling 1s collision count
  collisionWindow.push({ t: now, c: collisionCount });
  collisionCount = 0;
  while (collisionWindow.length && now - collisionWindow[0].t > 1000) collisionWindow.shift();
  const cps = collisionWindow.reduce((s, x) => s + x.c, 0);

  // ===== Render =====
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (PHYS.motionBlur) {
    ctx.fillStyle = 'rgba(5, 8, 18, 0.35)';
    ctx.fillRect(0, 0, W.cw, W.ch);
  } else {
    drawBackground(ctx);
  }

  ctx.save();
  ctx.translate(W.cw / 2 - cam.x * cam.zoom, W.ch / 2 - cam.y * cam.zoom);
  ctx.scale(cam.zoom, cam.zoom);

  drawSolarCenter(ctx);
  drawWalls(ctx);
  drawPegs(ctx);
  drawConstraints(ctx);
  drawSprings(ctx);
  drawVortex(ctx);
  drawBallShadows(ctx);

  // If any refractive ball is onscreen, snapshot the current paint into
  // sceneCanvas first — the ball shader uses it as its "texture".
  if (PHYS.refract && balls.some(b => (b.mat.refract || 0) > 0.3)) {
    ctx.restore();
    sceneCtx.setTransform(1, 0, 0, 1, 0, 0);
    sceneCtx.drawImage(canvas, 0, 0, W.cw * dpr, W.ch * dpr, 0, 0, W.cw, W.ch);
    ctx.save();
    ctx.translate(W.cw / 2 - cam.x * cam.zoom, W.ch / 2 - cam.y * cam.zoom);
    ctx.scale(cam.zoom, cam.zoom);
  }

  if (PHYS.trails) for (const b of balls) drawTrail(ctx, b);
  drawAO(ctx);
  for (const b of balls) drawBall(ctx, b);
  drawWater(ctx);
  drawParticles(ctx);
  drawLensFlares(ctx);

  // slingshot preview (spawn tool drag)
  if (mouse.down && TOOL === 'spawn' && !mouse.grab) {
    const dx = mouse.wsx - mouse.wx, dy = mouse.wsy - mouse.wy;
    const d = len(dx, dy);
    if (d > 5) {
      ctx.strokeStyle = '#ffb340'; ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(mouse.wsx, mouse.wsy); ctx.lineTo(mouse.wx, mouse.wy);
      ctx.stroke();
      ctx.setLineDash([]);
      const mat = MATERIALS[selectedMat];
      ctx.fillStyle = mat.color + '44';
      ctx.strokeStyle = mat.color; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(mouse.wsx, mouse.wsy, PHYS.spawnRadius, 0, TAU);
      ctx.fill(); ctx.stroke();
      ctx.strokeStyle = '#ffb340'; ctx.lineWidth = 2;
      const ax = mouse.wsx + dx, ay = mouse.wsy + dy;
      const ang = Math.atan2(dy, dx);
      ctx.beginPath();
      ctx.moveTo(mouse.wsx, mouse.wsy); ctx.lineTo(ax, ay);
      ctx.moveTo(ax, ay); ctx.lineTo(ax - Math.cos(ang - 0.35) * 14, ay - Math.sin(ang - 0.35) * 14);
      ctx.moveTo(ax, ay); ctx.lineTo(ax - Math.cos(ang + 0.35) * 14, ay - Math.sin(ang + 0.35) * 14);
      ctx.stroke();
    }
  }

  // draw tool wall preview
  if (TOOL === 'draw' && mouse.draw.active) {
    ctx.strokeStyle = '#ffb340'; ctx.lineWidth = 3;
    ctx.globalAlpha = 0.7;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(mouse.draw.x1, mouse.draw.y1);
    ctx.lineTo(mouse.wx, mouse.wy);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // link-tool preview
  if (TOOL === 'link' && mouse.linkFirst) {
    ctx.strokeStyle = '#c878ff';
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(mouse.linkFirst.x, mouse.linkFirst.y); ctx.lineTo(mouse.wx, mouse.wy);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = '#c878ff'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(mouse.linkFirst.x, mouse.linkFirst.y, mouse.linkFirst.r + 3, 0, TAU); ctx.stroke();
  }

  // push / heat radius indicator
  if (TOOL === 'push' || TOOL === 'heat') {
    const r = TOOL === 'push' ? 200 : 100;
    ctx.strokeStyle = TOOL === 'push' ? '#4affb4' : '#ff6020';
    ctx.globalAlpha = 0.3 + (mouse.down ? 0.3 : 0);
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.arc(mouse.wx, mouse.wy, r, 0, TAU); ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  }

  // grab line
  if (mouse.grab) {
    ctx.strokeStyle = '#4affb4'; ctx.lineWidth = 1;
    ctx.setLineDash([4, 3]);
    ctx.beginPath(); ctx.moveTo(mouse.grab.x, mouse.grab.y); ctx.lineTo(mouse.wx, mouse.wy);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  ctx.restore();

  doBloomPass();
  doPostFX();

  // HUD
  document.getElementById('stat-n').textContent     = balls.length;
  document.getElementById('stat-fps').textContent   = fps;
  document.getElementById('stat-col').textContent   = cps;
  document.getElementById('stat-links').textContent = W.springs.length + W.constraints.length;
  document.getElementById('stat-zoom').textContent  = cam.zoom.toFixed(2);
  document.getElementById('stat-pairs').textContent = pairsChecked;
  let ke = 0; for (const b of balls) ke += b.kineticEnergy();
  document.getElementById('stat-e').textContent = Math.round(ke);

  requestAnimationFrame(frame);
}

function init() {
  resize();
  addEventListener('resize', () => { resize(); loadScene(W.scene); });
  buildMatButtons();
  bindSliders();
  bindButtons();
  setTool('spawn');
  loadScene('sandbox');
  requestAnimationFrame(frame);
}

init();
