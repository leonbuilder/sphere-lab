/**
 * Main animation loop. Runs at display rate; drives a fixed-step physics
 * accumulator internally (240 Hz).
 *
 * Per frame:
 *   1. Sample FPS every 0.3 s and push to the telemetry sparklines.
 *   2. Smooth camera current toward target.
 *   3. Drain the physics accumulator into fixed steps.
 *   4. Sample collisions-per-second + kinetic energy; push to sparklines.
 *   5. Render: background → world → balls → water → particles → flares →
 *      tool previews → bloom → postfx.
 *   6. Update HUD stats.
 */

import { PHYS } from './core/config.js';
import { W, cam } from './core/world.js';
import { TAU, clamp, lerp, len } from './core/math.js';
import { balls, selectedMat } from './entities/ball.js';
import { MATERIALS } from './entities/materials.js';
import { physicsStep } from './physics/step.js';
import { stats, collisionWindow } from './physics/stats.js';
import { canvas, ctx, dpr, sceneCanvas, sceneCtx } from './render/canvas.js';
import { drawBackground } from './render/background.js';
import {
  drawWalls, drawPegs, drawConstraints, drawSprings,
  drawVortex, drawWater, drawSolarCenter, drawBallShadows, drawFlippers
} from './render/world.js';
import { drawBall, drawTrail } from './render/ball.js';
import { drawAO, drawParticles, drawLensFlares } from './render/effects.js';
import { doBloomPass, doPostFX } from './render/postfx.js';
import { renderSparkline } from './render/statsGraph.js';
import { mouse } from './input/mouse.js';
import { getTool } from './input/tools.js';

const fpsHistory = /** @type {number[]} */ ([]);
const cpsHistory = /** @type {number[]} */ ([]);
const energyHistory = /** @type {number[]} */ ([]);

const FPS_CANVAS    = /** @type {HTMLCanvasElement} */ (document.getElementById('fps-canvas'));
const CPS_CANVAS    = /** @type {HTMLCanvasElement} */ (document.getElementById('cps-canvas'));
const ENERGY_CANVAS = /** @type {HTMLCanvasElement} */ (document.getElementById('energy-canvas'));

let lastT = performance.now();
let fpsTime = 0, fpsCount = 0, fps = 0;
let sampleTime = 0;
let accumulator = 0;
const FIXED_STEP = 1 / 240;

function frame(now) {
  const dt = Math.min(0.05, (now - lastT) / 1000);
  lastT = now;

  // fps sampling (coarser granularity than render rate)
  fpsTime += dt;
  fpsCount++;
  if (fpsTime >= 0.3) {
    fps = Math.round(fpsCount / fpsTime);
    fpsTime = 0; fpsCount = 0;
    fpsHistory.push(fps);
    if (fpsHistory.length > 80) fpsHistory.shift();
    renderSparkline(FPS_CANVAS, fpsHistory, { color: '#ffaa33', max: 75, reference: 60 });
  }

  // camera smoothing
  cam.x    = lerp(cam.x,    cam.tx, clamp(dt * 10, 0, 1));
  cam.y    = lerp(cam.y,    cam.ty, clamp(dt * 10, 0, 1));
  cam.zoom = lerp(cam.zoom, cam.tz, clamp(dt * 12, 0, 1));

  // fixed-timestep physics
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

  // rolling 1s collision rate
  collisionWindow.push({ t: now, c: stats.collisions });
  stats.collisions = 0;
  while (collisionWindow.length && now - collisionWindow[0].t > 1000) collisionWindow.shift();
  const cps = collisionWindow.reduce((s, x) => s + x.c, 0);

  // sample telemetry (every 150 ms to keep graphs readable)
  sampleTime += dt;
  if (sampleTime >= 0.15) {
    sampleTime = 0;
    cpsHistory.push(cps);
    if (cpsHistory.length > 80) cpsHistory.shift();
    let ke = 0; for (const b of balls) ke += b.kineticEnergy();
    energyHistory.push(ke);
    if (energyHistory.length > 80) energyHistory.shift();
    renderSparkline(CPS_CANVAS, cpsHistory, { color: '#6fb9ff' });
    renderSparkline(ENERGY_CANVAS, energyHistory, { color: '#4bde9a' });
  }

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
  drawFlippers(ctx);
  drawConstraints(ctx);
  drawSprings(ctx);
  drawVortex(ctx);
  drawBallShadows(ctx);

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

  drawToolPreviews(ctx);

  ctx.restore();

  doBloomPass();
  doPostFX();

  updateHudText(cps);
  requestAnimationFrame(frame);
}

