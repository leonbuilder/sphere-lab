/**
 * HUD FPS sparkline. Drawn into the small #fps-canvas in the right sidebar.
 * Called by `loop.js` whenever it samples a new FPS value (every 0.3s).
 */

const fpsCanvas = /** @type {HTMLCanvasElement} */ (document.getElementById('fps-canvas'));
const fpsCtx = fpsCanvas.getContext('2d');

/** @param {number[]} fpsHistory — most recent samples, last = current */
export function renderFpsGraph(fpsHistory) {
  const w = fpsCanvas.width, h = fpsCanvas.height;
  fpsCtx.clearRect(0, 0, w, h);

  fpsCtx.strokeStyle = '#ffb340';
  fpsCtx.lineWidth = 1.2;
  fpsCtx.beginPath();
  for (let i = 0; i < fpsHistory.length; i++) {
    const x = (i / fpsHistory.length) * w;
    const y = h - (Math.min(60, fpsHistory[i]) / 60) * h;
    if (i === 0) fpsCtx.moveTo(x, y); else fpsCtx.lineTo(x, y);
  }
  fpsCtx.stroke();

  // 60 fps reference line
  fpsCtx.strokeStyle = 'rgba(255,255,255,0.15)';
  fpsCtx.setLineDash([2, 2]);
  fpsCtx.beginPath(); fpsCtx.moveTo(0, 0); fpsCtx.lineTo(w, 0); fpsCtx.stroke();
  fpsCtx.setLineDash([]);
}
