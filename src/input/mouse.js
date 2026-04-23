/**
 * Mouse state + all canvas mouse/wheel handlers.
 *
 * Side-effects mutate the undo stack when the user creates new state
 * (spawned balls, drawn walls, linked springs) — Ctrl-Z in keyboard.js
 * pops and reverses.
 */

import { clamp, len, rand } from '../core/math.js';
import { W, cam, screenToWorld } from '../core/world.js';
import { canvas } from '../render/canvas.js';
import { balls, spawnBall } from '../entities/ball.js';
import { Spring } from '../entities/spring.js';
import { Snd } from '../audio/sound.js';
import { explode } from '../physics/explode.js';
import { getTool, ballAt, wallAt } from './tools.js';
import { pushUndo } from '../core/undo.js';

export const mouse = {
  x: 0, y: 0, wx: 0, wy: 0,
  down: false, right: false, middle: false, shift: false,
  sx: 0, sy: 0, wsx: 0, wsy: 0,
  /** @type {import('../entities/ball.js').Ball | null} */ grab: null,
  /** @type {import('../entities/ball.js').Ball | null} */ linkFirst: null,
  draw: { x1: 0, y1: 0, active: false },
  /** Springs created within a single drag-chain gesture — batched into a
   *  single undo entry on mouseup so Ctrl-Z removes the whole chain. */
  /** @type {any[]} */ chainSprings: []
};

/** Build a spring between two balls with reinforcement-aware attachment
 *  offsets. Pushes the spring to W.springs, plays the click, returns it. */
