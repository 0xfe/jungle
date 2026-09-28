# Performance and resource budgets — Woodland and rivers

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

A local macOS arm64 / Node 26.9.0 run with the woodland/river extension recorded:

| Scenario | Active tiles | Agents | Max quads | Stream p95 / max | Simulation p95 | Compose p95 | Encode p95 |
| --- | ---: | ---: | ---: | --- | ---: | ---: | ---: |
| Opening forest | 576 | 1,077 | 1,267 | 0.004 / 0.130 ms | 1.425 ms | 1.367 ms | 0.411 ms |
| Mature forest | 576 | 1,982 | 2,915 | 0.002 / 0.006 ms | 1.397 ms | 2.295 ms | 0.764 ms |
| Wide rain (mature) | 1,296 | 4,246 | 7,962 | 0.003 / 0.006 ms | 4.524 ms | 6.836 ms | 2.552 ms |
| Fast travel | 576 | 2,026 | 7,701 | 1.784 / 7.506 ms | 1.306 ms | 3.308 ms | 1.877 ms |

The travel run expired 864 tile records and retained about 0.66 MiB of accounted cache data. Opening wildlife is now more abundant; mature/wide scenarios still measure dense-world costs. These are local observations, not universal promises. Browser rasterization, GPU work, audio planning and display scheduling are excluded.

In Study 04, caching immutable terrain geometry/regions reduced the forest composition p95 from approximately 2.0 to 1.0 ms in this local pass. Uniform ground tiles use one quad; only material boundaries subdivide. Viewport culling happens before transforming offscreen surfaces. WebGL retains one painter-ordered batch and one atlas. Ground gradients use shared untinted textures; removing flat tile slope tints avoids sharp diamond bands and Canvas tint-cache churn. Canvas keeps tinted regions in an LRU capped at 512 entries / 8 MiB accounted bytes; continuously varying foliage tint was removed to prevent per-frame image-cache churn. Local plant vigor instead affects scale slightly. Static terrain and trunk indices rebuild on active-region changes, not camera subpixel motion. Only active agents tick; sleeping chunks are byte arrays.

For browser checks, use the default scene, zoom out, travel with Shift + arrows, and press N to cross several landscape types. Compare `?renderer=canvas`. Press Enter/Return to reveal overlays; the `?` guide shows FPS and CPU p95 over the last 120 frames, including renderer submission but excluding asynchronous GPU completion. Canvas uses clipped affine triangles for sloping ground and can be slower than WebGL. Check actual target devices before promising a frame-rate floor.

## Memory costs

- **Atlas:** 4096 × 4036 = **63.06 MiB decoded**, 11,184 logical / 9,487 unique frames, approximately 2.35 MiB PNG. The cap remains 4096 × 4096 / 64 MiB. Twenty-two tree forms, ten understory forms, four vine patterns and twenty-one active animal rigs share this texture; additional instances reuse it.
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

`artifacts/benchmark-before-elephants.json` retains the previous baseline; the Study 11 run preceded the current table and `artifacts/benchmark.json`. Atlas growth buys 704 additional elephant frames; no per-animal texture is allocated. Each mobile response adds 24 serialized bytes, and elephant water state adds another 50. Cache/count limits are unchanged.

A thirsty elephant scans at most 81 candidate shore positions × 8 headings at intervals of 8–16 seconds. Route/footprint checks stay bounded by its local territory. Wildlife skips additional splash queries when the system snapshot contains no active stimuli. A spray renders at most 16 analytically positioned droplets, with no particle simulation, per-frame textures or event history. These choices contain costs; wider scenes and synchronous chunk generation still need profiling on target devices.

## Study 12: density progression and polyphonic birds

The distance envelope is calculated during chunk generation; existing terrain/agent caches retain the result, with no new per-frame density scan or saved per-tile field. Full population density is bounded at its previous configured level. Shared atlas dimensions and texture count are unchanged. Audio planning remains at 10 Hz with a nearest-32 emitter history, exactly three distant canopy callers and a twelve-effect Web Audio cap. The expanded bank uses 9.49 MiB; shortening the bed loops to 10.5 seconds retains the previous <10 MiB allocation target.

## Graded terrain costs

