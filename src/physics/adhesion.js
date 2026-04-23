/**
 * Slime / adhesive bonding.
 *
 * When a slime ball contacts another ball at moderate speed, a soft spring
 * is pushed into `W.springs` (the same pool cloth / link / jelly uses).
 * The spring is tagged `slime` so `breakSlimeBonds` can rip it out when
 * stretched past its limit — emergent web structures that tear under load.
 *
 * Each slime ball tracks `b.slimeBonds` so we don't fountain a hundred
 * springs out of a single ball stuck in a pile. First bond costs nothing;
 * past the cap we skip.
 */

import { W } from '../core/world.js';
import { Spring } from '../entities/spring.js';

/** How many bonds one slime ball can maintain at once. */
const MAX_BONDS_PER_BALL = 4;
/** Impact speed above which the bond fails to form (ripped free on impact). */
const BOND_IMPACT_LIMIT = 420;
/** Spring stiffness for slime bonds — soft enough to wobble, firm enough to hold. */
const STIFFNESS = 0.28;
/** Spring damping. */
const DAMP = 0.18;
/** Extra rest-length slack so slime bonds hang a little loose. */
const SLACK = 4;
/** If a bond stretches past `rest * MAX_STRETCH` the bond snaps. */
const MAX_STRETCH = 2.4;

/**
 * @param {import('../entities/ball.js').Ball} a
 * @param {import('../entities/ball.js').Ball} b
 * @param {number} impactV   — normal-component speed at contact
 */
export function tryAdhere(a, b, impactV) {
  if (impactV > BOND_IMPACT_LIMIT) return;
  if (a.pinned && b.pinned) return;
  if (a._dead || b._dead) return;

  const aSlime = !!a.mat.adhesive;
  const bSlime = !!b.mat.adhesive;
  if (!aSlime && !bSlime) return;

  // Bond cap — count only against slime endpoints so non-slime partners
  // can host as many bonds as slime balls have quota for.
  if (aSlime && a.slimeBonds >= MAX_BONDS_PER_BALL) return;
  if (bSlime && b.slimeBonds >= MAX_BONDS_PER_BALL) return;

  // Don't duplicate an existing bond between the same pair.
  for (const s of W.springs) {
    if (s.tag !== 'slime') continue;
    if ((s.a === a && s.b === b) || (s.a === b && s.b === a)) return;
  }

  const rest = a.r + b.r + SLACK;
  const s = new Spring(a, b, rest, STIFFNESS, DAMP);
  s.tag = 'slime';
  s.maxLen = rest * MAX_STRETCH;
  W.springs.push(s);

  if (aSlime) a.slimeBonds++;
  if (bSlime) b.slimeBonds++;
}

/** Break any slime bond that got stretched past its limit, or whose
 *  endpoints are gone. Called once per step from `physics/step.js`. */
export function breakSlimeBonds() {
  for (let i = W.springs.length - 1; i >= 0; i--) {
    const s = W.springs[i];
    if (s.tag !== 'slime') continue;
    const a = s.a, b = s.b;
    if (!a || !b || a._dead || b._dead) {
      if (a && a.mat.adhesive) a.slimeBonds = Math.max(0, a.slimeBonds - 1);
      if (b && b.mat.adhesive) b.slimeBonds = Math.max(0, b.slimeBonds - 1);
      W.springs.splice(i, 1);
      continue;
    }
    const dx = b.x - a.x, dy = b.y - a.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d > (s.maxLen || s.rest * 2.4)) {
      if (a.mat.adhesive) a.slimeBonds = Math.max(0, a.slimeBonds - 1);
      if (b.mat.adhesive) b.slimeBonds = Math.max(0, b.slimeBonds - 1);
      W.springs.splice(i, 1);
    }
  }
}
