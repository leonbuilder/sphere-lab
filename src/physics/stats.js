/**
 * Shared mutable counters for the physics subsystem.
 * A single object is exported so all consumers see each other's writes —
 * primitives can't be rebound across modules.
 *
 * Mutation points:
 *   collisions.js — increments `collisions` on each resolved contact
 *   broadphase.js — sets `pairs` each step to the candidate-pair count
 *   loop.js       — drains `collisions` into `window` + renders to HUD
 */

export const stats = {
  collisions: 0,
  pairs: 0
};

/** @type {{t:number, c:number}[]} — rolling 1-second window of collision bursts. */
export const collisionWindow = [];
