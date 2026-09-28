# Directional life: models at build time, pixels at runtime

Research and implementation · 26 September 2026 · Study 06

## Decision

Use a small articulated 3D source model for animals and bake its poses through an orthographic camera into a conventional 2D atlas. Keep generated bitmap art for plants, with continuous deformation for gentle wind. The browser remains a small, dependency-free sprite renderer.

This resolves the sideways deer at its source: the original implementation moved toward arbitrary world-space targets but only had one right-facing view and a mirror. More walking frames of that same view would still slide sideways. The simulation now has a continuous heading; the atlas contains corresponding front, back and oblique views; movement follows heading rather than independently translating a billboard.

## What was explored

| Option | Strength | Limitation / decision |
| --- | --- | --- |
| Generate a much larger directional 2D sheet | Fast way to explore a visual style | Every heading and action must keep anatomy, proportions and foot registration consistent. Original sheets already had pose variation. Useful for references; avoid making hundreds of independent generated frames the source of truth. |
| Generate an image and reconstruct a mesh | Can create a useful sculptural starting point | A reconstructed mesh does not by itself specify deer leg joints, gait, turning or a clean deformation rig. The hidden side is inferred. Treat generated geometry as a candidate for cleanup and rigging. |
| Artist-authored Blender/glTF animal rig | Best longer-term control over anatomy, topology and motion | Requires a model-authoring toolchain and an importer/baker. The rig can later replace our pose producer while preserving the runtime atlas contract. |
| Small procedural articulated model | Repeatable anatomy, camera, lighting and poses; works entirely on Node | Less art detail than an artist's sculpt, and no general skinned-mesh importer. Chosen for this iteration because it demonstrates the full direction/turn/gait pipeline without adding a heavyweight toolchain. |
| Real-time 3D animals over 2D terrain | Arbitrary views and continuous skeletal blending | Adds another runtime rendering/depth/asset path. The camera is fixed and sprites are small, so baking gives sufficient flexibility now. Revisit for freely rotating cameras or hundreds of distinct animated models. |

The available image generation tool produces raster images; it is not a mesh or rig exporter. We did not claim to reconstruct the new model from the previous sprite sheet: it is authored geometry, with the original spotted deer as an art reference.

