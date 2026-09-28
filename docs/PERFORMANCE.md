# Performance and resource budgets — Study 11

The browser now streams a world instead of drawing a fixed 16-tile island. Performance is bounded by the active viewport and cache policies, not distance traveled. See [streaming](STREAMING.md) for exact counter/memory semantics.

## Motion without slow-running sprites

The previous 0.34-tile/second run with a 0.36-tile stride played only 0.94 cycles/second. The new nominal run is 1.05 tiles/second with a 0.45-tile stride: about 2.33 cycles/second, with matching foot excursion in the baked model. Acceleration changes smoothly through a jerk-limited motor; stopping-distance and close-range envelopes control braking. Camera velocity, angular velocity, wind response and head poses also ease appropriately. See [agent library](AGENTS-LIBRARY.md).

Simulation stays deterministic at 60 Hz. Previous/current samples interpolate on every display frame, and projected positions remain fractional. Sprite sampling stays nearest-neighbor. WebGL presentation uses native resolution capped at DPR 2; Canvas fallback caps at DPR 1, trading some fill-rate for less visible positional stepping. Discrete headings and sprite poses remain an intentional pixel-art limitation.

## Reproduce the CPU profiles

```sh
npm run build
npm run benchmark
```

The benchmark warms up for 120 frames, then measures 360 frames. `artifacts/benchmark.json` records median/p95/max streaming, simulation, composition and quad-encoding times, plus population/cache statistics. The travel case moves rapidly across chunk boundaries; its worst generation frame is reported separately. There are no machine-dependent pass/fail thresholds.

A Study 11 local macOS arm64 / Node 26.9.0 run recorded:

| Scenario | Active tiles | Agents | Max quads | Stream p95 / max | Simulation p95 | Compose p95 | Encode p95 |
| --- | ---: | ---: | ---: | --- | ---: | ---: | ---: |
| Forest | 576 | 1,893 | 1,692 | 0.002 / 0.005 ms | 1.289 ms | 1.706 ms | 0.391 ms |
| Wide rain | 1,296 | 4,175 | 4,355 | 0.003 / 0.005 ms | 3.260 ms | 4.145 ms | 1.259 ms |
| Fast travel | 576 | 2,018 | 2,920 | 1.650 / 16.187 ms | 1.094 ms | 1.934 ms | 0.644 ms |

These are an implementation-time sample, not universal performance promises or exact permanent population counts. Generative-rule changes may change populations slightly. The travel run expired 864 tile records and retained about 0.59 MiB of accounted cache data. Browser rendering, GPU upload/completion, pixel rasterization and display scheduling are **excluded** from these CPU timings.

In Study 04, caching immutable terrain geometry/regions reduced the forest composition p95 from approximately 2.0 to 1.0 ms in this local pass. Uniform ground tiles use one quad; only material boundaries subdivide. Viewport culling happens before transforming offscreen surfaces. WebGL retains one painter-ordered batch and one atlas. Terrain shading uses a small set of brightness levels. Canvas keeps tinted regions in an LRU capped at 512 entries / 8 MiB accounted bytes; continuously varying foliage tint was removed to prevent per-frame image-cache churn. Local plant vigor instead affects scale slightly. Static terrain and trunk indices rebuild on active-region changes, not camera subpixel motion. Only active agents tick; sleeping chunks are byte arrays.

For browser checks, use the default scene, zoom out, travel with Shift + arrows, and press N to cross several landscape types. Compare `?renderer=canvas`. Press Enter/Return to reveal overlays; the `?` guide shows FPS and CPU p95 over the last 120 frames, including renderer submission but excluding asynchronous GPU completion. Canvas uses clipped affine triangles for sloping ground and can be slower than WebGL. Check actual target devices before promising a frame-rate floor.

## Memory costs

- **Atlas:** 4096 × 3980 = **62.19 MiB decoded**, 9,806 logical / 8,151 unique frames, approximately 2.05 MiB PNG. The cap remains 4096 × 4096 / 64 MiB. Twenty-two tree forms, ten understory forms, four vine patterns and fourteen active animal rigs share this texture; additional instances reuse it.
- **Terrain:** 986 bytes per 16-tile chunk, plus compact species records and a bookkeeping allowance.
- **Cold cache:** 4 MiB accounted bytes and 256 chunks maximum, with distance expiry. Active-region requests also have a hard count limit.
- **Exploration counters:** 8 KiB fixed, regardless of travel distance.
- **Canvas tint cache:** at most 512 entries / 8 MiB accounted bytes; included in the GB estimate.
- **Runtime:** additional live agent/tile/index/prepared-geometry objects, retained CPU/GPU vertex capacity and framebuffers are included (exact buffer capacities where known; otherwise documented allowances) in the GB estimate.

