# SPHERE LAB — project map for AI agents

This is an HTML5 canvas 2D physics sandbox. 14 interactive scenes, 8 materials,
realistic impulse-based ball dynamics. **Run with a static server** (see
`serve.sh`) because ES modules can't load over `file://`.

## Quick task → file map

| "I want to change…"                | Edit                                      |
| ---------------------------------- | ----------------------------------------- |
| A material's density / bounciness  | `src/entities/materials.js`               |
| A scene's layout                   | `src/scenes/<name>.js`                    |
| Add a new scene                    | new file in `src/scenes/` + register in `src/scenes/index.js` + new `<button class="tab">` in `index.html` |
| Collision response math            | `src/physics/collisions.js`               |
| Pinball flippers (angle + kick)    | `src/physics/flippers.js`                 |
| Magnetism between balls            | `src/physics/forces.js::applyMagnetism`   |
| Water ripples (spawn + decay)      | `src/physics/forces.js` + `src/render/world.js::drawWater` |
| Conveyor-belt walls                | `src/physics/collisions.js::collideWall` (`wall.conveyorV`) |
| Solver loop / field forces         | `src/physics/step.js` + `src/physics/forces.js` |
| Attract / Push tool forces         | `src/physics/step.js` (in-loop per-ball) |
| Broadphase (pair generation)       | `src/physics/broadphase.js`               |
| How a ball is drawn                | `src/render/ball.js`                      |
| Backgrounds / vortex / water / sun | `src/render/background.js`, `src/render/world.js` |
| Bloom, grain, chromatic aberration | `src/render/postfx.js`                    |
| Impact rings (expanding FX)        | `src/entities/particles.js::spawnImpact` + `src/render/effects.js` |
| Telemetry mini-graphs              | `src/render/statsGraph.js` (generic sparkline) |
| Mouse-tool behaviour               | `src/input/mouse.js` + `src/input/tools.js` |
| Keyboard shortcuts                 | `src/input/keyboard.js` (arrows → flippers, Ctrl-Z → undo) |
| Undo stack                         | `src/core/undo.js`                        |
| Ball inspector panel               | `src/ui/inspector.js`                     |
| Scene title fade overlay           | `src/ui/sceneTitle.js` (taglines live here) |
| Save / Load / Screenshot           | `src/ui/save.js`                          |
| Theme swaps (amber/cyan/violet/…)  | `src/core/theme.js` + `[data-theme]` CSS blocks |
| Pref persistence (toggles, volume) | `src/core/persistence.js`                 |
| HUD buttons / sliders              | `src/ui/*`                                |
| Design tokens (color/spacing/font) | `styles/main.css` `:root` block           |
| Ball stats (mass, heat, trail)     | `src/entities/ball.js`                    |
| Audio synthesis                    | `src/audio/sound.js`                      |
| Global physics knobs (gravity etc) | `src/core/config.js` (the `PHYS` object)  |
| Camera behaviour                   | `src/core/world.js` (the `cam` object)    |
| Tick rate / main loop order        | `src/loop.js`                             |

## Architecture (top-down)

```
index.html
  └── src/main.js                   bootstraps UI, input, loads default scene
        └── src/loop.js             requestAnimationFrame driver
              ├── src/physics/step.js
              │     ├── physics/forces.js           gravity, vortex, buoyancy
              │     ├── physics/broadphase.js       grid → candidate pairs
              │     ├── physics/collisions.js       impulse resolution
              │     └── physics/materialMods.js     heat / velocity effects
              └── src/render/*
                    ├── canvas.js                   setup + resize + offscreen buffers
                    ├── background.js               gradient, stars, grid, vignette
                    ├── world.js                    walls, pegs, water, vortex, sun
                    ├── ball.js                     per-ball shading + refraction
                    ├── effects.js                  AO, particles, lens flare
                    ├── postfx.js                   bloom, chromatic aberration, grain
                    └── fpsGraph.js                 HUD sparkline
```

## Core concepts

- **`PHYS`** (`core/config.js`) holds mutable sim parameters. Every frame reads
  from it. UI sliders and toggles mutate it live.
- **`W`** (`core/world.js`) is the current scene's geometry + state. Reset on
  every `loadScene(name)`.
- **`cam`** (`core/world.js`) has `{x, y, zoom}` (current) and `{tx, ty, tz}`
  (target). `loop.js` smooths current toward target each frame.
- **`balls`** (`entities/ball.js`) is the global ball pool. Scenes push into
  it; `physicsStep` iterates it; the solver culls escaped entries.
- **`particles`** (`entities/particles.js`) is the transient FX pool, mutated
  by collision code + the step loop cleans it.
- **Fixed timestep:** physics ticks at 240 Hz via an accumulator in
  `loop.js`. Rendering runs at display rate.
- **Modules are singletons.** We don't do DI — a module's top-level state IS
  the shared state. Import, use.

## Physics model (crib notes)

- Impulse-based collisions with separate normal + tangential passes.
- `I = ½ m r²` (solid disk) feeds rotational response to friction.
- **Restitution combines as `min(eA, eB)`** — the softer material dominates,
  matches experiment better than an arithmetic average.