[TRELLIS](https://github.com/microsoft/TRELLIS) supports image/text-conditioned 3D outputs, including meshes. Its documented original installation uses Linux, CUDA and an NVIDIA GPU with at least 16 GB VRAM. Its multi-image conditioning is an inference technique with stated quality caveats. Those capabilities are useful to explore later, but are not part of this project's local build.

[TripoSR](https://github.com/VAST-AI-Research/TripoSR) reconstructs an object from one image, while [TripoSG](https://github.com/VAST-AI-Research/TripoSG) outputs meshes from images and documents CUDA GPU requirements. Our assessment is that their geometry-generation capability is separate from the topology cleanup, rigging and species-specific animation needed here. We researched these projects; we did not run their models or benchmark their output.

[Three.js's animation documentation](https://threejs.org/manual/pages/animation-system.html) distinguishes skinned bones, morph targets, transforms and animation clips. That is the useful boundary to retain: a pose source evaluates an action at a time, independently of the renderer that displays it. Three.js is not installed or shipped by this implementation.

## Implemented model and camera

- [`scripts/art/deer-model.ts`](../scripts/art/deer-model.ts) produces an articulated triangle mesh for an action and normalized phase. The model includes body, neck/head, muzzle, ears, eyes, tail, spots, and two segments plus a hoof per leg.
- [`src/iso/bake/mesh.ts`](../src/iso/bake/mesh.ts) provides generic primitive assembly and OBJ export.
- [`src/iso/bake/rasterize.ts`](../src/iso/bake/rasterize.ts) uses a CPU z-buffer, interpolated normals, quantized lighting and a one-pixel silhouette. It returns an RGBA image; no Blender install, browser, native Canvas or GPU is needed.
- The orthographic ground projection is exactly 2:1, matching the terrain. Positive model X is forward. The model rotates by world heading around Z; the camera and light stay fixed.
- Bake resolution is 72 × 72 before union trimming, with ground origin at (36,55), scale 28 and sixteen headings. The same root anchor is preserved after trimming.
- [`assets/models/deer.obj`](../assets/models/deer.obj) is a real standing mesh, including vertex colors. OBJ is an inspection/export artifact, **not a rigged animation file**. The editable animation source is the TypeScript pose generator. Some OBJ viewers may ignore the vertex-color extension.

Run `npm run assets:preview` to produce `artifacts/deer-directions.png`: rows are look, graze, walk, turn, run and raise; columns rotate around the animal. It also produces `artifacts/deer-walk-strip.png`, 24 successive steps at four representative headings, plus `artifacts/deer-run-strip.png` for the running gait. Inspect these before tuning behavior in the full clearing.

## Turning and walking

`graze → raise → look → turn → walk/run → lower → graze`

The deer chooses nearby dry ground with a clear sampled line to its destination. In `turn`, it takes the shortest angular route at a bounded angular speed. Its world position is fixed while the body and small stepping poses rotate. Only after alignment does it start walking. Moving animals steer through bounded heading changes and reduce forward cruise speed while poorly aligned; the explicit initial `turn` remains planted.

While walking, velocity is `(cos(heading), sin(heading)) × speed`. Gait phase advances by actual distance divided by `DEER_STRIDE`; each animal owns a seeded pace multiplier, RNG and per-trip variation. A jerk-limited speed motor rounds acceleration and stopping-distance braking. The nominal 1.05-tile/second run uses 2.33 full strides/second, fixing the previous 0.94-cycle/second slow-motion effect. See [agent library](AGENTS-LIBRARY.md) for class, environmental-response and binary-state contracts. Rain increases speed and therefore animation speed together. A blocked step does not advance the stride. This avoids playing a fast walk while the body barely moves or keeps moving sideways.

The four feet have staggered stance/swing intervals. At least two remain on the ground, and each planted foot moves backward in local model coordinates while the body advances. The 0.125-tile stride is calibrated to the model's 0.38-unit foot excursion, 66% stance fraction, bake scale, isometric projection and display scale. Change these together to avoid renewed foot sliding.

| Clip | Frames per heading | Purpose |
| --- | --- | --- |
| Walk | 24 | Four-beat stride, driven by distance |
| Run | 20 | Paired hind/front footfalls, suspension and body rise |
| Graze | 16 | Lowered head, mild chewing/ear motion |
| Look | 12 | Raised head and ear motion |
| Turn | 12 | Small in-place foot movements during rotation |
| Raise | 12 | Eased head/neck transition; reused in reverse for lowering |

Sixteen headings × 96 frames = **1,536 deer frames**. Direction quantization still has at most 11.25 degrees of world-heading error. The model is deliberately stylized; it is not an anatomically complete IK or muscle simulation.

Head transitions take 0.7 seconds, with endpoints included in the bake. Walking swing feet use eased recovery while stance feet move backward uniformly. A run uses a shorter 36% stance, paired hind/front timing, higher hoof clearance and a suspension phase. Its 0.45-tile stride matches the 0.75-model-unit excursion and camera/display scale. Unprompted runs are now rarer (6% of journeys, 2.5% at dusk); family catch-up and nearby predators can request faster travel. Targets still require a dry, trunk-free segment. The streamed world generates sparse families with serialized leader/parent links and fawns; see [wildlife design](WILDLIFE.md).

Position, heading and stride phase interpolate between fixed simulation steps. This smooths travel on high-refresh displays without changing physics or consuming different random values. It does not blend neighboring sprite images or remove the deliberate pixel steps in the baked artwork.

## Smoother vegetation

Each of the eight plant/tree variants now has **32 frames** in a cyclic wind field. A single reviewed generated source pose per variant is registered once at bake resolution, with a smooth displacement mask that decays to zero toward the lower trunk/root. The output uses nearest-neighbor sampling, not blurry crossfades. The final-to-first frame follows the same periodic function as all neighboring frames.

This avoids interpolating unrelated silhouettes from the initial four generated poses. Lower tree trunks and roots remain exact copies; on the mushroom rock only the top section moves. Playback is roughly 19–25 poses per second in sun and 26–34 in rain, with individual phase/rate offsets. The loop lasts about 1.3–1.7 seconds in sun. Each plant now owns an integrated phase and eased wind-response rate, so weather changes alter speed without jumping to an unrelated pose. Species definitions and local moisture also affect response/vigor. The runtime selects an atlas frame and adds continuous rooted quad sway; it performs no per-pixel image deformation.

## Costs and modest optimizations

Historical comparison (Study 01/02), recorded on this development Mac:

| Measure | Study 01 | Study 02 |
| --- | ---: | ---: |
| Tiles / deer | 4 / 3 | 8 / 5 |
| Atlas frames | 62 | 666 |
| Texture allocation | 1024 × 1024, 4 MiB RGBA | 2048 × 1452, 11.34 MiB RGBA |
| Compressed PNG | approximately 452 KiB | approximately 782 KiB |
| WebGL draw calls per scene frame | 1 | 1 |

The Study 02 clean bake was approximately 0.9 seconds locally; Study 03 takes about 2.6 seconds. A normal build fingerprints source images, geometry/bake code, relevant constants and lockfile, then validates output hashes before reusing them. Generated files that are missing or modified force a rebuild. `npm run assets -- --force` bypasses the cache.

The packer trims the **union** of each clip, preserving registration, and shares byte-identical frames. It uses stable best-fit shelves and one-pixel transparent gutters, without rotation or mipmaps. Study 04 used 1,866 frames at 26.06 MiB decoded. Study 05 had 3,854 logical frames, including three new animal rigs and twelve new structural tree forms. Atlas allocation stays below an explicit 4096 × 4096 / 64 MiB budget; exceeding it fails with an actionable message rather than silently growing memory.

Study 03 adds fixed-step presentation interpolation, native-resolution positioning, cached static scene data and spatial culling/collision. See [performance measurements](PERFORMANCE.md). Other runtime optimizations remain: no per-vertex temporary arrays, retained CPU/GPU vertex capacity, bufferSubData uploads, cached uniform locations, full-rectangle culling, and ResizeObserver instead of per-frame layout reads. No workers, ECS, compression format, multi-page batching or live 3D dependency has been introduced.

## Next model pipeline extension

For a tiger, first add a species pose producer with distinct rest, look, stalk, walk and sprint actions, then bake through the same camera/packer. For a higher-quality artist rig, add a **build-only** glTF/Blender adapter that evaluates skinned vertices into the `Mesh` contract. Keep stable clip names, heading conventions, root anchors and stride metadata. A new runtime renderer should not be necessary just to improve the model.

## Study 05 species rigs

`scripts/art/wildlife-model.ts` authors three distinct articulated meshes. Toucan clips use 8 resting and 16 flapping poses per heading; orangutan uses 8 resting, 16 traveling and 12 climbing poses; jaguar uses 8 resting, 16 walking and 16 chasing poses. The new camera is 80×80, root (40,65), scale 28, with the same 2:1 projection and sixteen headings. Gait is distance-driven for ground animals; wing and climbing cycles use species cadence. Rest poses contain subtle breathing/feather motion. Instances vary size and use one of three discrete warm coat tints; deer juveniles are roughly 57–67% adult size. Fawn stride length scales with body size. See [WILDLIFE.md](WILDLIFE.md) for behavior, model limits and verification.

## Study 06 habitat motion

Eleven new articulated models bake eight or sixteen directions, with 8-frame rests, 16-frame travel/swing loops and 12-frame whale swim/surface loops. Monkey swing phase follows its eased route; flying birds use species-specific wing cadence; ground animals/fish advance phase by actual distance and body-scaled stride. Whale breathing has a serialized long-period clock, smooth opacity/height and a brief procedural blow. These clocks interpolate through the existing fixed-step presentation layer. Models, habitat decisions and codecs are documented in [wildlife](WILDLIFE.md). The Study 06 atlas had 7,374 logical frames at 57.38 MiB decoded.

## Study 08 botanical motion

Plant wind retains 32 registered phases per structural form. Small continuous rooted shear adds a coherent gust while individual phases keep leaf motion varied. Four procedural liana clips fix their canopy attachments while their tips sway. No crossfade blur or independently generated animation poses were introduced. See [forest composition](FOREST.md) for placement, appearance and the current atlas inventory.

## Study 09 species rhythm

Flight cadence is now driven by the serializable `FlightMotion` component, with variable powered ascent and level-wing gliding. Monkey travel/climb/swing are separate clips, with a fixed model-space grip for the runtime support vine. See [animal motion](ANIMAL-MOTION.md) for phase, geometry, rate and checkpoint contracts.

## Study 10 registered foliage and running packs

The wind baker now resamples each source painting **once** into a registered pixel image, then shifts its existing leaf rows through 32 phases. The mask starts at the actual crown, fades to zero before the root, and never invents new leaf colors by repeatedly sampling different source subpixels. Small horizontal rustles retain pixel texture; continuous phase-driven rooted shear supplies the broader canopy sway at display cadence. This reduces the previous texture boiling without blurred crossfades. Discrete pixel/heading changes remain intentional.

Wolf running adds 320 authored directional frames; jaguar free runs reuse the chase clip. Packing now fills gaps in earlier shelves before opening another row. Together with increased exact foliage-frame sharing, the final atlas is smaller despite the additional action. See [motion](ANIMAL-MOTION.md) and [performance](PERFORMANCE.md).

## Study 11 elephant poses

Elephants have 16 headings × (8 rest + 20 walk + 24 drink + 16 spray) frames. Walk phase follows distance with a 0.175-tile stride at nominal 0.12 tiles/second; body scale also scales stride. The long four-beat stance gives deliberate weight instead of fast cycling feet. Drink/spray phases are normalized one-shot actions with inclusive endpoints; interpolation resets on state changes so an idle loop cannot jump into a later water pose.

The shared cubic trunk curve dips to water, curls toward the mouth, or raises for a short spray. Ear flaps, tail motion and small trunk sway accompany the rebuilt body. Geometry and runtime effect registration are documented in [ELEPHANTS.md](ELEPHANTS.md).

Five woodland/river rigs and the denser packing contract are documented in [RIVERS.md](RIVERS.md). Their authored mesh sources, OBJ exports and build dependencies are retained.

Study 15 adds shared multi-tile landscape groups, tint masks and static trunk templates. Current world/agent schemas are **15/12**; see [landscape groups](LANDSCAPE-PATCHES.md) for source provenance, animation, navigation and memory details.


Compound landscape wind now uses continuous root-anchored shear at presentation cadence. One registered pose replaces the former four-pose, two-FPS loop; paired wood/leaf masks stay aligned, every trunk foot remains fixed, and water plants sway gently. Legacy finite-fixture foliage retains its existing 32-frame loops. See [landscape groups](LANDSCAPE-PATCHES.md).

Recurring colorful regions, canopy population/perch changes, new generated source provenance and black bear type 58 behavior/rig/codecs are documented in [regional variety](REGIONAL-VARIETY.md). Current world/agent schemas are **15/12**.
