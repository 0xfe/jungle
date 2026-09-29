# Procedural worlds, scrollback and memory

The browser now runs `InfiniteWorld`, with no finite island boundary. The camera drifts steadily in one screen direction; arrows/WASD or dragging temporarily take over. Automatic travel resumes three seconds after navigation ends (including a stationary hold after dragging). Plain taps, menu/sound controls and other non-navigation interactions do not pause it. P explicitly disables/enables drift, and pause still stops it. Two-finger pinching zooms around the moving midpoint, within 65–250%, and lifting one finger continues dragging without a jump. Shift accelerates keyboard travel, Home returns to the seeded starting forest, and N visits dry areas, meadows, lakes, forests and flowing streams. `?seed=42&x=-100&y=80` opens a reproducible location. Coordinates are camera-relative before reaching the GPU, so distant terrain does not jitter from large float32 positions.

“Infinite” means generated on demand without an authored edge, within practical JavaScript coordinate/number precision. This is not infinite memory or a claim of mathematically unlimited precision.

## Layers

```text
Global seed + signed chunk coordinates
          ↓ deterministic generator
Terrain bytes + binary agent records ← bounded ChunkCache (cold scrollback)
          ↓ activate / serialize on sleep
TerrainTile views + species instances ← active camera region
          ↓ fixed AgentSystem steps + interpolated composer
Textured terrain triangles + sprite quads → WebGL / Canvas / Memory
```

`src/streaming/` provides a reusable, content-independent `ChunkCache<T>` and fixed-memory cardinality counters. Jungle generation/lifecycle live in `src/jungle/terrain.ts` and `src/jungle/infinite.ts`. No browser, server, worker or native image API is required to generate, save, restore or test a world.

## Landscape generation

