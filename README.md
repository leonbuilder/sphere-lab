# Sphere Lab

**Live demo: [spherelab.clickdeeper.com](https://spherelab.clickdeeper.com/)**

A browser-based 2D physics sandbox where ten materials — steel, rubber, glass,
bowling, neon, gold, plasma, ice, magnet, mercury — interact across eighteen
scenes. Built on HTML5 canvas with zero dependencies, modal impact-sound
synthesis, and per-material surface detail (brushed metal, crystalline ice,
iron-filing magnets, dented gold).

## Running it

Fastest way: open the [live demo](https://spherelab.clickdeeper.com/).

To run locally, any static file server works — ES modules won't load over
`file://`:

```bash
git clone <this-repo>
cd sphere-lab
./serve.sh       # or:  python3 -m http.server 8000
```

Open `http://localhost:8000/`.

## What's in it

### Physics

- Impulse-based ball/ball, ball/wall, ball/peg, and pinball-flipper collisions,
  with continuous collision detection (substep count derived from velocity).
- Fixed-timestep solver at 240 Hz via an accumulator in the main loop.
- Per-material density, friction, restitution, rolling resistance, thermal
  conductivity, and squash behaviour (viscoelastic rubber jiggles back over
  ~150 ms; steel snaps back instantly).
- Static friction: balls settle on slight slopes instead of creeping.
- Thermal conduction on contact — a hot steel ball dropped on ice melts the
  ice; two rubber balls (both insulators) barely share heat.
- Magnetic polarity: each magnet has a north/south pole. Opposites attract,
  like signs repel, so magnets form chains instead of clumps.
- Fragile materials accumulate damage. Enough sub-threshold hits and the
  next moderate impact shatters the ball.
- Gold plastically deforms — hard impacts leave permanent dents that rotate
  with the ball; re-heating gold anneals the dents away.
- Mercury is fluid: same-kind drops merge on low-speed contact, and the
  ball clings to walls before sliding off.

### Sound

- Procedural modal synthesis: each material has its own inharmonic mode
  stack, attack transient, and reverb send. Cross-material damping lets a
  soft body quiet a hard one (rubber hitting steel muffles the ring).
- Continuous per-material rolling / sliding voice — rubber squeaks, ice
  hisses, steel whines, bowling rumbles — with size-dependent pitch and
  stereo panning weighted by ball position.
- Plasma-to-plasma arcs produce transient crackle pops over a sustained
  electric buzz that fades in with proximity.
- Voice budget, per-ball cooldowns, and sliding-velocity gates keep dense
  collision bursts from turning into mush.

### Visuals

- Per-material body shader: chromatic refraction for glass, Fresnel edge
  bias, metallic environment bands, primary + secondary specular.
- Procedural surface micro-textures — brushed steel, rubber grain, gold
  glitter, plasma filaments, iron-filing magnets, frosted ice — baked
  once per material and rotating with the ball.
- Heat-reactive effects: ice melts with shrinking radius and water droplets,
  hot rubber smokes, metals throw embers and gain an inner forge glow that
  breathes.
- Magnetic hemispheres (red north / blue south) rotate with the ball.
- Sparks draw as velocity-aligned streaks, smoke clouds have off-center
  turbulent shapes.
- Post-FX pass: bloom, chromatic aberration, film grain, motion streaks.

## Scenes

Avalanche · Billiards · Chaos · Cloth · Conveyor · Cradle · Domino ·
Galton · Jelly · Magnets · Pinball · Plinko · Rain · Sandbox · Solar ·
Tower · Vortex · Water

## Controls

Tools are bound to the top row of the keyboard:

| Key | Tool    | Action                                    |
|-----|---------|-------------------------------------------|
| Q   | Spawn   | Drag from a ball to launch it             |
| W   | Grab    | Pick up and drag a ball                   |
| E   | Draw    | Draw a wall segment                       |
| R   | Erase   | Remove walls                              |
| T   | Link    | Connect two balls with a spring           |
| Y   | Pin     | Fix a ball in place                       |
| U   | Push    | Radial push force at the cursor           |
| O   | Attract | Radial pull force at the cursor           |
| I   | Heat    | Heat balls near the cursor                |

Arrow keys fire the pinball flippers. `Ctrl-Z` undoes. The HUD exposes live
sliders for gravity, drag, restitution, friction, Magnus, wind, and spawn
radius, plus toggles for bloom, shadows, refraction, trails, chromatic
aberration, film grain, and motion streaks.

## Architecture

Single-page ES modules, no build step. See `CLAUDE.md` for the full file
map. Layer overview:

- `src/core/` — shared state, math, theme, undo, persistence.
- `src/entities/` — ball, particle, and material definitions.
- `src/physics/` — integrator, broadphase, collisions, forces, flippers,
  fracture.
- `src/render/` — canvas setup, ball shader, world geometry, effects,
  post-FX.
- `src/audio/` — modal sound synthesis and rolling-voice mix.
- `src/scenes/` — the eighteen scene constructors.
- `src/ui/` — HUD, sliders, inspector, save/load, scene title overlay.

## License

MIT — see [LICENSE](LICENSE).
