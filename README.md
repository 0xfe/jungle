# ∞ Infinite jungle

An endlessly scrolling isometric pixel-art jungle.

Built in TypeScript with **no runtime dependencies**, using WebGL, Canvas fallback and a real headless RGBA renderer. Independent agent classes and bounded procedural-world libraries sit alongside the reusable isometric components. Everything runs as a static site.

![A procedurally generated jungle](docs/preview.png)

## Quickstart

Requires **Node.js 22+ and npm**.

```sh
npm ci
npm run dev
```

Open **http://localhost:4173** for the full-screen jungle. **All overlays start hidden; press Enter / Return to show or hide them.** This builds assets/code and starts a local static server. It doesn't watch files: rebuild and refresh after edits. Use `PORT=8080 npm run serve` for another port.

```sh
npm run build          # deterministic assets, typecheck, bundle → dist/
npm run serve          # serve the existing build
npm run check          # build, headless tests, PNG/JSON snapshots
npm run benchmark      # streaming, simulation, composition and batching profiles
npm run assets:preview # animal direction/action contact sheets
npm run plants:preview # all tree and understory forms
npm run motion:preview # close-up supported monkey swing sequence
npm run elephants:preview # staged drinking / spraying pose review
npm run audio:preview  # generated stereo sound previews
```

Copy `dist/` to any static host, including a subdirectory. Source artwork is included; normal builds need no image-generation service, API key, CDN, external font or backend. Development dependencies are TypeScript, esbuild, tsx, sharp and Node types.

## Explore

| Key / gesture | Action |
| --- | --- |
| `Enter` / `Return` | Show or hide all overlays (hidden by default) |
| Arrows / WASD / drag | Travel without an island boundary; takes over from drift |
| Shift + arrows / WASD | Travel faster |
| `J` / Wildlife | Cycle all 14 animal habitats; stop camera drift (whales surface intermittently) |
| `N` / Explore | Visit dry scrub, a meadow, a lake, then a forest |
| `O` / Settings | With overlays visible: adjust vegetation, wildlife, water, lake size, clearings, hills and sound |
| `?` | With overlays visible: FPS, per-stage CPU timing, world/cache/memory statistics and keyboard guide |
| `R` | Generate a new seeded world |
| `1` / `2` / `3` | Rainforest / flowering / wetland preset |
| `T` | Sun / rain / dusk |
| `Space` | Pause or resume simulation and automatic travel |
| `P` | Toggle slow one-way camera drift |
| `+` / `−` / mouse wheel | Zoom from 65% to 250% |
| `Home` / `0` | Return to the seeded starting forest |
| `G` | Show tile seams |
| `Esc` | Close settings or the field guide |

**Sound:** Settings → Enable sound starts layered leaves, water, rain and nearby animal sounds. Volume sliders mix environment and wildlife independently. Sound fades when muted, paused or hidden.

World sliders regrow the current seed around your camera and reset scrollback. Default animal density is 2.5× the previous version; landscape sliders control relative abundance, not exact area percentages. Settings do not survive page reloads.

Reduced-motion preference starts paused. Reproduce a location with `?seed=42&x=-100&y=80`; force Canvas with `?renderer=canvas`. The old finite `?density=16` stress mode has been replaced by streamed-world benchmarks and wide-view travel tests.

Scrollback retains compact sleeping agent state until chunks expire. After eviction, terrain and initial populations regenerate from the seed. The default cache caps are **4 MiB / 256 chunks**, with distance expiry. Memory in GB is explicitly an estimate; the optional JS heap reading is separate. Nothing automatically persists across page reloads. A binary checkpoint/restore API is available for future storage adapters.

## Documentation

- [Elephant anatomy, drinking, play and splash responses](docs/ELEPHANTS.md)
- [Natural forest composition, variety and procedural vines](docs/FOREST.md)
- [Landscape controls and smooth shorelines](docs/SETTINGS.md)
- [Reusable audio library and sound generation](docs/AUDIO.md)
- [Animal rhythm, supported swings and flap/glide flight](docs/ANIMAL-MOTION.md)
- [Herds, new wildlife, tree variety and forest floor](docs/WILDLIFE.md)
- [Library architecture and rendering contracts](docs/DESIGN.md)
- [Independent agents, motion and compact serialization](docs/AGENTS-LIBRARY.md)
- [Procedural terrain, streaming, scrollback, budgets and statistics](docs/STREAMING.md)
- [Animation/model design and research](docs/ANIMATION.md)
- [Sprite sources and reproducible asset generation](docs/ASSETS.md)
- [Performance measurements and tradeoffs](docs/PERFORMANCE.md)
- [Testing, snapshots and debugging](docs/TESTING.md)
- [Strategy and original web research](STRATEGY.md)
- [Contributor/agent instructions](AGENTS.md)

The current prototype has gentle height fields and local herd territories. Cross-chunk animal migration, full ecological lifecycles, general pathfinding, overhangs and durable world persistence remain future work.