The GB figure is not a browser-process memory measurement or hard OS memory cap. CPU pixels remain available for graphics fallback; GL holds a separate texture, and decoding, garbage collection, driver bookkeeping and checkpoints can add transient memory. Optional JS heap telemetry also excludes GPU resources. See [streaming](STREAMING.md) before tuning the constants.

The next optimizations should follow profiles: worker/incremental chunk generation for teleport spikes, better retained draw-list allocation if needed, actor simulation LOD, and GPU fill-rate/overdraw measurement at target DPR. Don't add a full ECS/physics engine or one thread per agent without a measured need.

## Study 05 population and perception costs

Species sense neighbors at roughly 3–5 Hz, while motion/interpolation stays at 60 Hz/display rate. Only mobile actors enter the perception grid. Family steering sorts its small peer list by stable ID for order-independent sums. Perches use the existing trunk index. Canopy-density litter placement rebuilds on region membership changes, not each frame. Discrete coat tints keep Canvas cache variation bounded. The benchmark above includes these behaviors, shared ground decals and the larger full-screen viewport. See [wildlife](WILDLIFE.md) for the reproducible sparse-population sample.

Canvas terrain/litter triangles now draw from small cached source regions rather than transforming the entire large atlas through each clip. Canvas also caps its backing resolution at DPR 1 to limit full-screen fill cost (WebGL retains DPR 2). These white regions share the existing bounded region/tint LRU, so the optimization does not introduce another unbounded cache.

The checked full-screen Canvas fallback improved from approximately 2 FPS to 28 FPS / 33.8 ms CPU p95 after those fixes. It remains slower than WebGL in dense views; this iteration does not promise a 60 FPS Canvas floor. Mobile WebGL measured 60 FPS / 3.6 ms CPU p95 in the checked view. These observations are local, scene/device-specific samples.

Study 06 reuses active quarter-tile terrain material/height samples for habitat sensing. Static root cover and groves rebuild only with region membership. Small crab/fish/parakeet rigs use eight headings; other new rigs use sixteen. Runtime simulation remains 60 Hz, with social/path decisions throttled to a few checks per second. Wildlife navigation verifies actual spawn records using non-resident previews, so searching does not inflate world counters.

Study 06 validation: Browser checks exercised the 15-species wildlife tour, desktop WebGL and Canvas, weather controls and the 390×844 mobile toolbar/guide. No console warnings or errors were reported. Local samples were 60 FPS / 8.9 ms CPU p95 in a desktop land view, 58 FPS / 13.8 ms at the whale coastline, and 60 FPS / 8.5 ms in the mobile bird view. Full-screen Canvas was 25 FPS / 38.8 ms in the checked land view; it remains a slower fallback. These are scene/device-specific observations, not guarantees.

## Study 07 contours, density and audio

The current benchmark above includes forest-heavy defaults and 2.5× candidate animal density. Uniform tiles retain one quad; material boundaries use cached clipped triangle geometry with explicit UVs. Generation samples each shared vertex once and derives compact metadata from it. Habitat queries interpolate stored fields without allocating four-field arrays when only one threshold is needed. Travel still has occasional synchronous generation spikes; audio processing/GPU work are excluded from this benchmark.

Live tile/field/prepared-geometry allowance increased to 6 KiB per active tile. Enabled audio adds under 10 MiB of shared PCM buffers and a fixed graph (four beds, at most twelve effect voices); it does not grow with actor count or travel distance. The planner samples at 10 Hz and tracks at most 32 nearby emitters. Sound-source iteration is an application cost; no audio DSP runs in the animation loop.

The checked 390×844 mobile WebGL scene, with sound enabled, showed 60 FPS / 4.0 ms CPU p95. A dense full-screen Canvas view showed 13 FPS / 88.5 ms; the fallback remains substantially slower than WebGL with the increased foliage and animals. Browser/device observations are samples, not a frame-rate guarantee.

A subsequent dense desktop shoreline WebGL check recorded 38 FPS / 37.6 ms CPU p95 with 420 active animals and 2,455 visible quads. Increased density has a real cost on this browser/device; the mobile view was lighter. Use the vegetation/wildlife sliders for device-specific tuning. The next scale investigation should profile the browser simulation, draw submission and GPU fill separately before introducing further rendering machinery.

## Study 08 plant variety costs

Sixteen additional structural source plants and four vine clips add only about 2 MiB of atlas allocation over Study 07. Smaller source bake resolutions retain logical display size, union trimming/deduplication and 32 wind phases. Two-byte plant genotypes expand once into cached traits. Placement thinning and connected-component source cleanup run during chunk generation and asset baking respectively, not per frame. Vines add one shared quad to a small subset of mature trees and no independent simulation tick.

