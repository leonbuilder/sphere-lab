/**
 * Mouse state + all canvas mouse/wheel handlers.
 *
 * Exported state:
 *   mouse.x,   mouse.y        — screen coords (CSS px)
 *   mouse.wx,  mouse.wy       — world coords
 *   mouse.down, right, middle — button state
 *   mouse.shift               — shift pressed at last mousedown
 *   mouse.sx,  mouse.sy       — drag-start in screen coords
 *   mouse.wsx, mouse.wsy      — drag-start in world coords
 *   mouse.grab                — ball currently being held
 *   mouse.linkFirst           — first ball picked in LINK tool
 *   mouse.draw                — { x1, y1, active } for the DRAW tool
 *
 * `step.js` reads `mouse` + `getTool()` each frame for the PUSH/HEAT tools.
 * `main.js` reads `mouse` for the slingshot preview.
 */

import { clamp, len, rand } from '../core/math.js';
import { W, cam, screenToWorld } from '../core/world.js';
import { canvas } from '../render/canvas.js';
import { balls, spawnBall } from '../entities/ball.js';
import { Spring } from '../entities/spring.js';
import { Snd } from '../audio/sound.js';
import { explode } from '../physics/explode.js';
import { getTool, ballAt, wallAt } from './tools.js';

export const mouse = {
  x: 0, y: 0, wx: 0, wy: 0,
  down: false, right: false, middle: false, shift: false,
  sx: 0, sy: 0, wsx: 0, wsy: 0,
  /** @type {import('../entities/ball.js').Ball | null} */ grab: null,
  /** @type {import('../entities/ball.js').Ball | null} */ linkFirst: null,
  draw: { x1: 0, y1: 0, active: false }
};

canvas.addEventListener('contextmenu', e => e.preventDefault());

canvas.addEventListener('mousedown', e => {
  Snd.init();
  mouse.shift = e.shiftKey;
  mouse.x = e.clientX; mouse.y = e.clientY;
  const wc = screenToWorld(mouse.x, mouse.y);
  mouse.wx = wc.x; mouse.wy = wc.y;
  mouse.sx = mouse.x; mouse.sy = mouse.y;
  mouse.wsx = mouse.wx; mouse.wsy = mouse.wy;

  if (e.button === 1) { mouse.middle = true; return; }
  if (e.button === 2) { mouse.right = true; explode(mouse.wx, mouse.wy, 900, 240); return; }
  mouse.down = true;

  const TOOL = getTool();

  if (TOOL === 'grab' || TOOL === 'pin') {
    const b = ballAt(mouse.wx, mouse.wy);
    if (b) {
      if (TOOL === 'pin') {
        b.pinned = !b.pinned;
        b.vx = b.vy = b.omega = 0;
        Snd.click();
      } else {
        mouse.grab = b;
        b.grabbed = true;
      }
      return;
    }
  }

  if (TOOL === 'spawn') {
    // click on an existing ball = grab it (shorthand — no tool switch needed)
    const b = ballAt(mouse.wx, mouse.wy);
    if (b) { mouse.grab = b; b.grabbed = true; return; }
  }

  if (TOOL === 'link') {
    const b = ballAt(mouse.wx, mouse.wy);
    if (b) {
      if (mouse.linkFirst && mouse.linkFirst !== b) {
        const d = Math.hypot(mouse.linkFirst.x - b.x, mouse.linkFirst.y - b.y);
        W.springs.push(new Spring(mouse.linkFirst, b, d, 0.6, 0.1));
        Snd.spring();
        mouse.linkFirst = null;
      } else {
        mouse.linkFirst = b;
      }
    }
    return;
  }

  if (TOOL === 'erase') {
    const b = ballAt(mouse.wx, mouse.wy);
    if (b) {
      const i = balls.indexOf(b);
      if (i >= 0) balls.splice(i, 1);
      // also drop any linkers/tethers that referenced this ball
      W.springs = W.springs.filter(s => s.a !== b && s.b !== b);
      W.constraints = W.constraints.filter(c => c.a !== b);
      Snd.click();
      return;
    }
    const wi = wallAt(mouse.wx, mouse.wy);
    if (wi >= 0) { W.walls.splice(wi, 1); Snd.click(); return; }
    return;
  }

  if (TOOL === 'draw') {
    mouse.draw.active = true;
    mouse.draw.x1 = mouse.wx;
    mouse.draw.y1 = mouse.wy;
  }
});

canvas.addEventListener('mousemove', e => {
  mouse.x = e.clientX; mouse.y = e.clientY;
  const wc = screenToWorld(mouse.x, mouse.y);
  mouse.wx = wc.x; mouse.wy = wc.y;
  if (mouse.middle) {
    cam.tx += -e.movementX / cam.zoom;
    cam.ty += -e.movementY / cam.zoom;
  }
});

canvas.addEventListener('mouseup', e => {
  if (e.button === 1) { mouse.middle = false; return; }
  if (e.button === 2) { mouse.right  = false; return; }
  mouse.down = false;

  const TOOL = getTool();

  if (mouse.grab) {
    // flick impulse — distance travelled during the grab becomes velocity
    const dx = mouse.wx - mouse.grab.x;
    const dy = mouse.wy - mouse.grab.y;
    mouse.grab.vx += dx * 10;
    mouse.grab.vy += dy * 10;
    mouse.grab.grabbed = false;
    mouse.grab = null;
    return;
  }

  if (TOOL === 'draw' && mouse.draw.active) {
    const dx = mouse.wx - mouse.draw.x1;
    const dy = mouse.wy - mouse.draw.y1;
    if (dx * dx + dy * dy > 100) {
      W.walls.push({ x1: mouse.draw.x1, y1: mouse.draw.y1, x2: mouse.wx, y2: mouse.wy });
      Snd.click();
    }
    mouse.draw.active = false;
    return;
  }

  if (TOOL === 'spawn') {
    const dx = mouse.wsx - mouse.wx;
    const dy = mouse.wsy - mouse.wy;
    const d = len(dx, dy);
    if (d < 5) {
      if (mouse.shift) {
        for (let i = 0; i < 10; i++) spawnBall(mouse.wx + rand(-20, 20), mouse.wy + rand(-20, 20));
      } else {
        spawnBall(mouse.wsx, mouse.wsy);
      }
    } else {
      const b = spawnBall(mouse.wsx, mouse.wsy);
      if (b) { b.vx = dx * 6; b.vy = dy * 6; }
    }
  }
});

canvas.addEventListener('wheel', e => {
  e.preventDefault();
  const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
  const oldZoom = cam.tz;
  const newZoom = clamp(cam.tz * factor, 0.3, 5);
  // zoom at cursor — keep the world point under the cursor fixed
  const wb = screenToWorld(e.clientX, e.clientY);
  cam.tz = newZoom;
  cam.tx += (wb.x - cam.tx) * (1 - oldZoom / newZoom);
  cam.ty += (wb.y - cam.ty) * (1 - oldZoom / newZoom);
}, { passive: false });
