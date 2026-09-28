# Jungle contributor guide

## Intent and scope

This is an art project: a colorful, gently animated isometric pixel jungle, intended to grow into an infinite scrolling world. The current demo streams an unlimited procedural world through a bounded active region and compact chunk cache. A finite 16-tile fixture remains for regression tests. Preserve the visual character, keyboard exploration, and deterministic reproduction of scenes.

## Architecture

- TypeScript; Canvas and WebGL; minimize external libraries. Runtime is currently dependency-free.
- `src/iso/` is a reusable component. It must never import jungle-specific modules.
- Math, simulation, scene composition and the memory renderer must run on Node without DOM globals or browser shims.
- `src/agents/` owns generic agent/motion/serialization contracts; `src/streaming/` owns generic bounded caching/statistics. Neither may import jungle content. `src/jungle/` owns climate, terrain, species and world orchestration. `src/main.ts` owns browser input/loading/lifecycle.
- Keep simulation, presentation and generated assets separate. Draw ordering uses ground anchors; transparent objects cannot be reordered for batching.
- Inject time and seeded randomness. Don't use `Date.now()` or `Math.random()` in simulation or terrain generation.
- Preserve global coordinate continuity at tile/chunk edges. Test negative coordinates when extending the world.
- The site is static. Optional future servers should be adapters, not dependencies of the renderer.

## Workflow

```sh
npm ci
npm run check
npm run serve
```

`check` rebuilds assets, typechecks, builds the site, runs headless tests and writes inspectable snapshots. Prefer headless simulation/pixel tests for most changes. Use a browser only for browser boundaries and visual QA; do not claim UI behavior is verified from software snapshots alone.

For visual changes, inspect `artifacts/*.png` and the running site. For rendering/input changes, check WebGL plus `?renderer=canvas`, keyboard/menu controls, and mobile layout. Keep error messages actionable. Do not silently suppress missing sprite/asset errors.

## Coding Style

- I like my code to be human readable. Comment important things like interfaces, globals, constants, funct
ion declarations etc. lightly. Complex or long function bodies should be better commented. Generally, I sh
ould be able to look at the code and figure out what's going on.

- In general, try to write code that is decoupled, cohesive, and testable. Try and minimize duplication an
d build and maintain reusable components.

## Assets and documentation

- Read `docs/ASSETS.md` and `docs/ANIMATION.md` before adding sprites. Use image generation for new organic bitmap artwork; for directional animals, prefer an articulated model baked to sprite frames. Preserve generated source art as reference.
- Retain source PNGs, exact prompts and provenance. Never require live generation for normal builds.
- The offline baker is `src/iso/bake/`; it must remain outside the browser bundle. Pose generators belong in `scripts/art/`. Update the deterministic atlas pipeline and manifest together. Keep frame anchors stable and transparent gutters between frames.
- Use nearest-neighbor resampling for pixel art. Don't independently trim animation frames or smear edges with interpolation.
- Update README for user-visible controls; detailed design/testing notes belong in `docs/` and must be linked from README.
- Keep `STRATEGY.md` explicit about implemented behavior versus future plans. Describe the implemented streaming semantics honestly: sleeping cached agents resume; expired chunks regenerate initial populations. No durable migration/history or automatic persistence is implemented.
- Don't introduce generic random movement for new animals: model species-specific states and environmental responses.

No license has been selected for the project's original source/art yet. Don't add third-party assets without explicit provenance and compatible terms.

## Directional animation invariants

- Heading is a world-space angle, +X = 0; the baker uses the same isometric projection. Never mirror one side view across arbitrary travel headings.
- Turn before translating. Stride phase advances by distance, and blocked animals must not keep sliding or cycling walking feet.
- Keep roots fixed in wind loops. Trim all frames of a clip using their union bounds and shift its anchor once; never trim poses independently.
- The atlas uses content-addressed caching, exact frame deduplication, and a 4096 × 4096 budget (64 MiB maximum decoded). Include new asset-build dependencies in the fingerprint and test cache invalidation.
- Retain one transparent painter-ordered batch; do not reorder sprites by material. Test the allocation-free quad writer if the vertex contract changes.

## Motion and scale

- Use fixed 60 Hz simulation plus `FixedClock.alpha` for presentation. Preserve previous samples and unwrapped gait phase; do not round projected positions before rendering.
- Deer pace is individual and trip-dependent. Walk/run stride lengths must agree with the baked stance distance. Bound acceleration and use arrival braking; raise/lower the head with registered transition clips.
- Static layout edits must call `invalidateLayout(world)`; animation and camera changes must not rebuild spatial indices.
- Run `npm run benchmark` for scale-sensitive changes. It excludes actual rendering/GPU work. Check wide zoom, Shift travel and landscape jumps in the browser too, and report device-specific observations honestly.
- Texture size and draw count are separate budgets. More instances must share the atlas; do not duplicate assets per actor. Keep build caches and source provenance current.

## Agents and streaming