Rooted plant quads add corner-transform and vertex-encoding work; CPU timings above include it. Canvas uses a single affine draw for parallelograms, sampling untinted plants directly from the atlas. General clipped terrain triangles retain their bounded region cache. Browser visual checks covered both renderers, travel/zoom and the desktop settings panel. No universal 60 FPS claim is made; dense Canvas scenes and generation spikes remain limitations.

## Study 09 flight and swing costs

The reusable flight controller performs constant work per active bird and creates no per-tick sprite or texture. Glides reuse the level-wing flight frame. A swinging monkey adds one solid vine quad only while swinging. Wildlife saves add 33 bytes per record for flight/trip state; compact terrain, cache caps and renderer batching are unchanged. In Study 09, revised monkey clips and 24-phase ecological bird flights brought the atlas to 63.31 MiB, below the unchanged 64 MiB cap but with little spare capacity. Future art additions should review packing/frame resolution before raising that cap.

The updated CPU benchmark above excludes rendering and is not a browser FPS guarantee. WebGL and Canvas visual checks covered the revised forest/flight frames, Wildlife navigation and Hills control; console logs were clean. Mobile layout was not changed or revalidated in this iteration.

## Study 10: pack motion, pixel stability and measured costs

The baseline captured this session is `artifacts/benchmark-before-packs.json`; the final run is `artifacts/benchmark.json`. Forest / wide-rain / travel composition p95 changed from 1.922 / 4.192 / 2.326 ms to 1.655 / 3.874 / 1.898 ms, roughly **14% / 8% / 18% less**. Simulation p95 changed from 1.386 / 2.958 / 1.159 ms to 1.334 / 2.926 / 1.032 ms, despite slightly larger wolf populations. These are local samples with modest population differences, not a controlled browser FPS guarantee.

Uniform immutable terrain now caches its material classification. The shortcut only accepts a convex scalar-field region: shore sand and inland dry scrub cannot be merged merely because their vertices share the label Dry. Environment sampling returns a consistent object shape instead of rebuilding it through object spread. Quad bounds avoid four temporary mapped arrays per quad, and offscreen litter is rejected before projecting all four terrain-sampled corners. No renderer contract, transparent sorting rule or fixed simulation frequency changed.

The tree redraw effect also had an art-sampling component. Wind now shifts registered leaf pixels instead of re-sampling the detailed painting for every subpixel displacement; continuous rooted sway handles the broad motion. Exact frame sharing plus backfilling shelf gaps reduced the decoded atlas from **63.31 to 57.94 MiB**, despite adding 320 wolf run frames. That saves roughly 5.4 MiB for each CPU/GPU atlas copy. Pixel sampling stays nearest-neighbor and retains some deliberate stepping at large zoom.

The field guide now reports separate rolling p95 **stream / simulation / composition / submission** times. Submission includes driver calls, not asynchronous GPU completion; stage percentiles are independent and should not be added as a precise total. Zoom expands to 250% without lowering the 65% minimum or increasing active/cache limits.

Browser checks covered WebGL and Canvas, the wolf pack view, zoom bounds, rain, Shift-arrow input, and the 390×844 mobile field guide/toolbar (viewport dimensions verified). Console logs were clean. A final desktop WebGL view sampled 58 FPS / 31.0 ms CPU p95 at 1,830 quads; another sampled 60 FPS / 16.3 ms at 2,564 quads. A dense Canvas view sampled 15 FPS / 67.9 ms at 1,906 quads. Scene populations, timing windows and browser scheduling differ: these observations show remaining stalls rather than establishing a frame-rate floor. Large jumps still generate synchronously; dense Canvas submission and simulation catch-up remain candidates for further profiling.

## Study 11: bounded elephant interactions

`artifacts/benchmark-before-elephants.json` retains the previous baseline; the table above and `artifacts/benchmark.json` are the updated run. Atlas growth buys 704 additional elephant frames; no per-animal texture is allocated. Each mobile response adds 24 serialized bytes, and elephant water state adds another 50. Cache/count limits are unchanged.

A thirsty elephant scans at most 81 candidate shore positions × 8 headings at intervals of 8–16 seconds. Route/footprint checks stay bounded by its local territory. Wildlife skips additional splash queries when the system snapshot contains no active stimuli. A spray renders at most 16 analytically positioned droplets, with no particle simulation, per-frame textures or event history. These choices contain costs; wider scenes and synchronous chunk generation still need profiling on target devices.
