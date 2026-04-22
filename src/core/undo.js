/**
 * Simple undo stack — last-in-first-out. Each entry is a plain function that
 * reverses its creator's effect. Callers push before mutating; `undo()` pops
 * and invokes the top action.
 *
 * Only tracks user-created state (spawned balls, drawn walls, linked
 * springs). Not scene builders — loadScene is its own reset.
 */

/** @type {Array<() => void>} */
const stack = [];
const LIMIT = 64;

export function pushUndo(action) {
  stack.push(action);
  if (stack.length > LIMIT) stack.shift();
}

export function undo() {
  const action = stack.pop();
  if (action) action();
}

export function clearUndo() { stack.length = 0; }