function drawToolPreviews(tx) {
  const TOOL = getTool();

  if (mouse.down && TOOL === 'spawn' && !mouse.grab) {
    const dx = mouse.wsx - mouse.wx, dy = mouse.wsy - mouse.wy;
    const d = len(dx, dy);
    if (d > 5) {
      tx.strokeStyle = '#ffaa33'; tx.lineWidth = 2;
      tx.setLineDash([6, 4]);
      tx.beginPath(); tx.moveTo(mouse.wsx, mouse.wsy); tx.lineTo(mouse.wx, mouse.wy); tx.stroke();
      tx.setLineDash([]);
      const mat = MATERIALS[selectedMat.id];
      tx.fillStyle = mat.color + '44';
      tx.strokeStyle = mat.color; tx.lineWidth = 1;
      tx.beginPath(); tx.arc(mouse.wsx, mouse.wsy, PHYS.spawnRadius, 0, TAU);
      tx.fill(); tx.stroke();
      tx.strokeStyle = '#ffaa33'; tx.lineWidth = 2;
      const ax = mouse.wsx + dx, ay = mouse.wsy + dy;
      const ang = Math.atan2(dy, dx);
      tx.beginPath();
      tx.moveTo(mouse.wsx, mouse.wsy); tx.lineTo(ax, ay);
      tx.moveTo(ax, ay); tx.lineTo(ax - Math.cos(ang - 0.35) * 14, ay - Math.sin(ang - 0.35) * 14);
      tx.moveTo(ax, ay); tx.lineTo(ax - Math.cos(ang + 0.35) * 14, ay - Math.sin(ang + 0.35) * 14);
      tx.stroke();
    }
  }

  if (TOOL === 'draw' && mouse.draw.active) {
    tx.strokeStyle = '#ffaa33'; tx.lineWidth = 3;
    tx.globalAlpha = 0.7;
    tx.lineCap = 'round';
    tx.beginPath();
    tx.moveTo(mouse.draw.x1, mouse.draw.y1);
    tx.lineTo(mouse.wx, mouse.wy);
    tx.stroke();
    tx.globalAlpha = 1;
  }

  if (TOOL === 'link' && mouse.linkFirst) {
    tx.strokeStyle = '#b285ff';
    tx.setLineDash([4, 4]);
    tx.lineWidth = 2;
    tx.beginPath(); tx.moveTo(mouse.linkFirst.x, mouse.linkFirst.y); tx.lineTo(mouse.wx, mouse.wy);
    tx.stroke();
    tx.setLineDash([]);
    tx.strokeStyle = '#b285ff'; tx.lineWidth = 2;
    tx.beginPath(); tx.arc(mouse.linkFirst.x, mouse.linkFirst.y, mouse.linkFirst.r + 3, 0, TAU); tx.stroke();
  }

  if (TOOL === 'push' || TOOL === 'heat') {
    const r = TOOL === 'push' ? 200 : 100;
    tx.strokeStyle = TOOL === 'push' ? '#4bde9a' : '#ff5f7a';
    tx.globalAlpha = 0.3 + (mouse.down ? 0.3 : 0);
    tx.lineWidth = 2;
    tx.setLineDash([4, 4]);
    tx.beginPath(); tx.arc(mouse.wx, mouse.wy, r, 0, TAU); tx.stroke();
    tx.setLineDash([]);
    tx.globalAlpha = 1;
  }

  if (mouse.grab) {
    tx.strokeStyle = '#4bde9a'; tx.lineWidth = 1;
    tx.setLineDash([4, 3]);
    tx.beginPath(); tx.moveTo(mouse.grab.x, mouse.grab.y); tx.lineTo(mouse.wx, mouse.wy);
    tx.stroke();
    tx.setLineDash([]);
  }
}

function updateHudText(cps) {
  document.getElementById('stat-n').textContent     = String(balls.length);
  document.getElementById('stat-fps').textContent   = String(fps);
  document.getElementById('stat-col').textContent   = String(cps);
  document.getElementById('stat-links').textContent = String(W.springs.length + W.constraints.length);
  document.getElementById('stat-zoom').textContent  = cam.zoom.toFixed(2);
  document.getElementById('stat-pairs').textContent = String(stats.pairs);
  let ke = 0; for (const b of balls) ke += b.kineticEnergy();
  document.getElementById('stat-e').textContent = String(Math.round(ke));
}

export function startLoop() {
  lastT = performance.now();
  requestAnimationFrame(frame);
}