The wider 32-step ground gradients add geometry along transition regions. Adjacent fan triangles share a quad when possible: measured maximum draw counts dropped from 1,470 / 3,670 / 10,750 / 12,214 to 1,166 / 2,853 / 7,828 / 7,595 across opening / mature / wide rain / travel. This is a geometry-count comparison; timings from separate runs are not a controlled speedup claim. Ground color remains deterministic, registered to world-space fields and cached per immutable tile. No new texture pages, instance textures or visited-coordinate collections were added.

Final local browser sampling showed Canvas at about 23 FPS / 24.4 ms CPU p95 in a moving lakeshore view with roughly 6,500 quads, versus the sampled WebGL opening/wide views at 60 FPS. These are different scenes and observations, not a direct renderer benchmark. The browser fallback remains visibly slower on dense contour geometry.

## Woodland and river browser observations

The desktop WebGL stream view sampled 60 FPS / 8.2 ms CPU p95 at 6,727 quads on this Mac. Canvas sampled 14 FPS / 33.0 ms CPU p95 at about 6,582 quads; scheduling and fixed-step catch-up contribute beyond the per-frame CPU sample. Canvas remains the slower fallback on shoreline-heavy views. These are device/scene-specific observations and CPU submission is not GPU completion.

Reach geometry has a bounded 128-entry memo and active lists rebuilt only at streamed membership changes. The memory estimate reserves 512 KiB for that memo plus 4 KiB per active reach. Spawn habitat queries reuse generated tile fields to avoid repeating hydrology work. Flow adds at most 48 main segments and four twig forks per active reach, culled to the viewport and rendered water. All artwork remains at its existing resolution and cadence; one-pixel transparent atlas gutters reclaim space under the nearest-neighbor texture contract.

After the toad/splash correction, the narrower 390×844 Canvas stream view sampled 50 FPS. That smaller viewport is not directly comparable to the desktop Canvas measurement.

## Shared landscape group measurements

Study 15, same local Node 26 / Apple Silicon benchmark. This replaces much of the per-plant population with grouped art, so these are resulting scene costs, not an identical-geometry microbenchmark. `artifacts/benchmark.json` contains the current run.

| Scenario | Active agents | Maximum quads | Sim p95 ms | Compose p95 ms | Stream p95 / max ms | Cache MiB |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Opening | 861 | 1,157 | 1.219 | 1.579 | .004 / .029 | .162 |
| Mature forest | 875 | 2,197 | 1.065 | 1.759 | .003 / .011 | .170 |
| Wide rain | 2,275 | 6,502 | 3.192 | 5.267 | .004 / .008 | .427 |
| Travel | 899 | 7,472 | .996 | 2.976 | .975 / 13.003 | .440 |

The previous mature scene had 1,982 active agents; the new scene has about 56% fewer. The wide scene previously had 4,246 agents and simulation/composition p95 of 4.524 / 6.836 ms. Draw count falls less than object count because tree sections keep separate painter depths and tint masks. Atlas decoding falls from 63.06 to 62.19 MiB despite the new art. PNG transfer size is about 2.54 MiB. A 256-entry planning memo has a 64 KiB estimate; prepared bank anchors have a 128-byte allowance each. Neither grows with travel history.

School eligibility uses globally aligned bounded water probes; repeated chunk-local probes share a temporary map. This reduced the measured worst travel generation spike from about 33 ms to 13 ms during this implementation. Generation still runs synchronously and occasional spikes remain possible.

Browser observations on this Mac: desktop WebGL sampled 60 FPS / 7.2 ms CPU p95 at 5,891 quads; a 65% view sampled 58 FPS / 10.0 ms at 12,804 quads. Desktop Canvas sampled 18 FPS / 24.9 ms at 5,795 quads. A 390×844 Canvas view sampled 52 FPS / 9.1 ms at 1,549 quads. These are different views/timing windows, not a cross-device FPS promise or GPU-completion measurement.

Actual browser checks covered grouped art, river banks, menu/mute, drag, zoom, keyboard navigation, Shift travel, landscape jumps, and the mobile-sized guide/toolbar. Mobile mute detection and pinch geometry have deterministic tests; physical two-finger hardware gestures and audio startup on an actual phone were not exercised by this desktop browser tool.

## Connected arrangements (Study 16)

The current arrangement benchmark reduces mature active agents from 875 to 294 and wide-view agents from 2,275 to 741. Static components/supports still occupy memory and have explicit allowances; this is a reduction in simulated objects, not a claim that all memory falls by the same percentage. No atlas pixels or texture pages were added: the generated art now forms larger compound landscapes.