- Read `docs/AGENTS-LIBRARY.md` and `docs/STREAMING.md` before adding species or changing chunk lifecycle.
- Every artifact species has a class with owned state and a stable binary type ID. Sprite frames/definitions remain shared immutable data, not classes per frame.
- Use per-agent serializable RNG. Neighbor perception snapshots precede updates. Add no wall-clock/random global dependency inside behavior.
- Use registry codecs, not object spreads or JSON, to clone/save behavior. Preserve motor, RNG and prior presentation samples. Test exact continuation.
- Terrain border heights and fields must agree at negative chunk boundaries. Terrain and actor ground height must use the same triangle split.
- Chunk caches must enforce byte/count/distance limits, with active records pinned. No unbounded visited-coordinate sets, stale agent collections or per-tile textures.
- World checkpoint creation must flush active state before encoding. Version binary layouts and generator changes; reject incompatible/truncated data.
- Default cold-cache policy is 4 MiB accounted / 256 chunks / 12-chunk distance; active requests cap at 144 chunks. Record memory allowances explicitly and label GB as estimated, not browser total RAM.
- `DrawCommand.corners` follows UV order 00,10,01,11 and triangles 0,1,2 / 2,1,3. Keep Memory, Canvas and GL contracts aligned.

## Wildlife and full-screen presentation

- Read `docs/WILDLIFE.md` before changing social behavior, spawning, perch height or new rigs. Keep species-specific social structures: deer families, small toucan flocks, solitary/mother–young orangutans, solitary jaguars.
- Preserve sparse populations and parent IDs through sleeping/checkpoints; never spawn jaguar herds. Keep brief non-contact pursuits and recovery.
- Body scale must also scale stride length. Validate model margins in every heading/action and inspect species contact sheets.
- New generated tree forms live in `assets/source/tree-forms.png`; exact prompt is in `assets/prompts.json`. Forms are structural variants, not animation poses. Keep rooted wind motion and shared terrain-following litter decals.
- The scene fills the screen; all tools belong in the bottom overlay. Check mobile safe area, guide scrolling and drag/input behavior.
- Current jungle agent schema is 12; world checkpoint schema is 15. Old records fail explicitly.

- New species specifications live in `src/jungle/ecology.ts`; each has its own class, habitat rules, shared immutable sprites and an exact continuation test. Keep coastal animals on rendered shoreline materials, fish schools cohesive, and whales rare/deep-water only.
- Trees should cluster by species/form and mostly stand upright. Preserve subtle, sparse root litter; avoid large opaque mud disks.

## Settings, contours and audio

- Read `docs/SETTINGS.md` and `docs/AUDIO.md` before altering generator controls, shoreline geometry or sound. Preserve jungle-heavy defaults and the increased 2.5× animal population unless instructed otherwise.
- Terrain fields, contour crossings and animal habitat checks must agree at positive/negative boundaries. `uvCorners` must work identically in Memory, Canvas and GL; degenerate triangles are intentional.
- Settings regenerate the same seed and reset scrollback; checkpoint the normalized values. Terrain chunks are now 986 bytes.
- `src/audio/` core must run without a browser. Sound is enabled by default; attempt startup and retry on a gesture if autoplay is blocked; keep smooth ramps, bounded voices/history, shared PCM, pause/visibility muting and disposal. Audio never drives simulation RNG.
- Original procedural audio needs no third-party license. Add provenance for any future recording. `npm run audio:preview` exports audition files.

## Botanical variety

- Read `docs/FOREST.md` before changing forest placement, plant morphology or vines. Keep mostly upright species stands while varying individuals, and preserve the cross-chunk tree spacing guarantee.
- `assets/source/forest-forms.png` has reviewed unequal row gutters, recorded in the baker and exact prompt provenance. Do not assume a square grid. Use `npm run plants:preview` to check full silhouettes, floating fragments and roots.
- `rootedQuad()` mirrors the anchor as well as the image. Keep Memory/Canvas/WebGL equivalent; Canvas uses an affine fast path for these quads.
- Plant genotypes add two bytes per plant. Vines are shared baked visual components of tree agents; avoid per-leaf runtime objects. Current world/agent schemas are 15/12.

## Animal motion invariants

- Read `docs/ANIMAL-MOTION.md` before modifying flight or monkey behavior. Swings are rare, at most 0.2 tiles from an actual tree, with fixed-length visible support reaching the baked hand anchor. Preserve ground/tree residence and long cooldowns.
- Birds use `FlightMotion` to change cadence, powered/glide timing and lift; glides hold the level-wing pose at a whole cycle boundary. Ground strides remain distance-driven. Serialize controller/trip state exactly.
- Crabs are disabled: keep type ID 44 reserved, omit them from `ECO_KINDS`, menus, generation and runtime atlas. Gray stone terrain is no longer generated; hill fields only affect elevation.

## Packs and performance

- Wolf leaders must consider stragglers; followers refresh targets during travel and cubs retain parent-relative scale and IDs. Wolves do not hunt. Jaguar `run` is separate from `chase` behavior but shares its baked artwork.
- Keep wolf strides matched to the authored 36% run stance / 0.78-unit excursion. Body size scales stride, not just the sprite.
- Register foliage pixels once before wind warping; roots and leaf texture must remain stable. Do not reintroduce per-frame high-resolution source resampling.
- Uniform terrain shortcuts must match interpolated fields. Dry shore and inland scrub are a union of separate regions: equally labeled vertices alone do not prove a uniformly dry interior.
- Zoom limits are 65–250%. The guide exposes per-stage p95 timings; CPU submission is not GPU completion. Retain the atlas/cache budgets when optimizing.

