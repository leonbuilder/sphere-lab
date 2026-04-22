/**
 * Wire up the right-sidebar numeric sliders → `PHYS` config.
 * Each slider has a matching `.value` span that re-renders its formatted value.
 */

import { PHYS } from '../core/config.js';

export function bindSliders() {
  const bind = (id, vId, setVal, fmt) => {
    const s = /** @type {HTMLInputElement} */ (document.getElementById(id));
    const v = document.getElementById(vId);
    s.addEventListener('input', () => {
      const raw = parseFloat(s.value);
      setVal(raw);
      v.textContent = fmt(raw);
    });
  };

  bind('s-g', 'v-g', v => PHYS.gravity        = v,       v => String(Math.round(v)));
  bind('s-d', 'v-d', v => PHYS.drag           = v / 100, v => (v / 100).toFixed(2));
  bind('s-e', 'v-e', v => PHYS.restitutionMul = v / 100, v => (v / 100).toFixed(2));
  bind('s-f', 'v-f', v => PHYS.frictionMul    = v / 100, v => (v / 100).toFixed(2));
  bind('s-m', 'v-m', v => PHYS.magnus         = v / 100, v => (v / 100).toFixed(2));
  bind('s-r', 'v-r', v => PHYS.spawnRadius    = v,       v => String(Math.round(v)));
  bind('s-w', 'v-w', v => PHYS.wind           = v,       v => String(Math.round(v)));
}
