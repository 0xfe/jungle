# Building a living, infinite jungle

Research and implementation notes · 26 September 2026

Study 04 implements streamed terrain, bounded compact scrollback, independent species agents, binary save/restore, faster nonlinear running and world/memory statistics. See [agent library](docs/AGENTS-LIBRARY.md), [streaming](docs/STREAMING.md) and [animation research](docs/ANIMATION.md). Study 06 adds eleven habitat-specific animal classes/rigs, continuously following fish schools, timed whale surfacing, canopy swings, coherent tree stands and subtle root litter. See [wildlife design](docs/WILDLIFE.md) for implemented behavior and limitations. The original research below remains the foundation.

Study 07 makes forest dominant, increases wildlife, adds live generator sliders and replaces square shore steps with shared-field textured contours. A reusable pure PCM/planner library feeds a bounded Web Audio adapter for layered ambience and nearby effects. See [landscape controls](docs/SETTINGS.md) and [audio design/research](docs/AUDIO.md).

The jungle is an art project first: the viewer should notice a deer lifting its head, light moving across water, and different densities of canopy before noticing a tile grid. Build a small, legible diorama, establish an art and simulation contract, then extend the world. Keep the renderer reusable and independent of jungle rules.

## What we can learn from existing projects

These are primary sources consulted for this project. They inform the design; no library source or third-party artwork was copied into the application.

