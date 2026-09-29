# ∞ Infinite jungle

An endlessly scrolling animated isometric pixel-art jungle with vegetation, birds, animals, etc. See it live at: [https://mo.town/jungle](https://mo.town/jungle).

Built in TypeScript with **no runtime dependencies**, using WebGL, Canvas fallback and a real headless RGBA renderer. Independent agent classes and bounded procedural-world libraries sit alongside the reusable isometric components. Everything runs as a static site.

![Five seconds in the living jungle, with swaying flowers, rustling foliage and roaming wildlife](docs/preview.gif)

[Still image](docs/preview.png) · Regenerate with `npm run readme:preview`.

## Quickstart

Requires **Node.js 22+ and npm**.

```sh
npm ci
npm run dev
```

Open **http://localhost:4173** for the full-screen jungle. **Press Enter / Return to show or hide the compact bottom menu.** Only the mute button is visible initially, in the top right. Double-tap the scene on touchscreens to show the menu; `?` opens Help even while the menu is hidden. This builds assets/code and starts a local static server. It doesn't watch files: rebuild and refresh after edits. Use `PORT=8080 npm run serve` for another port.

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
npm run patches:preview # generated landscape groups and their trunk templates
```

## Deployment

Copy `dist/` to any static host, including a subdirectory. Source artwork is included; normal builds need no image-generation service, API key, CDN, external font or backend. Development dependencies are TypeScript, esbuild, tsx, sharp and Node types.

Deploy with `./upload.sh dev` to `muthanna.com/jungle-dev/` or `./upload.sh prod` to `muthanna.com/jungle/`. Each command builds first, uploads hashed assets with a one-day TTL, then publishes the index with a five-minute TTL. Add `--clean` to prune the selected environment after a six-minute cache/loading grace period. With no environment, the script prints help. npm aliases: `npm run upload:dev` and `npm run upload:prod -- --clean`. See [deployment and cache details](docs/DEPLOYMENT.md), including cleanup/concurrency limits and local cache previews.

To change application defaults, edit [src/config.ts](src/config.ts), then rebuild. It covers startup, camera, density, wildlife probabilities, audio (including every individual sound), rendering and cache limits. See [configuration details](docs/CONFIGURATION.md).

## Explore

| Key / gesture | Action |
| --- | --- |
| `Enter` / `Return` | Show or hide the bottom menu (hidden by default) |
| Arrows / WASD / drag | Travel without an island boundary; drift resumes 3 seconds after navigation ends |
| Shift + arrows / WASD | Travel faster |
| `J` | Cycle all 21 animal habitats; briefly pause camera drift (whales surface intermittently) |
| `N` | Visit dry scrub, meadow, lake, forest, then a stream |
| `O` / Settings | With overlays visible: adjust vegetation, wildlife, water, lake size, clearings, hills and sound |
| `?` | With overlays visible: FPS, per-stage CPU timing, world/cache/memory statistics and keyboard guide |
| `R` | Generate a new seeded world |
| `1` / `2` / `3` | Rainforest / flowering / wetland preset |
| `T` | Sun / rain / dusk |
| `Space` | Pause or resume simulation and automatic travel |
| `P` | Toggle slow one-way camera drift |
| `+` / `−` / mouse wheel / pinch | Zoom from 65% to 250% |
| `Home` / `0` | Return to the seeded starting forest |
| `G` | Show tile seams |
| `Esc` | Close settings or the field guide |

## Documentation

- [Snake behavior, rigs and tree wrapping](docs/SNAKES.md)
- [Shared landscape artwork, navigation templates and memory](docs/LANDSCAPE-PATCHES.md)
- [Recurring colorful regions, canopy wildlife and black bears](docs/REGIONAL-VARIETY.md)
- [Application defaults and per-sound tuning](docs/CONFIGURATION.md)
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