function createLink(a, b) {
  const d = Math.hypot(a.x - b.x, a.y - b.y);
  let existing = 0;
  for (const sp of W.springs) {
    if ((sp.a === a && sp.b === b) || (sp.a === b && sp.b === a)) existing++;
  }
  const baseA = Math.atan2(b.y - a.y, b.x - a.x) - a.angle;
  const baseB = Math.atan2(a.y - b.y, a.x - b.x) - b.angle;
  const k = (existing + 1) >> 1;
  const fan = (existing === 0) ? 0
            : (existing % 2 === 1 ? k : -k) * 0.22;
  const s = new Spring(a, b, d, 0.6, 0.1, baseA + fan, baseB - fan);
  W.springs.push(s);
  Snd.spring();
  return s;
}

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
        const was = b.pinned;
        b.pinned = !b.pinned;
        b.vx = b.vy = b.omega = 0;
        Snd.click();
        pushUndo(() => { b.pinned = was; });
      } else {
        mouse.grab = b;
        b.grabbed = true;
      }
      return;
    }
  }

  if (TOOL === 'spawn') {
    const b = ballAt(mouse.wx, mouse.wy);
    if (b) { mouse.grab = b; b.grabbed = true; return; }
  }

  if (TOOL === 'link') {
    const b = ballAt(mouse.wx, mouse.wy);
    if (!b) {
      // Click on empty space cancels an in-progress source selection.
      if (mouse.linkFirst) mouse.linkFirst = null;
      return;
    }
    if (mouse.linkFirst === b) {
      // Clicking the source itself cancels the selection.
      mouse.linkFirst = null;
      return;
    }
    if (mouse.linkFirst) {
      // Explicit click-to-link: push its own undo entry immediately.
      const s = createLink(mouse.linkFirst, b);
      pushUndo(() => {
        const i = W.springs.indexOf(s);
        if (i >= 0) W.springs.splice(i, 1);
      });
      // Shift held → keep source for rapid reinforcement / spoke-linking.
      if (!mouse.shift) mouse.linkFirst = null;
      return;
    }
    mouse.linkFirst = b;
    return;
  }

  if (TOOL === 'erase') {
    const b = ballAt(mouse.wx, mouse.wy);
    if (b) {
      const i = balls.indexOf(b);
      if (i >= 0) balls.splice(i, 1);
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

// mousemove + mouseup listen on `window`, not `canvas`. If a user drags a
// ball outside the canvas (onto a panel) and releases, the canvas-only
// handler would never fire mouseup — leaving `mouse.down`, `mouse.grab`,
// and tool-hold forces stuck on forever until a new click. Listening on
// window catches releases anywhere on the page.
addEventListener('mousemove', e => {
  mouse.x = e.clientX; mouse.y = e.clientY;
  const wc = screenToWorld(mouse.x, mouse.y);
  mouse.wx = wc.x; mouse.wy = wc.y;
  if (mouse.middle) {
    cam.tx += -e.movementX / cam.zoom;
    cam.ty += -e.movementY / cam.zoom;
  }

  // Drag-chain linking: while holding the mouse in Link tool with a
  // source ball selected, entering any new ball auto-links it and
  // advances the source. Lets the user chain-link dozens of balls in
  // one continuous stroke — press on A, drag through B-C-D-E, release.
  if (mouse.down && mouse.linkFirst && getTool() === 'link') {
    const hit = ballAt(mouse.wx, mouse.wy);
    if (hit && hit !== mouse.linkFirst) {
      const s = createLink(mouse.linkFirst, hit);
      mouse.chainSprings.push(s);
      mouse.linkFirst = hit;
    }
  }
});

addEventListener('mouseup', e => {
  if (e.button === 1) { mouse.middle = false; return; }
  if (e.button === 2) { mouse.right  = false; return; }
  // Only run release logic if a canvas mousedown started this gesture.
  // Since this listener is on `window` (so drag-off-canvas still releases
  // properly), it also fires on button / panel clicks — and we don't want
  // clicking the Link button to trigger a spawn-release that shoots a ball.
  if (!mouse.down) return;
  mouse.down = false;

  const TOOL = getTool();

  if (mouse.grab) {
    const dx = mouse.wx - mouse.grab.x;
    const dy = mouse.wy - mouse.grab.y;
    mouse.grab.vx += dx * 10;
    mouse.grab.vy += dy * 10;
    mouse.grab.grabbed = false;
    mouse.grab = null;
    return;
  }

  // If the user just completed a drag-chain of links, collapse every
  // strand they drew into a single undo entry so one Ctrl-Z removes
  // the whole chain (rather than requiring N presses for N links).
  if (TOOL === 'link' && mouse.chainSprings.length) {
    const chain = mouse.chainSprings.slice();
    mouse.chainSprings.length = 0;
    pushUndo(() => {
      for (const sp of chain) {
        const i = W.springs.indexOf(sp);
        if (i >= 0) W.springs.splice(i, 1);
      }
    });
    return;
  }

  if (TOOL === 'draw' && mouse.draw.active) {
    const dx = mouse.wx - mouse.draw.x1;
    const dy = mouse.wy - mouse.draw.y1;
    if (dx * dx + dy * dy > 100) {
      const wall = { x1: mouse.draw.x1, y1: mouse.draw.y1, x2: mouse.wx, y2: mouse.wy };
      W.walls.push(wall);
      Snd.click();
      pushUndo(() => {
        const i = W.walls.indexOf(wall);
        if (i >= 0) W.walls.splice(i, 1);
      });
    }
    mouse.draw.active = false;
    return;
  }

  if (TOOL === 'spawn') {
    const dx = mouse.wsx - mouse.wx;
    const dy = mouse.wsy - mouse.wy;
    const d = len(dx, dy);
    /** Track every ball spawned in this release so Ctrl-Z undoes them as a batch. */
    const spawned = [];
    if (d < 5) {
      if (mouse.shift) {
        for (let i = 0; i < 10; i++) {
          const b = spawnBall(mouse.wx + rand(-20, 20), mouse.wy + rand(-20, 20));
          if (b) spawned.push(b);
        }
      } else {
        const b = spawnBall(mouse.wsx, mouse.wsy);
        if (b) spawned.push(b);
      }
    } else {
      const b = spawnBall(mouse.wsx, mouse.wsy);
      if (b) { b.vx = dx * 6; b.vy = dy * 6; spawned.push(b); }
    }
    if (spawned.length) {
      pushUndo(() => {
        for (const b of spawned) {
          const i = balls.indexOf(b);
          if (i >= 0) balls.splice(i, 1);
        }
      });
    }
  }
});

canvas.addEventListener('wheel', e => {
  e.preventDefault();
  const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
  const oldZoom = cam.tz;
  const newZoom = clamp(cam.tz * factor, 0.3, 5);
  const wb = screenToWorld(e.clientX, e.clientY);
  cam.tz = newZoom;
  cam.tx += (wb.x - cam.tx) * (1 - oldZoom / newZoom);
  cam.ty += (wb.y - cam.ty) * (1 - oldZoom / newZoom);
}, { passive: false });
