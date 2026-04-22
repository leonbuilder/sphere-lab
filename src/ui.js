'use strict';

/* HUD bootstrap — the pieces that attach DOM ↔ PHYS/state.
   Called once from main.js#init. */

function updatePauseBtn() {
  const b = document.getElementById('btn-pause');
  b.textContent = PHYS.paused ? 'RESUME [SPACE]' : 'PAUSE [SPACE]';
  b.classList.toggle('active', PHYS.paused);
}

function updateToggle(id, on) {
  const b = document.getElementById(id);
  if (b) b.classList.toggle('active', on);
}

function updateMatButtons() {
  document.querySelectorAll('#ball-types .btn').forEach(b => b.classList.toggle('active', b.dataset.mat === selectedMat));
}

function buildMatButtons() {
  const wrap = document.getElementById('ball-types');
  MAT_KEYS.forEach((k, i) => {
    const m = MATERIALS[k];
    const b = document.createElement('button');
    b.className = 'btn ball';
    b.dataset.mat = k;
    b.innerHTML =
      `<span class="swatch" style="background:${m.color};box-shadow:0 0 6px ${m.color}"></span>` +
      `${m.name}` +
      `<span style="margin-left:auto;color:var(--dim);font-size:0.65rem">${i + 1}</span>`;
    b.onclick = () => { selectedMat = k; updateMatButtons(); };
    wrap.appendChild(b);
  });
  updateMatButtons();
}

function bindSliders() {
  const bind = (id, vId, setVal, fmt) => {
    const s = document.getElementById(id);
    const v = document.getElementById(vId);
    s.addEventListener('input', () => {
      const raw = parseFloat(s.value);
      setVal(raw);
      v.textContent = fmt(raw);
    });
  };
  bind('s-g', 'v-g', v => PHYS.gravity        = v,        v => Math.round(v));
  bind('s-d', 'v-d', v => PHYS.drag           = v / 100,  v => (v / 100).toFixed(2));
  bind('s-e', 'v-e', v => PHYS.restitutionMul = v / 100,  v => (v / 100).toFixed(2));
  bind('s-f', 'v-f', v => PHYS.frictionMul    = v / 100,  v => (v / 100).toFixed(2));
  bind('s-m', 'v-m', v => PHYS.magnus         = v / 100,  v => (v / 100).toFixed(2));
  bind('s-r', 'v-r', v => PHYS.spawnRadius    = v,        v => Math.round(v));
  bind('s-w', 'v-w', v => PHYS.wind           = v,        v => Math.round(v));
}

function bindButtons() {
  document.querySelectorAll('#top .btn').forEach(b => { b.onclick = () => loadScene(b.dataset.scene); });
  document.querySelectorAll('#tool-row .btn').forEach(b => { b.onclick = () => setTool(b.dataset.tool); });
  document.getElementById('btn-clear').onclick = () => {
    balls.length = 0; particles.length = 0; W.springs.length = 0;
  };
  document.getElementById('btn-pause').onclick = () => { PHYS.paused = !PHYS.paused; updatePauseBtn(); };
  document.getElementById('btn-slowmo').onclick = () => {
    PHYS.slowmo = PHYS.slowmo === 1 ? 0.15 : 1;
    const b = document.getElementById('btn-slowmo');
    b.textContent = PHYS.slowmo === 1 ? 'SLOW-MO [F]' : 'NORMAL [F]';
    b.classList.toggle('active', PHYS.slowmo !== 1);
  };
  document.getElementById('btn-gravity').onclick = () => { PHYS.gravityOn = !PHYS.gravityOn; setGravityUI(PHYS.gravityOn); };
  document.getElementById('btn-reset-cam').onclick = () => { cam.tx = W.cw / 2; cam.ty = W.ch / 2; cam.tz = 1; };

  const toggles = [
    ['t-bloom',      'bloom'],
    ['t-shadow',     'shadow'],
    ['t-blur',       'motionBlur'],
    ['t-trail',      'trails'],
    ['t-vec',        'showVec'],
    ['t-sound',      'sound'],
    ['t-refract',    'refract'],
    ['t-heat',       'heatFx'],
    ['t-ao',         'ao'],
    ['t-aberration', 'aberration'],
    ['t-grain',      'grain'],
    ['t-streaks',    'streaks'],
    ['t-flare',      'flare']
  ];
  for (const [id, k] of toggles) {
    const b = document.getElementById(id);
    b.onclick = () => { PHYS[k] = !PHYS[k]; updateToggle(id, PHYS[k]); };
  }

  document.getElementById('help-btn').onclick = () => document.getElementById('help').classList.add('show');
  document.getElementById('help').addEventListener('click', e => {
    if (e.target.id === 'help') e.currentTarget.classList.remove('show');
  });
}
