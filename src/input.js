'use strict';

/* Mouse, wheel, and keyboard wiring + the active-tool state machine.
   Relies on canvas from render.js already existing. */

const mouse = {
  x: 0, y: 0, wx: 0, wy: 0,
  down: false, right: false, middle: false, shift: false,
  sx: 0, sy: 0, wsx: 0, wsy: 0,
  grab: null, linkFirst: null,
  draw: { x1: 0, y1: 0, active: false }
};

let TOOL = 'spawn';
function setTool(t) {
  TOOL = t;
  document.querySelectorAll('#tool-row .btn').forEach(b => b.classList.toggle('active', b.dataset.tool === t));
  document.getElementById('stat-tool').textContent = t.toUpperCase();
  document.getElementById('mode-indicator').textContent = t.toUpperCase() + ' MODE';
  canvas.style.cursor =
    t === 'grab'  ? 'grab'      :
    t === 'draw'  ? 'crosshair' :
    t === 'erase' ? 'not-allowed'
                  : 'crosshair';
}

function ballAt(x, y) {
  for (let i = balls.length - 1; i >= 0; i--) {
    const b = balls[i];
    if ((b.x - x) ** 2 + (b.y - y) ** 2 < b.r * b.r) return b;
  }
  return null;
}

function wallAt(x, y, tol = 8) {
  for (let i = 0; i < W.walls.length; i++) {
    const w = W.walls[i];
    const wx = w.x2 - w.x1, wy = w.y2 - w.y1;
    const l2 = wx * wx + wy * wy;
    let t = ((x - w.x1) * wx + (y - w.y1) * wy) / l2;
    t = clamp(t, 0, 1);
    const cx = w.x1 + wx * t, cy = w.y1 + wy * t;
    if ((x - cx) ** 2 + (y - cy) ** 2 < tol * tol) return i;
  }
  return -1;
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
    const b = ballAt(mouse.wx, mouse.wy);
    if (b) { mouse.grab = b; b.grabbed = true; return; }
  }

  if (TOOL === 'link') {
    const b = ballAt(mouse.wx, mouse.wy);
    if (b) {
      if (mouse.linkFirst && mouse.linkFirst !== b && !mouse.linkFirst.dead) {
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
    return;
  }
});

canvas.addEventListener('mousemove', e => {
  mouse.x = e.clientX; mouse.y = e.clientY;
  const wc = screenToWorld(mouse.x, mouse.y);
  mouse.wx = wc.x; mouse.wy = wc.y;
  if (mouse.middle) {
    const dx = -e.movementX / cam.zoom;
    const dy = -e.movementY / cam.zoom;
    cam.tx += dx; cam.ty += dy;
  }
});

canvas.addEventListener('mouseup', e => {
  if (e.button === 1) { mouse.middle = false; return; }
  if (e.button === 2) { mouse.right  = false; return; }
  mouse.down = false;

  if (mouse.grab) {
    // Flick impulse — translate mouse travel to velocity.
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
  const wb = screenToWorld(e.clientX, e.clientY);
  cam.tz = newZoom;
  cam.tx += (wb.x - cam.tx) * (1 - oldZoom / newZoom);
  cam.ty += (wb.y - cam.ty) * (1 - oldZoom / newZoom);
}, { passive: false });

addEventListener('keydown', e => {
  const key = e.key.toLowerCase();
  if (e.target.tagName === 'INPUT') return;

  if (key === ' ')              { PHYS.paused = !PHYS.paused; updatePauseBtn(); e.preventDefault(); }
  else if (key === 'f') {
    PHYS.slowmo = PHYS.slowmo === 1 ? 0.15 : 1;
    const bt = document.getElementById('btn-slowmo');
    bt.textContent = PHYS.slowmo === 1 ? 'SLOW-MO [F]' : 'NORMAL [F]';
    bt.classList.toggle('active', PHYS.slowmo !== 1);
  }
  else if (key === 'g')         { PHYS.gravityOn = !PHYS.gravityOn; setGravityUI(PHYS.gravityOn); }
  else if (key === 'c')         { balls.length = 0; particles.length = 0; W.springs.length = 0; }
  else if (key === 'r' && e.ctrlKey) { loadScene(W.scene); }
  else if (key === 'm')         { PHYS.motionBlur = !PHYS.motionBlur; }
  else if (key === 'b')         { PHYS.bloom     = !PHYS.bloom;     updateToggle('t-bloom', PHYS.bloom); }
  else if (key === 'v')         { PHYS.showVec   = !PHYS.showVec;   updateToggle('t-vec',   PHYS.showVec); }
  else if (key === 's')         { PHYS.sound     = !PHYS.sound;     updateToggle('t-sound', PHYS.sound); }
  else if (key === 'h')         { PHYS.heatFx    = !PHYS.heatFx;    updateToggle('t-heat',  PHYS.heatFx); }
  else if (key === '0')         { cam.tx = W.cw / 2; cam.ty = W.ch / 2; cam.tz = 1; }
  else if (TOOL_KEYS[key])      { setTool(TOOL_KEYS[key]); }
  else if (key >= '1' && key <= '9') {
    const idx = parseInt(key) - 1;
    if (idx < MAT_KEYS.length) { selectedMat = MAT_KEYS[idx]; updateMatButtons(); }
  }
});