The final local CPU run, including compound-owned fireflies:

| Scenario | Active agents | Max quads | Sim p95 ms | Compose p95 ms | Stream p95 / max ms |
| --- | ---: | ---: | ---: | ---: | ---: |
| forest | 220 | 1705 | 0.633 | 1.44 | 0.002 / 0.008 |
| outer-forest | 294 | 2778 | 0.876 | 2.089 | 0.002 / 0.006 |
| wide-rain | 741 | 7634 | 2.384 | 6.012 | 0.003 / 0.014 |
| travel | 311 | 7612 | 0.611 | 3.11 | 1.827 / 19.786 |

Denser overlapping foliage raises draw/composition work despite fewer simulated agents. Generation remains synchronous, with temporary vertex/probe caches and fixed candidate halos; there is no growing arrangement-history map. `artifacts/benchmark.json` contains the full run.

Browser QA sampled 60 FPS / 6.1 ms CPU p95 at 4,025 quads in the connected WebGL forest. Desktop Canvas near the stream sampled 18 FPS / 23.4 ms at 5,919 quads. A 390×844 Canvas view sampled 52 FPS / 8.2 ms at 1,805 quads. Different scenes and timing windows are not a controlled cross-renderer comparison. Checked 65% zoom, Shift travel, landscape jumps, mobile drag/zoom controls and guide layout. Physical multi-touch hardware was not tested. Source art, contact sheets and whole-scene images were inspected alongside the running site.

## Clearings and continuous wind

Occasional glades reduce visible trunks by 14–23% across three uniform mature forest samples, while retaining dense stands. Continuous rooted transforms replace the compound art's two-FPS pose changes. Removing those redundant baked poses reduces the atlas from 62.19 to 61.13 MiB decoded (4096×3912, about 2.51 MiB PNG); no extra texture pages or simulation clocks are needed.

The local CPU benchmark after these changes:

| Scenario | Agents | Max quads | Sim p95 ms | Compose p95 ms | Stream p95 / max ms |
| --- | ---: | ---: | ---: | ---: | ---: |
| forest | 220 | 1695 | 0.746 | 1.628 | 0.002 / 0.017 |
| outer-forest | 264 | 2730 | 0.845 | 2.258 | 0.002 / 0.004 |
| wide-rain | 686 | 7326 | 2.401 | 6.692 | 0.007 / 0.013 |
| travel | 284 | 7509 | 0.612 | 3.095 | 1.531 / 21.486 |

Continuous geometry adds a little composition work; this is principally a motion-cadence improvement, not a claim of universally faster rendering. Browser samples on this Mac: normal WebGL 60 FPS / 4.8 ms CPU p95 (4,370 quads), wide 65% WebGL 60 FPS / 13.6 ms (13,174 quads), desktop Canvas 20 FPS / 17.5 ms (3,436 quads), and 390×844 Canvas 44 FPS / 8.0 ms (1,296 quads). A landscape-jump sample dipped to 45 FPS; synchronous generation and Canvas rasterization remain limits. Different scenes and sampling windows are not controlled renderer comparisons or mobile-device benchmarks.

Checked live WebGL/Canvas appearance, 65% zoom, Shift travel, landscape jumps, mobile-size menu/layout, drag and zoom controls. The headless check passes 130 tests, including fixed trunk anchors, matching wood/leaf motion, interpolation across old pose boundaries and exact continuation. Physical multi-touch was not exercised.

## Recurring regions and bears

The latest CPU-only run includes 16 new landscape variants, recurring regional fields, more canopy birds and black bears. The atlas remains one page at 63.44 MiB decoded / about 3.06 MiB PNG. Component/support memory allowances remain explicit (224 / 104 bytes respectively).

| Scenario | Agents | Max quads | Sim p95 ms | Compose p95 ms | Stream p95 / max ms |
| --- | ---: | ---: | ---: | ---: | ---: |
| forest | 257 | 1674 | 1.355 | 3.334 | 0.007 / 0.087 |
| outer-forest | 301 | 2782 | 1.455 | 4.965 | 0.015 / 0.034 |
| wide-rain | 754 | 7355 | 3.047 | 8.115 | 0.007 / 0.012 |
| travel | 308 | 7375 | 0.703 | 3.575 | 1.595 / 21.681 |