- **Velocity-dependent restitution** (`materialMods.js::velRestScale`) makes
  hard impacts lose more energy than gentle ones.
- **Temperature effects** (`materialMods.js::heatRestMod / heatFricMod`) —
  hot rubber mushes, ice melts, steel goes plastic, plasma gets bouncier.
- **Friction combination** uses geometric mean (`√(μa·μb)`).
- **Rolling enhancement** — wall friction is 1.6× when |vₙ| < 80 to damp
  jitter so balls settle instead of buzzing.
- **CCD:** each ball's motion is substepped so |Δx per step| < 0.6·r.
- **Magnus** uses a velocity snapshot and scales by cross-sectional area
  `A = π r²` — big balls curve more (correct Magnus scaling in 2D).
- **Drag** is `k_lin + k_quad·|v|`, scaled by `A/A_ref` — big balls feel
  heavier air resistance.
- **Broadphase:** uniform spatial hash with cell = max(40, 2.2·maxR).
  Emits pairs from a cell plus 4 forward-directional neighbors (no dupes).
- **Buoyancy:** Archimedes — `F = ρ_fluid · V_sub · g`, with `ρ_fluid = 1.0`.
- **Sleeping:** balls with `|v| < 6` and `|ω| < 0.8` for `0.5 s` go to sleep
  (skip force integration + CCD). Woken by contact (collisions.js), tool
  interaction, spring force, magnetism, or gravity toggle.

## Render pipeline (per frame, in order)

1. `canvas.clear + drawBackground` (or motion-blur translucent fill).
2. Apply camera transform.
3. `drawSolarCenter → drawWalls → drawPegs → drawFlippers → drawConstraints
    → drawSprings → drawVortex → drawBallShadows`.
4. If any refractive ball is onscreen: snapshot the current paint into
   `sceneCanvas` — used as the glass lens texture.
5. `drawTrail → drawAO → drawBall (per ball) → drawWater → drawParticles
    → drawLensFlares`.
6. Tool previews (slingshot, wall draft, link ghost, push / attract radius).
7. Pop camera transform.
8. `doBloomPass` — **two-pass** (bright threshold → H blur → V blur →
   additive composite).
9. `doPostFX` (chromatic aberration + film grain).
10. HUD text + inspector + scene title update.

### Ball shader
- Chromatic refraction (R/G/B sampled at slightly different scales) for glass.
- Radial body gradient, branched by `material.metallic`.
- Fresnel-style concentric rim highlight (edge brighter, metals stronger).
- Faux metallic env — horizontal sky/horizon/ground bands for `metallic > 0.5`.
- Primary + secondary specular highlights driven by light direction.
- Rotation markers (twin dots) so spin is visible.
- Sleeping balls show a small `z` when `PHYS.showVec` is on.

### Shadows
- Three-layer blurred ground shadow (umbra / mid / penumbra) via canvas
  `filter: blur(3px)` — reads as real penumbra instead of a sharp ellipse.

## Conventions

- **ES modules only.** Imports spell out the dependency graph — no globals.
- **One concept per file.** Files stay under ~300 lines so they fit in a
  single AI read.
- **JSDoc types** on public exports — especially `Ball`, `Material`, `Wall`,
  `Peg`, `Spring`, `Particle`.
- **`'use strict'` is implicit** in modules. Don't add it.
- **No comments for "what"** — the code says that. Comments are for "why".
- **Mutate, don't rebuild.** Ball/particle pools use `length = 0` to clear,
  not reassignment, so other modules' references stay valid.

## Gotchas

- **`file://` won't work.** Browsers block ES modules over the file protocol.
  Run `./serve.sh` (or `python3 -m http.server 8000`) and open
  `http://localhost:8000/`.
- **DOM globals are only safe after `DOMContentLoaded`.** Modules declared
  with `type="module"` are deferred, so this is automatically handled for
  top-level DOM queries in `render/canvas.js` etc.
- **Order of imports matters visually, not semantically.** ES modules hoist
  all top-level bindings; circular imports resolve lazily. Avoid circles —
  if you hit one, extract the shared piece into `src/core/`.
- **`setGravityUI` writes DOM.** Scenes call it, so they must be loaded
  after the DOM is ready (they will be — see above).
- **Ball cap is 260.** Enforced in `spawnBall` to keep the solver tractable.
- **Action buttons have a label span + a kbd span.** Swap the label by writing
  to `span:not(.kbd)`, not `textContent` (see `ui/hud.js::setActionLabel`).
- **Mode pill's text is inside `#mode-text`,** not `#mode-indicator` — the
  outer element also contains the pulsing dot.
- **Tools are selected via `getTool()` each step** — do not cache the value
  across frames. Changing tools mid-hold safely ends the previous hold.
- **Prefs persist automatically** for toggles, theme, volume, and selected
  material. Sim state (balls, walls) is saved only on explicit Save click.
- **Impact rings are `type: 'ring'` particles** — rendered differently and
  skipped by the step integrator's position update.
- **Conveyor direction:** `wall.conveyorV > 0` drags toward (x2, y2).