## Elephants and unobstructed presentation

- Read `docs/ELEPHANTS.md` before modifying the elephant rig or water behavior. Bake shared `elephant-pose.ts` geometry; rendered spray must begin at the selected sprite's trunk tip, including quantized heading/phase.
- Fill the trunk at reachable water before drinking or spraying. Keep feet on valid ground, water searches bounded and behavior state exactly serializable. Do not make all animals permanently flee water.
- Local stimuli belong in the pre-update neighbor snapshot. Responses own their cooldown and use species habitat/clearance rules; never mutate another agent directly.
- The bottom menu and panels start hidden; Enter/Return toggles them, including from focused controls. The top-right mute button stays visible. Preserve an actionable visible error if loading fails. Keep canvas exploration usable while overlays are hidden.

## Opening, chorus and compact controls

- `journeyDensity()` is a pure world-space multiplier around `InfiniteWorld.origin`, found once from seed/settings. Never tie density to the moving camera, elapsed time or chunk visit order. The 3–22-tile transition scales plant placement and whole animal groups; keep sparse openings and dense-world benchmark coverage.
- Keep the bottom toolbar limited to Settings, Pause/Resume, Zoom and Help. Presets, regrowth, exploration and weather remain keyboard commands; there is no logo, compass or weather overlay.
- Audio defaults are enabled, master 60%, environment 5%, wildlife 80%. Respect autoplay blocking and explicit mute; a gesture must never undo mute. Suspended/hidden/paused audio must not queue effect bursts.
- Bird callers have independent pitch/timing; the distant canopy chorus owns exactly three callers. Keep nearby history <=32, overlapping Web Audio effects <=12 and shared PCM <10 MiB. Original synthesis must remain independent of simulation RNG.

## Central defaults

- `src/config.ts` owns application defaults. Keep units/effects documented and wire each new knob into its consumer. Reusable libraries receive options instead of importing app config; generic library fallback values are separate from app defaults.
- All sound entries share `SoundTuning`; honor enabled/gain/speed in the browser and chorus preview, and synthesis controls in both. The low wobbling warble stays disabled unless requested.
- Preserve the 60 Hz/geometry/codec invariants; they are not arbitrary UI settings. See `docs/CONFIGURATION.md` for rebuilds, override precedence and checkpoint compatibility.

## Graded terrain and snakes

- Opening density spans 3–22 tiles. Shared noisy terrain gradients and vegetation thinning must stay continuous across signed chunk borders. Keep habitat water checks tied to the physical lake field; the wet-sand color transition may straddle it.
- Read `docs/SNAKES.md` before changing snakes. Types 51/52 are boa/smallSnake; boas remain solitary, smaller snakes form loose groups. Wrap only around real supports; retain front/back painter ordering and exact support state. Distance drives travel waves and blocked animals stop.
- Elephant audio is a retained CC0 recording. Keep source, license, conversion and hashes in `assets/source/audio/provenance.json`; normal builds stay offline. Apply mute/pause/suspension and the existing voice/history budgets.

## Woodland and river extension

- Read `docs/RIVERS.md` before changing stream geometry or types 53–57. Canopy biases whole groups; opening animal density is now 85% before species bias, while plants remain at 24%.
- Rivers carve the shared water field; keep centerline connectivity and signed seam checks. Memoized geometry is capped at 128 reaches. Debris/foam use injected world time and stay on rendered water.
- New species remain solitary; squirrels climb real supports, boar charges stay brief/non-contact, and bank animals use water/bank habitat. Preserve exact continuation in world 11 / agent 9.
- The nearest-neighbor atlas now uses one-pixel transparent gutters, with a full pixel regression. Do not introduce filtering/mipmaps without revisiting that contract.

## Landscape groups

- Read `docs/LANDSCAPE-PATCHES.md` before changing shared patch art, masks or support templates. Preserve `GROVE_ROOTS` registration and per-root depth/ground height. Low vegetation is traversable.
- New source sheets and exact prompts are retained; shared palette masks tint leaves without tinting wood. Never add per-instance textures.
- Compound arrangements own 16 tiles plus porous overlap; temporary planning maps are discarded after generation. Do not reintroduce standalone plant placements. Preserve deterministic halo clearance, including negative borders. Current world/agent schemas are 15/12.
- Only navigation delays auto-scroll; taps/menu/sound changes do not. Sound starts muted on mobile. Fish schools require substantial water; small ponds are excluded.

- Read `docs/REGIONAL-VARIETY.md` before changing regional vegetation/water, canopy populations or black bears. Keep ecological placement streams species-local; black bears (type 58) are solitary or mother–cub families, with foraging, parent-following and mother waiting. Color accents remain components of compound landscapes, not single-tile agents.
