/**
 * Theme switching — swaps the `data-theme` attribute on <html> which triggers
 * alternate `:root` variable blocks in `styles/main.css`.
 *
 * Available themes: amber (default), cyan, violet, forest. Selection is
 * persisted; canvas-facing modules read the current accent via
 * `getComputedStyle(...).getPropertyValue('--accent')` if they need to match.
 */

import { savePref } from './persistence.js';

export const THEMES = ['amber', 'cyan', 'violet', 'forest'];

export function applyTheme(name) {
  if (!THEMES.includes(name)) name = 'amber';
  document.documentElement.setAttribute('data-theme', name);
  document.querySelectorAll('.theme-dot').forEach(el => {
    el.classList.toggle('active', el.getAttribute('data-theme') === name);
  });
  savePref('theme', name);
}