These are fresh measurements, not a controlled before/after speed claim. More wildlife increases simulation work; regional water can change terrain contour draw counts substantially. Host timing also varied during this session (the same asset bake ranged from roughly 13 to 69 seconds). The benchmark ran after closing the browser previews and finishing tests; `artifacts/benchmark.json` contains the full result.

Live browser samples: flowering WebGL at 100% sampled 60 FPS / 5.0 ms CPU p95 with 3,841 quads; 65% sampled 60 FPS / 8.9 ms with 7,787 quads. A dense riverside fruiting Canvas scene sampled 10 FPS / 53.0 ms with 8,508 quads, and a 390×844 Canvas scene sampled 27 FPS / 22.0 ms with 815 quads. Different locations and timing windows are not renderer/device comparisons; Canvas remains a slower fallback, and synchronous generation still causes occasional travel spikes.

Inspected flowering/fruiting/open/wet headless scenes, the new source sheets and bear contact sheets/habitat snapshot, plus actual WebGL/Canvas appearance, 65% zoom, Shift travel, landscape navigation, pause/menu, and mobile-size drag/zoom/guide layout. Physical mobile hardware/pinch was not retested. Full check: 138 passing tests. Population samples, behavioral scope and source provenance are in [regional variety](REGIONAL-VARIETY.md).

## Livelier landscapes with bounded crown detail

The wind pass retains one source pose per mask and adds four small flower-petal masks: 11,589 logical / 9,844 unique frames, 4096×4064, 63.50 MiB decoded and about 3.07 MiB PNG. Full detail adds at most three extra affine bands per selected mask; no agents, simulation updates or atlas copies are added. All trees and ground foliage keep broad breeze motion, while a stable subset of crowns receives optional local ripples.

Rendering was already driven by available requestAnimationFrame callbacks, without a fixed render-rate cap. It continues to submit complete painter-ordered scenes. The fixed 60 Hz clock governs simulation, and interpolation supplies presentation samples. A new CPU-cost average fades optional ripple coverage toward 30% of its configured maximum under sustained load (14 ms target, 1.5-second response), restoring it below 70% of the target. Broad motion and wildlife do not stop. This feedback measures CPU submission, not GPU completion; it cannot guarantee 30 or 60 FPS or eliminate synchronous chunk-generation spikes.

CPU-only benchmark after closing previews and completing checks, at full wind detail:

| Scenario | Agents | Max quads | Sim p95 ms | Compose p95 ms | Stream p95 / max ms |
| --- | ---: | ---: | ---: | ---: | ---: |
| forest | 257 | 2017 | 1.001 | 2.500 | 0.005 / 0.021 |
| outer-forest | 301 | 3319 | 0.973 | 3.089 | 0.003 / 0.007 |
| wide-rain | 754 | 8281 | 2.717 | 7.197 | 0.005 / 0.082 |
| travel | 308 | 7514 | 0.680 | 3.919 | 1.655 / 21.849 |

These timings are not a controlled speedup claim. Added quads are the explicit cost of crown bands and separate flower color; agent counts and cache allowances remain unchanged. `artifacts/benchmark.json` contains the full results.

Desktop WebGL in the seed-2718 flowering region sampled 60 FPS / 5.8 ms CPU p95 at 100% (4,293 quads), and 60 FPS / 12.1 ms at 65% after settling (9,061 quads). Canvas showed correct geometry but remained slow: the dense flowering sample was 8–9 FPS / roughly 49–55 ms CPU p95, around 3,950 quads. That Canvas sampling overlapped the headless checks and is not an isolated renderer comparison. The CPU benchmark above was run separately. No minimum-FPS claim is made for Canvas or physical mobile devices.

Inspected the new fixed-camera wind strip and regenerated scenes, live WebGL/Canvas foliage, 65% zoom, Pause/Resume, a 390×844 viewport, drag, Shift-arrow input and landscape navigation. Actual phone hardware and physical pinch were not tested. `npm run check` passes 143 tests, including shared-band registration, root anchoring, stationary soil, petal/stem motion, grass-skirt depth, pause redraws and budget recovery. See [landscape motion](LANDSCAPE-PATCHES.md#lively-ground-and-adaptive-crown-detail).