A deterministic [opening envelope](SETTINGS.md#a-quiet-opening-that-leads-into-the-forest) scales plant and animal-group placement from a sparse start into mature forest. The origin is derived from seed/settings once, never from camera position or generation order. World-space scalar fields favor dense forest with small lakes and rare small dry/meadow patches, plus vegetated relief. [Settings](SETTINGS.md) controls their relative abundance and scale. Water boundaries are interpolated contours, shared by renderer and habitat sensing. Sampling uses the same world coordinates on either side of a chunk edge, including negative coordinates. Elevation remains quantized to 1/16 pixel; contour fields use 1/4096 precision.

Four-by-four-tile chunks contain **986 terrain bytes**: 16 kinds, 16 moisture bytes, 25 shared uint16 heights (50 bytes), 256 representative subcell materials and 81 half-tile vertices × four int16 contour fields (648 bytes). This is about 62 bytes per tile before agents/overhead. Uniform tiles draw one surface quad. Boundary triangles are clipped into texture-registered material bands, using 66 shared 32×32 gradient textures rather than per-tile images. Geometry prepares once per tile; each shared field vertex generates once per chunk.

Ground is two textured triangles with actual corner heights. Plants stand on the same triangulated surface sampled by movement/rendering. Shared ground textures keep color continuous; tile-wide slope tinting is omitted to avoid artificial diamond bands. This is gentle continuous terrain, not an overhang/cave/cliff simulation; scalar ground-depth sorting cannot solve arbitrary intersecting cliffs.

Vegetation density and species depend on terrain/moisture, with individual seeded placement/phase/scale. Dry regions have less vegetation. The Flowering preset changes the species mix; Wetland starts near a shoreline. These presets don't replace the underlying regional landscape with a uniform biome. Deer destinations use actual contour water classification and nearby trunk clearance.

## Active, sleeping and expired chunks

1. The camera requests a conservative world-space rectangle, including a margin for high terrain and tall plants. `ensure()` does nothing until these bounds cross a chunk boundary.
2. Missing chunks are generated deterministically. Nearby terrain and agents are instantiated. Only this active set is simulated.
3. Leaving the active region serializes the current agent state into compact bytes. Sleeping agents retain their state but do not simulate elapsed time.
4. Cached chunks rehydrate their saved classes and continue. Terrain and agent state round trips are tested exactly, including RNG, acceleration and previous interpolation samples.
5. Under byte/count pressure, the least recently used unpinned chunks expire. A distance limit also removes faraway records. Revisiting an expired chunk recreates its original deterministic terrain/population; its last transient animal state has intentionally been forgotten.

The current wildlife model assigns herds to chunk territories. It avoids duplicate migrating animals after regeneration without maintaining an unbounded tombstone history. Animals do not yet migrate between territories or run an offscreen ecology.

Default budgets:

- **4 MiB accounted cold-cache bytes**, including byte arrays plus a 256-byte bookkeeping allowance per record.
- **256 resident chunks / 4,096 resident tiles**, independent of byte pressure.
- **12 chunks maximum Chebyshev distance** from the active-region center for unpinned entries.
- **144 active chunks maximum**; camera scale has a lower bound so oversized displays/zoom cannot request an unbounded active region. Normal views usually need much less.
- Atlas cap **64 MiB decoded**, shared by the entire world; device pixel ratio capped at **2 for WebGL / 1 for Canvas**. Canvas tint regions have a separate **8 MiB / 512-entry** cap.

Active chunks are pinned. An impossible budget throws explicitly instead of silently exceeding capacity or discarding a visible chunk. `ChunkCache` evicts before admitting a new record. Buffers for rendering are retained and grow only to the largest submitted scene, itself bounded by the viewport/active limits. Cardinality counters take a fixed 8 KiB total. These are managed-resource policies, not an assertion that the JavaScript engine or graphics driver uses exactly those bytes.

Generation is synchronous and restricted to the bounded active region. Normal travel adds an edge of chunks at a time; an Explore jump can generate a larger batch in one frame. A worker/incremental generation queue would be the next step if those spikes become noticeable on target devices.

## Statistics

| Field in `?` | Meaning |
| --- | --- |
| World size ≈ | Estimated distinct tiles generated in this world session, including the prefetch/active margin |
| Rendered ≈ | Estimated distinct tiles ever submitted by the composer |
| In memory | Exact resident tile count, active plus compact cached chunks |
| Animals / deer herds | Active mobile animals and distinct deer family IDs; independent of vegetation counts |
| Active tiles / active agents | Exact current simulation region/population |
| Visible tiles | Tiles submitted for the current viewport; partially visible tiles count |
| Generated total | Generation operations in tiles; revisiting an expired chunk increases it again |
| Expired total | Evicted tile records; repeated eviction of the same location counts again |
| Cache MiB / cap | Accounted cache cost, including its bookkeeping allowance |
| GB estimated | Resource estimate: cache, agents, terrain/prepared geometry allowance, CPU/GPU atlas, framebuffers, Canvas tint cache, retained GL vertex bytes and draw-command allowance |
| JS heap GB | Optional browser-provided JS heap usage; `n/a` when unavailable; does not include GPU textures or all browser memory |
| CPU ms p95 | Last 120 frames' CPU update/composition/submission time; excludes asynchronous GPU completion |
| Stream / Sim / Compose / Submit ms p95 | Separate percentiles for the same window; useful for isolating generation, simulation, draw-list and renderer costs |

Distinct counters use 4,096-register HyperLogLog sketches, inspired by the [original analysis](https://algo.inria.fr/flajolet/Publications/FlFuGaMe07.pdf). They are approximate and use fixed memory rather than an ever-growing set of coordinates. Counts are explicitly marked `≈`; generated/expired totals are exact event counters.

The optional heap field is not a total-process meter. A more complete [browser memory API](https://wicg.github.io/performance-measure-memory/) requires a cross-origin-isolated context and has limited availability. We don't require those headers or that API for this static site. Managed-memory estimates remain available everywhere and should be calibrated against browser profiling when tuning budgets.

## Compact checkpoints

```ts
const world = new InfiniteWorld(42);
world.ensure({ minX: -4, minY: -4, maxX: 8, maxY: 8 });
world.update(1 / 60);
const saved: Uint8Array = world.checkpoint();
const restored = InfiniteWorld.restore(saved);
restored.ensure({ minX: -4, minY: -4, maxX: 8, maxY: 8 });
```

Current world schema is **15** and agent schema is **12**; previous checkpoints are rejected. Group IDs, family relationships and individual traits remain in compact animal records. Checkpoints flush active agents first. The binary envelope contains a magic/version, seed, seven generator settings, preset, weather, time/counters, two sketches, and cached chunk coordinates/terrain/agent byte records. No JSON arrays or per-frame images are stored. The world is restored without active objects until `ensure()` selects a region. Camera and caller-owned `FixedClock` are separate; save their fields too if you need an exact displayed frame, rather than just exact simulation continuation.

Unknown versions, malformed/truncated bytes, invalid terrain and insufficient restore budgets fail explicitly. Schema version also pins the generator interpretation: change it or provide a migration when procedural rules change. Expired state cannot be recovered from a checkpoint that no longer contains it. There is no automatic disk/IndexedDB persistence or save UI yet; the headless API is ready for a future persistence adapter.

Settings changes create a new world with the same seed and a new immutable normalized settings object; no old-rule chunks survive. Camera/weather remain unchanged. Audio is independent presentation state and is not stored in a world checkpoint.

Shared compound landscape arrangements and their bounded planning probes are described in [LANDSCAPE-PATCHES.md](LANDSCAPE-PATCHES.md). Narrow stream banks use a steeper water-field slope plus shared feathered mud decals; fish schools require a substantial wet footprint, excluding small ponds.

Recurring colorful regions, canopy population/perch changes, new generated source provenance and black bear type 58 behavior/rig/codecs are documented in [regional variety](REGIONAL-VARIETY.md). Current world/agent schemas are **15/12**.

Current sound, input, bears/zebras, giraffe proportions, elephant sampling, shared landscape accents and schema 16/13 are documented in [wildlife refinements](WILDLIFE-REFINEMENTS.md).