| Project / reference | Useful technique | Decision for Jungle |
| --- | --- | --- |
| [Clint Bellanger: Isometric Tiles Math](https://clintbellanger.net/articles/isometric_math/) | Keep ordinary map coordinates; project and invert using half tile dimensions. | Fractional world coordinates, a 2:1 diamond projection, and inverse projection tested at positive and negative coordinates. |
| [Obelisk.js](https://github.com/nosir/obelisk.js/) | A focused Canvas library can express pixel-isometric objects without a full game engine. | Use a small renderer package. Generate terrain from geometry, but use authored/generated sprite silhouettes for organic life. |
| [Phaser isometric depth sorting example](https://rotates.org/phaser/iso/examples/realtime_depth_sorting.htm) and [Phaser display lists](https://docs.phaser.io/phaser/concepts/gameobjects/display-list) | Objects need an explicit depth order as they move through an isometric scene. | Sort ground-anchored trees, bushes and deer together, rather than drawing every animal over every tree. |
| [Phaser animation concepts](https://docs.phaser.io/phaser/concepts/animations) | An atlas frame is separate from the animation using it; multiple actions can share a texture. | Store frame rectangles and anchors in a manifest. Simulation chooses graze/look/walk; presentation chooses a frame. |
| [Tiled terrain sets](https://doc.mapeditor.org/en/stable/manual/using-wang-tiles/) | Terrain adjacency belongs to compatible edges and corners, not independent random tile choices. | Sample water and climate in continuous world space. Future authored shores can use edge/corner masks. |
| [Tiled infinite maps](https://doc.mapeditor.org/en/stable/manual/using-infinite-maps/) | Map extent can grow independently of the viewing window. | Future storage will use signed chunk coordinates; the viewport should determine residency, not world extent. |
| [PixiJS performance guidance](https://pixijs.com/8.x/guides/concepts/performance-tips) | Sprite atlases, batches, stable geometry, and carefully chosen culling reduce rendering cost. | One atlas, one transparent triangle batch, cached terrain images, and viewport culling. Profile before adding complexity. |

## 1. Art direction and scale

Use bright emerald and jade foliage, warm bark and deer, coral flowers, blue-green water, and readable dark outlines. Pixel art requires deliberate clusters and a consistent apparent pixel scale. Use nearest-neighbor sampling from atlas to logical canvas and `image-rendering: pixelated` for presentation. Avoid filtered scaling and arbitrary sprite rotation.

Terrain tiles are 192 × 96 logical pixels with a 15-pixel exposed soil edge on the outside of the diorama. A tree uses a 128 × 96 frame; undergrowth uses 96 × 64 frames, while the model-based deer is baked at 72 × 72 before trimming. Different tree species, ferns, flowering plants and rocks break up repetition. Ground anchors are explicit; frame edges are not placement coordinates.

Generated sheets are candidates, not a guaranteed production format. Review grid alignment, silhouettes, baselines, alpha and loop transitions. Keep the source PNGs and exact prompts. Conversion into runtime assets must be repeatable, local, and independent of the image generation service. See [asset generation](docs/ASSETS.md).

## 2. Layers and reusable rendering

Use three boundaries:

1. `src/iso`: projection, deterministic sampling, fixed clock, draw-command contracts, in-memory compositor, WebGL and Canvas adapters. No knowledge of deer, trees, weather, or HTML menus.
2. `src/jungle`: terrain fields, habitat rules, species behavior, scene composition. No DOM access.
3. `src/main.ts` and `public/`: input, resize, asset loading, animation frame scheduling and accessible controls.

Draw order is island shadow → terrain → surface details and ground shadows → depth-sorted objects → atmosphere. Object depth is the sum of world x and y, measured at the feet/root. Stable IDs break ties. A tall tree can occlude a deer passing behind it.

This simple ordering is appropriate for small point-anchored props. Large bridges, sprawling fallen trunks and intersecting canopies will need split sprites or footprint-aware occlusion; do not pretend a single scalar solves every isometric overlap. Keep geometry on the CPU and atlas pixels in a single GPU texture. Never reorder transparent sprites by texture at the expense of depth.

## 3. Terrain and connected biomes

The current streamed world uses global continuous elevation/moisture fields. A shared water level forms large connected lakes and shore bands. Forest, meadow, scrub and ridge materials vary regionally. Chunk border heights match, ground uses sloping triangles, and 4×4 material subcells make boundaries finer than whole tiles. Terrain textures are shared across every chunk.
Implemented foundations and next terrain refinements:

- Use a world seed plus signed integer tile/chunk coordinates to derive content. Visiting chunks in a different order must not change them.
- Evaluate low-frequency elevation, moisture, canopy density and temperature fields at world coordinates. Blend biomes through these fields; don't choose an unrelated climate independently for each tile.
- Determine water from elevation and a regional water table. Build lakes over regions larger than one chunk, with deterministic edge rules. Rivers eventually require a drainage graph, not independent blue decorations.
- Give artifacts habitat constraints: ferns favor shade, palms wet edges, grazing deer clear ground. Use deterministic spacing checks rather than uniformly scattering everything.
- Sample sunlight and wind over a region. Add local canopy shade and rain exposure later. Objects read the field at their current position, so moving across a tile boundary does not abruptly reset their environment.

The current `climateAt` demonstrates continuous regional fields. Weather remains a scene-wide override; a full spatial weather and lighting model is future work.

## 4. Life and motion

Fixed artifacts have immutable world anchors and phase-offset 32-frame wind loops sampled from a registered source pose. Wind changes playback speed; trunks should remain registered while the leaves move. Water shimmer uses world-space samples and simulation time. The demo also has drifting light motes and a rain overlay.

Animals need species-specific behavior, not the same random walk with a different sprite. The deer alternate graze → raise → look → turn → walk/run → lower → graze, with individual and per-trip pace, bounded acceleration and arrival braking. Sixteen baked headings follow continuous world-space heading; walking phase advances by traveled distance. Short strides lead toward nearby clear ground, with slower movement than a running predator, longer grazing rests at dusk and faster walking in rain. The deer cross internal tile boundaries and stop before water or tree trunks.

Future tiger behavior should use explicit rest, patrol, orient, stalk, pursue and recover states. Perception should include distance, direction, visibility and prey state. A pursuit changes both predator and prey: a deer lifts its head, flees, and later returns to grazing. Keep animation clips separate from steering so a tiger can turn its head while standing still. Flying birds need height, perch targets and landing transitions; leaves need wind advection and settling. Introduce these one species at a time with behavioral tests.

Use a fixed 60 Hz simulation and independently scheduled rendering. Pause stops simulation time. Cap catch-up after a background tab so animals do not suddenly jump. Interpolate previous/current poses and animation clocks with the fixed-clock remainder. Keep rendering positions fractional and present at device resolution (DPR capped at 2), retaining nearest-neighbor sprite sampling.

## 5. Camera and the infinite-world milestone

The camera now drifts continuously in one direction and has no island boundary. Dragging or keyboard travel takes over, Shift moves faster, and Home returns to the seeded starting area. Projection subtracts the world camera before producing GPU positions.

Four-by-four-tile chunks are generated synchronously around the viewport, with a margin for terrain height and canopies. Live agents run only in this active region. Inactive chunks store 338 terrain bytes plus binary agent state. A 4 MiB / 256-chunk LRU cache expires distant records as well as records under capacity pressure. Revisits restore saved state while cached; after eviction they regenerate the initial deterministic population.

A bounded, versioned checkpoint API serializes the retained world. There is no automatic durable storage, offscreen ecology or cross-chunk animal migration yet. Future work includes worker generation if spikes justify it, persistent identities/migration ownership, and separate service/storage adapters.
Acceptance criteria: negative coordinates work; a revisited chunk matches its prior appearance; a lake edge is identical regardless of neighbor load order; memory settles after ten minutes of travel; a browser frame remains within the target budget at a recorded viewport/device.

## 6. Test and performance strategy

Tests must work on Node without Canvas native bindings, a display, WebGL, or a browser. The software renderer composites the actual atlas into an RGBA buffer. Tests examine real pixels, atlas bounds, transparency, ordering, reproducibility, behavior and animation. Snapshot tooling writes PNGs and JSON command lists for inspection.

The headless renderer is a reference, not proof that GPU upload, browser scaling, or input events work. A small final browser check covers those boundaries, Canvas fallback, responsive layout and console errors. Don't use browser automation for every simulation test.

The initial performance target is smooth animation on a modern laptop. Report actual FPS rather than promising 60 on all devices. This scene uses one atlas and one WebGL draw call per frame; the overlay counts submitted quads. Static trunks and mobile perception use spatial grids; only nearby plants become draw commands. `npm run benchmark` measures forest, wide-rain and fast-travel scenarios; browser travel/zoom checks cover the actual rendering surface. See [performance](docs/PERFORMANCE.md) for costs and limitations. Before streaming, benchmark chunk generation and resident memory too. Avoid ECS frameworks, physics engines, shaders for every leaf, and dependencies until a measured need appears.

## Delivery stages

| Stage | Status / outcome |
| --- | --- |
| Finite baseline | Retained as a regression fixture: generated plants with baked wind loops, model-baked directional deer, connected water, weather, habitat choices, camera controls, renderer adapters, headless tests and static build. |
| Art refinement | Directional model baking and registered plant wind loops are implemented. Head-lift/lower transitions, varied pacing and running are implemented. Next refine anatomy and authored shoreline detail; add a build-only glTF rig adapter when artist-authored models need it. |
| Streamed terrain | Implemented: deterministic chunks, regional elevation/water/vegetation, compact bounded caches, continuous travel, binary checkpoints and world/memory stats. Background generation remains a profiling-driven next step. |
| Ecological motion | Independent artifact classes, per-agent RNG, local neighbor responses, nonlinear motion and serialization are implemented. Sparse family herds, toucan flocks, climbing orangutans and solitary jaguar pursuits are implemented; migration, fuller pathfinding and spatial weather remain future work. |
| Optional persistence | Add a separate service adapter for saved seeds/world events. The renderer and static application must remain useful without a server. |

See [the implemented design](docs/DESIGN.md) for contracts and current limitations.

## Study 05 implementation

See [wildlife and canopy design](docs/WILDLIFE.md): reusable group steering, serialized parent/leader links, fawns, three additional articulated species, twelve generated tree forms, density-sensitive mud/litter and a full-screen viewport. Offline baking still feeds one bounded atlas. Sparse encounters replace per-chunk deer pairs. Biological roles differ by species; this remains an artistic world rather than a complete ecosystem simulation.

## Study 08: a less repetitive forest

Implemented: generated structural plant sources, 22 tree / ten understory forms, coherent broadleaf-heavy stands, cross-boundary priority-thinned tree positions, continuous canopy/understory patches, mixed growth stages, compact individual width/height/lean/orientation traits, rooted gusts and four shared procedural vine patterns. The atlas stays within 64 MiB and wind retains 32 phases. Canvas now draws affine plant quads without triangle clipping. Research, tradeoffs, reproduction steps and limits are in [forest composition](docs/FOREST.md). Full procedural 3D botany, arbitrary rotations, growth and inter-tree vine attachment remain future options, not implemented features.

## Study 09: less mechanical wildlife

Implemented: mostly grounded/perched monkeys with separate walk/climb clips and rare short supported pendulum swings; visible hand-registered vines; species-specific powered/glide flight profiles with individual/trip/cycle cadence; per-trip pacing for other wildlife. Crabs are disabled and gray ridge cover is removed while relief remains vegetated. This uses authored rigs, the existing atlas, and a reusable headless flight component; no new runtime dependency or generated raster art. Details and limitations: [animal motion](docs/ANIMAL-MOTION.md).

## Study 10: cohesive packs and steadier presentation

Implemented: larger wolf families with occasional smaller cubs, live parent/leader steering, catch-up and short pack runs, and solitary non-hunting jaguar runs. Ground motion retains bounded acceleration, arrival braking and body-scaled distance-driven strides. Zoom now spans 65–250%. The wind bake preserves registered leaf texture, continuous rooted shear handles canopy sway, and deterministic best-fit shelf packing leaves more atlas headroom. Uniform terrain sampling and quad bounds allocate/work less; the field guide separates stream, simulation, composition and submission costs. See [animal motion](docs/ANIMAL-MOTION.md) and [measured performance](docs/PERFORMANCE.md). Migration, full pathfinding and background generation remain future work.

## Study 11: elephants at the water

Implemented: a dedicated articulated elephant mesh with a continuous tapered trunk; 16-direction walking, drinking and spraying clips; shared pose geometry for nozzle registration; bounded shoreline seeking, thirst, trunk loading and occasional social splashes; snapshot-based reusable local stimuli with species-specific escape behavior. All overlays start hidden and Enter/Return reveals them; the site is now **∞ infinite jungle**. The 62.19 MiB atlas and existing cache limits remain bounded. See [elephant design](docs/ELEPHANTS.md) and [measurements](docs/PERFORMANCE.md).

These are stylized anatomical and behavioral improvements. Full skeletal/skin deformation, fluid simulation, obstacle-routing around complex shores, herd migration and durable interaction history are future work.

## Study 12: a journey into the forest

Implemented: a sparse seed-anchored opening with smoothly increasing plant and whole-family probabilities in every direction, saturating 22 tiles from the start. Existing noisy groves, little clearings, shores and social encounters provide contrast within the denser forest. The envelope is independent of camera/visit order and adds no stored per-tile data. Mature forest remains a separate benchmark case.

Sound is enabled at 60% master / 5% environment / 80% wildlife, subject to browser autoplay policy. Independent species/distant-canopy callers overlap six synthesized bird/drumming voices with varying pitch and timing, within bounded buffers/history/voices. Enter reveals one bottom toolbar; a top-right mute button is always available. See [opening design](docs/SETTINGS.md) and [audio architecture](docs/AUDIO.md). Deliberately authored discoveries and fuller ecological migration remain future ideas.

## Centralized application tuning

Implemented: documented `src/config.ts` groups startup, camera, landscape, population, opening progression, cache/rendering/UI limits and all sound controls. Reusable audio/rendering components receive options rather than importing application content. The low wobbling warble is disabled in the default bank; individual audio previews remain available for later tuning. See [configuration](docs/CONFIGURATION.md).

## Faster openings, graded terrain, elephant recordings and snakes

Implemented: the sparse envelope now spans 3–22 tiles; 32-step noisy ground gradients and matching vegetation thinning soften sand/grass/forest transitions. A retained CC0 elephant trumpet recording plays infrequently near elephant agents. Solitary boas approach real trunks and wrap/rest/unwrap; small striped snakes use loose, varied groups. Eight-heading articulated rigs share the existing atlas, including painter-ordered front/back coils. World/agent schemas are 10/8. See [snake design](docs/SNAKES.md) and [sound provenance](assets/source/audio/provenance.json).

Future: detailed branch geometry, anatomical snake contact/path solving, cross-chunk migration and durable history. Sleeping cached animals still resume; expired chunks regenerate initial populations.

## Living clearings and connected waterways

Implemented: canopy-biased whole-group generation makes thin woodland livelier and dense cover more favorable to wolves/jaguars/boar. Five new classes add solitary squirrels with real tree supports, non-contact boar dashes and independently fleeing deer, bank-foraging beavers, basking/swimming crocodiles and hopping toads. Seeded connected pond/stream geometry shares terrain contours with habitat rules; varied downstream flow carries foam and branches. One shared atlas still fits below 64 MiB using full-resolution artwork and one-pixel transparent gutters. World/agent schemas are 11/9. See [river design and limits](docs/RIVERS.md).

Future: downhill hydrology, erosion, dam building, debris collisions and durable cross-chunk animal migration. The implemented cached-sleep/expired-regeneration semantics are unchanged; there is no automatic persistence.

## Study 15 · shared landscape artwork

Implemented: 20 ImageGen structural group variants, shared rooted loops, configurable leaf masks, multi-tile grass/water and grove ownership, explicit tree supports and per-root painter ordering. One clock replaces many plant/water objects; source art stays out of the browser bundle and the single atlas remains below 64 MiB. Narrow streams have feathered mud and wet vegetation, fish schools skip small ponds, mobile sound starts muted, and only navigation temporarily suppresses drift. World/agent schemas are 12/10. See [landscape patches](docs/LANDSCAPE-PATCHES.md).

Future: arbitrary view rotation, reconstructed 3D canopies, connected branch geometry, worker-based generation and durable offscreen ecological history. The current structural views and semantic masks do not claim those capabilities.

## Study 16 · connected landscape arrangements

Implemented: one compound landscape per 16-tile ownership area, with overlapping border vegetation and no standalone plants in the streamed world. A warped staggered pattern and correlated habitat/stand fields join compatible pieces into larger surfaces. Bushes adjoin, grove soil is subdued, grass skirts bridge edges, and aquatic plants form colonies. Shared components retain individual trunk depth, land checks, deterministic neighbor clearance and animal supports without independent simulation clocks. The generated sources and atlas are reused, so larger arrangements add no texture pages or per-chunk images. Occasional smoothly graded glades preserve dense stands, and display-time rooted wind replaces coarse landscape pose steps. World/agent schemas are 15/12. See [arrangement design](docs/LANDSCAPE-PATCHES.md).

These are compound sprites assembled from shared generated art, not unique baked images for every visited chunk. Arbitrary camera rotation and reconstructed 3D branch geometry remain future work.


## Recurring variety and bear families

Implemented: independent world-space open, flower, fruit and wet-region fields continue beyond the seed-anchored opening. Sixteen new retained ImageGen variants provide colorful groves, fruit/vines, wildflower carpets and muddy gaps inside compound arrangements. Canopy bird candidates are increased, crown perches are registered per trunk, and ecological placement uses per-species RNG. Type 58 black bears forage alone or in mother–cub families, with waiting/following behavior and an authored directional rig. World/agent schemas are 15/12; the single atlas remains below 64 MiB. Sleeping agents resume, expired populations regenerate; migration, persistent ecology, bear reproduction and hibernation remain future work. See [regional variety](docs/REGIONAL-VARIETY.md).

## Liveliness after landscape consolidation

Implemented: stronger continuous tree sway, registered crown ripples on a bounded subset, moving flower heads/stems and grass above stationary soil. CPU feedback gradually reduces optional ripples under load; all broad breeze motion remains. Rendering uses available animation callbacks, while simulation retains fixed 60 Hz and interpolation. No per-leaf simulation, new texture pages, changing plant populations or schema changes are involved. GPU-based budgeting and asynchronous chunk generation remain future work. See [landscape motion](docs/LANDSCAPE-PATCHES.md).

Current sound, input, bears/zebras, giraffe proportions, elephant sampling, shared landscape accents and schema 18/14 are documented in [wildlife refinements](docs/WILDLIFE-REFINEMENTS.md).

Implemented: 25% faster drift and larger bears; sixteen shared flower/shrub overlays at varied sizes; quiet ground rest for deer, zebras, jaguars and bears; occasional zebra runs; complementary hunter/prey population ranges and prey-owned escape; rare circling hawks with fixed missed dives and ground-scavenging vultures with return flights. State is exactly checkpointed under world 18 / agent 14. Durable migration, real predation, reproduction and carcass creation remain future work.

Implemented: fourteen-phase local leaf/petal rustle for all sixteen accent forms, quieter vulture/seagull populations, and occasional bounded canopy-bird river crossings to actual dry perches. Root pixels stay fixed; atlas size stays below 64 MiB with no extra per-instance textures. Birds remain owned by their originating chunks; persistent migration remains future work.

## Rare volcanic landmarks

Implemented: widely separated seeded multi-tile volcanoes with four generated forms, shared ash/vegetation scars, short permanently filled lava rivers with registered outlets, irregular banks, pooled ends and cooling crust; three-times-resolution mountains with source-registered moving fire pixels, travelling heat and small slope/river smoke wisps, continuous mouth smoke and occasional explosive visual spurts. Movement avoids the inner ash bed and hot lava; a bounded pre-update nomination invites one nearby walker toward the pool roughly every 10–20 seconds, while ordinary animals keep avoiding it. Actual lava contact causes a brief stationary flame flash, a larger smoke puff and ash; feathered crust and scattered ash soften the river banks. Replacement records wait for clear off-screen resident ground, preserve family links and return toward their original home belt. World/agent schemas are 21/17; one atlas remains capped at 64 MiB. Sleeping lifecycles resume; expired chunks regenerate their initial populations. See [volcano design](docs/VOLCANOES.md).

Future: fluid hydrology, lava/water interactions, permanent lava terrain edits, durable mortality/history and actual cross-chunk ecological migration. Explosive clasts are currently visual; ground channels own contact damage. Off-screen replacement is bounded by the active region and may wait while the whole ring is visible.

## Rare spacecraft encounters

Implemented: three rare chunk-owned spacecraft with distinct articulated alien crews, bounded clear-dry-ground landing search, moving-occupant touchdown aborts, changing repeat landing positions, staggered exits, 15–30-second investigation and complete boarding before departure. Separate per-agent RNG and binary crew ownership preserve exact sleeping/checkpoint continuation under world 22 / agent 18. Retained generated reference art and authored rigs bake offline into the same bounded atlas. U finds an actual clearing and stops drift for watching. Shift+U cycles through the three designs and calls or focuses the selected ship without replacing other crews. Detailed hulls have baked spin/bank and beacon frames, tiny grounded motor vibration, a whistling flight hum and exploratory chatter. Registered sprite pieces share unchanged pixels across frames within the atlas budget. Expired encounters regenerate their initial population; durable visit history, off-screen simulation, migration, missions and alien interactions with wildlife remain future work. See [spacecraft design](docs/SPACECRAFT.md).

## Implemented: zen sanctuaries and artifact likelihoods

Rare terrain-integrated pagodas now combine separate generated trees, shared flowers, baked temple/lotus/resident rigs, deterministic monk routines and pond-specific fish/bird behavior. H/five-touch-tap controls edit grouped generation multipliers and rebuild the same seed. Sleeping owners resume; expired sites regenerate. Durable migration/history and automatic browser persistence remain unimplemented. See [design, budgets and validation](docs/ZEN.md).
