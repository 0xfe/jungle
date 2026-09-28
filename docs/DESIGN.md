# Libraries and data flow

The current demo is a static TypeScript application with reusable libraries and application adapters:

| Directory | Reusable responsibility | Depends on |
| --- | --- | --- |
| `src/iso/` | Projection, fixed clock, spatial grid, quad contracts, Canvas/WebGL/memory renderers, offline mesh baker | No jungle/agent/world code |
| `src/agents/` | Independent agents, snapshot perception, seeded state, nonlinear motion, binary codecs | Isometric math/spatial primitives only |
| `src/streaming/` | Bounded generic chunk cache and constant-memory distinct counters | No application content or browser APIs |
| `src/audio/` | Pure PCM synthesis, sound planning, bounded mixing; separate Web Audio adapter | No jungle code; core runs in Node |
| `src/jungle/` | Species, terrain, chunk generation/lifecycle, visual composition | The reusable libraries above |
| `src/main.ts`, `public/` | Input, browser lifecycle, UI and statistics | Application adapters |

These are reusable source libraries, not separately published npm packages. The build-only `src/iso/bake/` modules and `scripts/art/` remain outside the browser bundle. No runtime dependencies have been added.

```text
Generated plant sources + articulated animal models + terrain textures
                    ↓ offline bake / pack
             Shared PNG atlas + JSON manifest
                    ↓
Input → world-space camera → active chunk selection ↔ compact LRU cache
                    ↓
        Independent agent classes + environment
                    ↓ fixed steps / presentation interpolation
          Terrain surfaces + depth-sorted sprite quads
                    ↓
          WebGL     Canvas     Memory → PNG/JSON
```

Read [agent library](AGENTS-LIBRARY.md) for class and serialization contracts, and [streaming](STREAMING.md) for generation, chunk ownership, cache semantics and budgets.

## Geometry and renderer contract

For 192×96 tiles, ordinary world coordinates project as:

```text
screen.x = (x - y) × 96
screen.y = (x + y) × 48 - elevation
```

Coordinates are relative to the camera before entering GPU buffers. Actors and terrain use the same piecewise-triangular elevation surface. The fixed simulation records previous/current actor samples; `FixedClock.alpha` interpolates position, shortest-arc heading and unwrapped gait without modifying simulation or consuming random values.

`DrawCommand` remains an optional-texture quad with straight RGBA tint, layer, ground depth and stable ID. Ordinary sprites use x/y/width/height. Terrain may additionally supply `corners` in UV order **(0,0), (1,0), (0,1), (1,1)**. The quad splits into triangles **0,1,2** and **2,1,3**. The x/y/width/height fields are then the bounding rectangle for culling; callers can use `quadBounds()`.

- WebGL writes those positions into the existing retained interleaved buffer and renders one painter-ordered batch with one atlas.
- Canvas clips and applies affine transforms to the same two textured triangles; sprites retain the simpler drawImage path. Its tint cache is a byte-bounded LRU (8 MiB / 512 entries), and its cost is exposed for memory statistics.
- Memory uses `quadUV()` to sample those triangles into an actual RGBA buffer. It is a real software rasterizer, not a draw-call mock.

Source pixels are straight-alpha. GL premultiplies once in the shader for `ONE, ONE_MINUS_SRC_ALPHA`; Memory stores straight-alpha output. Texture sampling is nearest-neighbor with transparent gutters and no mipmaps. Fragment UV precision is high when available. Pixel edges/alpha rounding can differ slightly between rasterizers, so browser checks remain necessary.

Layer order: ground → shadows/water details → ground-depth-sorted plants/animals → light motes → weather overlay. Ground depth is x+y; it is appropriate for gentle terrain and point-anchored props. Overhangs, tall cliffs, bridges and intersecting extended objects require a richer occlusion model.

## Scale and lifecycle

`InfiniteWorld.ensure(cameraBounds(view))` generates or rehydrates only the bounded active rectangle. It rebuilds its trunk index and tile lookup on membership changes. Sleeping chunks retain binary state. Composition caches immutable terrain texture regions/local geometry in a WeakMap, rejects offscreen terrain/anchors early and transforms only candidate surfaces. It still returns independent frame commands suitable for inspection and tests.

WebGL backing resolution follows CSS size × DPR, capped at 2; Canvas caps at 1. Quad positions stay fractional to reduce coarse stepping. ResizeObserver avoids per-frame layout queries. Camera velocity eases toward keyboard/drift targets; drag follows the pointer directly. Camera travel is unbounded rather than clamped to an island. The fixed clock limits catch-up after hidden tabs; reduced-motion preference starts paused.

WebGL falls back to a fresh Canvas renderer when unavailable or after context loss. `?renderer=canvas` selects it explicitly. Static-site relative paths and local atlas loading remain unchanged.

## Reusing the components

```ts
import { MemoryRenderer, WHITE } from '../src/iso';
const renderer = new MemoryRenderer({ width: 1, height: 1,
  data: new Uint8Array([255, 255, 255, 255]) });
renderer.render({ width: 32, height: 32, clear: [0, 0, 0, 0],
  commands: [{ id: 'marker', x: 8, y: 8, width: 16, height: 16,
    layer: 0, depth: 0, color: WHITE }] });
```

A village or reef can supply a different environment, agent registry, chunk payload and composer while keeping these contracts. The finite 16-tile `createWorld`/`composeScene` adapter remains as a small regression fixture and reference; the browser uses `InfiniteWorld`/`composeInfinite`.

## Social agents and forest detail

The reusable agent library now includes snapshot social metadata and family/flock steering. Concrete wildlife classes own threat, pursuit, perch and climbing decisions; stable group IDs travel with each compact record. Tree instances select structural forms. Terrain-following shared litter decals derive from canopy density at region changes. See [WILDLIFE.md](WILDLIFE.md). Browser presentation fills the viewport and overlays controls at the bottom; the renderer remains independent of page layout.

Optional `DrawCommand.uvCorners` supplies normalized UV coordinates for each position corner. Contour polygons use one triangle of a degenerate quad; all renderers skip its zero-area second triangle. `src/iso/contour.ts` clips field-valued convex polygons without application imports. See [settings and contours](SETTINGS.md). The separate [audio library](AUDIO.md) consumes listener/emitter data through the jungle sound adapter, never through renderer internals.

## Botanical placement and presentation

The generic `scatterCell()` priority sampler in `src/iso/distribution.ts` supplies deterministic spacing without resident neighbors. `rootedQuad()` in `src/iso/sprite-geometry.ts` supplies root-preserving scale, mirroring and shear. Neither imports jungle content. Species stands, habitat patches, appearance genotypes and form counts belong to `src/jungle/`; vine/foliage source processing belongs to the offline asset baker. See [forest composition](FOREST.md).
