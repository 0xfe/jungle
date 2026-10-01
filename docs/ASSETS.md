# Asset sources and reproducible baking

The runtime uses one transparent atlas. Its source material now combines generated plant artwork, procedural articulated animal models, and procedural terrain. Normal builds need neither image generation nor Blender, a browser or a GPU.

## Inventory and provenance

| Source | Role in the current build |
| --- | --- |
| [`assets/source/trees.png`](../assets/source/trees.png) | Image-generated umbrella tree, palm, banana and flowering/vine tree. First registered pose per species is the source of a 32-frame wind loop. |
| [`assets/source/tree-forms.png`](../assets/source/tree-forms.png) | Study 05: twelve generated structural forms in a 3×4 grid, preserved alpha and deterministic residual key cleaning. Two retained additional forms per species, 32 rooted wind poses each; the severe-lean column remains source-only. |
| [`assets/source/forest-forms.png`](../assets/source/forest-forms.png) | Study 08: ten new structural trees and six understory forms; alpha source, reviewed unequal row gutters, component cleanup. Exact prompts: `assets/forest-prompts.json`. |
| [`assets/source/plants.png`](../assets/source/plants.png) | Image-generated bush, fern, bromeliad and mushroom rock. First registered pose per species is the source of a 32-frame wind loop. |
| [`assets/source/deer.png`](../assets/source/deer.png) | Original image-generated deer sheet, retained as an art reference. **No longer used for runtime deer.** |
| [`scripts/art/deer-model.ts`](../scripts/art/deer-model.ts) | Authored, articulated 3D deer geometry and pose functions, baked into 1,536 directional frames. |
| [`assets/models/deer.obj`](../assets/models/deer.obj) | Generated standing mesh for inspection in a 3D editor. Animation source remains TypeScript; OBJ contains no rig or clips. |
| [`scripts/art/wildlife-model.ts`](../scripts/art/wildlife-model.ts) | Articulated toucan, orangutan and jaguar geometry/poses; 16 headings; exported static meshes in `assets/models/`. |
| `scripts/prepare-assets.ts` | Procedural terrain and shore for three habitats × sixteen tiles, plus shadow masks, four mud/leaf-litter decals and 24 reusable stream-terrain surface textures. |

The three original bitmap sheets were generated on **2026-09-26 with the built-in image_gen tool**. Their exact generation and accepted correction prompts are preserved in [`assets/prompts.json`](../assets/prompts.json). Each is a reviewed 1536 × 1024, 4 × 4 grid. No third-party sprite pack is bundled. The new deer is authored geometry inspired by the original sheet, not an AI-reconstructed mesh. Study 05 adds a new image-generated tree-form sheet; its exact prompt is recorded in the same JSON. No additional image generation was needed for Studies 02, 03 or 04; existing organic artwork is reused with habitat-specific densities and species mixes.

Initial generation did not consistently honor transparency/background instructions. Accepted edits produced flat magenta chroma-key backgrounds; the pipeline removes the key and its edge contamination. The runtime atlas has real alpha. Do not mistake the magenta source sheets for runtime textures.

## Toolbar icon

The inline GitHub mark in `public/index.html` comes from [Primer Octicons v19.15.3](https://github.com/primer/octicons/blob/v19.15.3/icons/mark-github-16.svg), under the MIT license. Its path is unchanged; size and color follow the toolbar. Source URL and the full copyright/license notice ship in [`public/assets/github-ATTRIBUTION.txt`](../public/assets/github-ATTRIBUTION.txt). Normal builds require no network access.

## Build and inspect

```sh
npm run assets                 # hash-validated cache; bake when inputs changed
npm run assets -- --force      # bypass cache
npm run assets:preview         # all animal headings and per-action contact strips
npm run check                  # build, tests and whole-scene PNG/JSON snapshots
```

Generated deliverables:

- [`public/assets/jungle.png`](../public/assets/jungle.png): packed runtime texture.
- [`public/assets/jungle.json`](../public/assets/jungle.json): regions, per-clip anchors and packing statistics.
- [`assets/derived.json`](../assets/derived.json): input fingerprints, source/output SHA-256 hashes and byte sizes.
- [`assets/models/deer.obj`](../assets/models/deer.obj): standing colored triangle mesh.
- `artifacts/deer-directions.png`: six action rows × sixteen headings.
- `artifacts/deer-walk-strip.png`: 24 walking phases × four representative headings, plus a running strip.
- `artifacts/{toucan,orangutan,jaguar}-directions.png` and per-action strips: new rigs in all headings and motion phases.
- `artifacts/*.png` and matching `.json`: scene snapshots and draw lists.

No generated asset should be hand-edited. Change its source/model or bake settings and rebuild.

## Pipeline

1. Hash the source PNGs, relevant pose/terrain/packing code, animation constants and lockfile. A cache hit also verifies the PNG, JSON and model hashes; stale, missing or tampered outputs trigger regeneration.
2. Decode and chroma-key the generated foliage sheets using sharp. Validate the grid and key background. Use fixed source cells; independent per-frame trimming would destroy registration.
3. Sample a continuous periodic wind warp into **32 poses per variant**. The warp decays to zero in the lower trunk/root. Register the source once at bake resolution, then shift those existing pixels horizontally with nearest-neighbor sampling; do not resample fine source detail on each pose or crossfade unrelated images. The stone in the mushroom-rock sprite is held still below the top motion band.
4. Evaluate each animal mesh for each normalized action phase. Reuse posed geometry while baking eight or sixteen headings through the fixed 2:1 orthographic camera. The software triangle rasterizer uses a z-buffer, quantized lighting and a pixel outline.
5. Retain the sixteen connected terrain images per habitat for the finite regression fixture. Also generate six material families × four 64×64 texture variations for streaming. These opaque surface textures map onto height-aware ground triangles; the world never allocates one image per generated tile.
6. Compute each clip's **union alpha bounds**, trim every frame identically, and shift its ground anchor once. Directional clips may have different trim bounds, but their world root remains the same.
7. Share byte-identical frames, then pack stable best-fit shelves with one-pixel transparent gutters. Atlas texel (0,0) is reserved white for solid-color quads. The 4096 × 4096 allocation budget fails explicitly if exceeded.
8. Encode the PNG, JSON manifest, static OBJs and provenance hashes. All 3D and image deformation work ends here; the application only selects sprite frames.

There are currently **11,345 logical frames / 9,616 unique frames**:

- Deer 1,536; original toucan/orangutan/jaguar 1,600.
- Active ecological animals 5,440: eight species use 16 headings, fish/parakeet use 8. Monkey adds walking/climbing clips; four bird species use 24-phase flight clips. Wolves add 320 run frames. Elephants use 1,088 frames across rest, walking, drinking and spraying. Crab is omitted.
- Vegetation 1,152: 22 tree forms × 32, ten understory forms × 32 and four procedural vine patterns × 32.
- Shared landscape masks/loops 160; feathered river-mud texture 1.
- Legacy terrain 48; legacy shared surfaces 24; new ground-gradient textures 66; litter 4; shadows 2.
- Woodland/river animals 928 frames: squirrels, boar, beavers, crocodiles and toads at eight headings.
- Snakes 384 frames: two eight-heading rigs, with front/back boa wrap and held-coil sprites.

The atlas is **4096 × 3980 / 62.19 MiB decoded**, inside the unchanged 4096×4096 / 64 MiB cap. Small rigs use 112×112 bake canvases and species-specific camera scale. Removing unused severe-lean forms, trimming registered clips and exact deduplication keeps eleven additional species within the budget. Pipeline version 6 fingerprints `scripts/art/ecology-model.ts`, specs and codecs, exports each colored OBJ and validates cached outputs. No extra image generation was used in Study 06: animal meshes and root-litter textures are code-native source assets. All runtime instances share one texture.

## Add a directional animal

See [animation research and design](ANIMATION.md) before choosing an approach.

1. Define species-specific actions and a stride distance, plus a ground origin and footprint. Heading is world-space +X at zero radians; use the existing camera convention.
2. Implement a build-only `(action, phase) => Mesh` producer, or later add a rig-import adapter. The current producer is articulated primitives; there is no glTF importer yet.
3. Bake enough headings for the desired size/motion. Keep light and camera fixed while rotating the model; preserve the root across all views. Register the clips in the packer and add source dependencies to the build fingerprint.
4. Integrate state/steering separately from animation. Turn before walking; advance walking phase using distance actually moved. A newly added animal must not inherit generic deer movement unchanged.
5. Test heading/velocity alignment, stable roots, cyclic poses, terrain boundaries and support feet. Give each new artifact a class and register its compact codec; see [agent library](AGENTS-LIBRARY.md). Inspect contact sheets at native resolution and enlarged nearest-neighbor scale, then the browser view.

For an artist-authored Blender/glTF rig, retain this bake/atlas boundary. Evaluate its skinned vertices into the generic triangle contract, rather than adding an entire 3D engine to the browser just to display small sprites.

## Add generated vegetation or reference art

1. Choose the artifact, frame size, footprint and root anchor. Reuse the recorded style and lighting in `assets/prompts.json`.
2. Request a regular grid with explicit rows/poses, equal cells, fixed landmarks and clear margins. For a deformable wind source, prioritize one excellent stable pose; a huge generative animation sheet is unnecessary.
3. Inspect the image. Correct grid/background/anatomy/camera errors with the image tool, copy the accepted source into `assets/source/`, and retain exact prompts and tool/date provenance.
4. Add a bake spec and a motion mask appropriate to the artifact. New flowers must not use a mask that bends their roots; new mushrooms must not bend their rock.
5. Include all source dependencies in the fingerprint, rebuild and run tests. Inspect first-to-last loop continuity and key-color fringes. Update this inventory.

Prompt template:

```text
Use case: stylized-concept. Technical sprite atlas for an isometric pixel jungle.
Canvas: [dimensions], exact [columns] × [rows] equal cells.
Background: uniform #ff00ff chroma key, no gradient or cast shadow.
Style: crisp clustered pixel art, 2:1 view, upper-left light,
emerald/jade greens, warm highlights and dark teal outlines.
Rows: [species or pose for each row].
Registration: stable body/trunk size and root/foot anchor at [x,y].
Margins: whole object inside its cell, no overlapping neighbors.
Invariants: consistent anatomy, camera and lighting.
Avoid: text, grid lines, scenery, glow, blurry edges.
```

The current key threshold suits this palette; review it before adding purple/magenta species. If a future tool reliably produces genuine alpha, preserve it and update key validation accordingly. Generation is nondeterministic; baking committed source material is deterministic.

## Quality and distribution boundaries

The original source images remain AI-generated artwork. The current deer is a stylized authored 3D model with a procedural gait; more detailed anatomy and transitions can be improved without replacing the renderer. Generated source poses and all new models still require visual review.

No general license has been selected for the project's original art or code. Choose distribution terms deliberately before public release; do not attribute generated art to an external artist or pack.

## Procedural sound sources

Study 07 introduced original stereo PCM synthesis in `src/audio/synthesis.ts`; that study had no downloaded recordings. The later elephant recording is documented below. Buffers generate once when sound is enabled. `npm run audio:preview` exports WAV audition files. See [audio provenance and extension process](AUDIO.md). The existing atlas remains unchanged.

## Study 08 botanical sources

See [forest composition](FOREST.md) for the ten generated tree forms, six understory forms, procedural vines, compact traits and source segmentation. `npm run plants:preview` writes the registered contact sheet. The built-in tool supplied the new alpha PNG, with both exact prompts retained in `assets/forest-prompts.json`; offline code supplies motion and vine geometry. `scripts/art/foliage.ts` removes disconnected neighboring-cell fragments before normalization. The new source and both added build modules participate in the asset fingerprint.

## Study 09 motion bake

No new generated raster sources were needed. Authored monkey geometry now has stable overhead grips, walking limbs and climbing poses; ecological bird rigs use a larger asymmetric wing stroke and tucked flight feet. The active atlas omits crab clips. Flight controller and species-profile source files are fingerprinted; glides reuse a level-wing pose. `npm run motion:preview` writes a staged supported swing; see [animal motion](ANIMAL-MOTION.md).

## Study 10 packing and wolf gait

The wolf's authored mesh adds a 20-phase directional run. No new generated raster sources or third-party models were needed; cubs share the rig at parent-relative scale. Registered wind sampling preserves source colors and enables more exact frame deduplication. The deterministic shelf packer now backfills row gaps. Source images/prompts remain intact; all changed baker/model inputs participate in cache fingerprints. The atlas PNG is approximately 1.94 MiB.

## Study 11 elephant rebuild

The build-only `scripts/art/elephant-model.ts` replaces the generic quadruped silhouette with domed shoulders/head, lobed ears, column legs and padded feet, curved tusks, a tapered tail and a connected tapered trunk mesh. Shared `src/jungle/elephant-pose.ts` controls drinking and spraying and lets the runtime register water effects to the baked nozzle. Sixteen headings contain 8 rest, 20 walk, 24 drink and 16 spray poses each. One-shot clips sample inclusive endpoints; locomotion remains cyclic. These code-native assets require no image-generation service or new third-party artwork.

The cache fingerprint includes the new model, shared pose and response component. The atlas remains below 64 MiB. The finite fixture's soft island shadow is baked at half linear resolution and displayed at its original logical size; this recovers space without reducing animal/plant resolution. Runtime instances continue sharing one texture. Run `npm run assets:preview` for directional contact sheets and `npm run elephants:preview` for the cleared shoreline pose fixture. See [elephant design](ELEPHANTS.md).

## Graded ground, snake rigs and elephant audio

`src/jungle/ground-blend.ts` defines a five-color palette and 32 intermediate steps. The baker makes 66 shared 32×32 textures with deterministic patch noise and pixel grain. No per-tile bitmap is generated. These extend the existing procedural terrain pipeline; original organic foliage paintings remain unchanged.

`snake-model.ts` authors continuous tube rigs, baked at eight headings. Slow travel uses twelve phases; static rest/coil poses and clip-wide trimming avoid redundant frames. Boa wraps split into painter-ordered front/back sections around the actual tree support. Full wrap/coil meshes are used for contact sheets but omitted from the runtime atlas. All new model, shared-pose and codec dependencies are fingerprinted. [Snake design](SNAKES.md) covers behavior and limitations.

The elephant recording is the only third-party audio asset. Its source OGG, CC0 license and exact transformation are retained in [provenance](../assets/source/audio/provenance.json). Normal builds verify the committed source/WAV hashes and copy the locally stored PCM and attribution; no live generation, ffmpeg installation or network request is required.

Five woodland/river rigs and the denser packing contract are documented in [RIVERS.md](RIVERS.md). Their authored mesh sources, OBJ exports and build dependencies are retained.

Study 15 adds shared multi-tile landscape groups, tint masks and static trunk templates. Current world/agent schemas are **15/12**; see [landscape groups](LANDSCAPE-PATCHES.md) for source provenance, animation, navigation and memory details.

Recurring colorful regions, canopy population/perch changes, new generated source provenance and black bear type 58 behavior/rig/codecs are documented in [regional variety](REGIONAL-VARIETY.md). Current world/agent schemas are **15/12**.


The landscape wind pass separates four original flower-carpet petal masks from the existing neutral base. No new generated source is needed: the exact original artwork/prompts remain retained. Petals keep source RGB, stems retain tint masks, and soil stays stationary. Runtime crown bands reuse atlas subregions. The rebuilt atlas has 11,589 logical / 9,844 unique frames at 4096×4064 (63.50 MiB decoded), within the existing budget. The existing landscape-baker fingerprint covers this mask change.

Current sound, input, bears/zebras, giraffe proportions, elephant sampling, shared landscape accents and schema 17/14 are documented in [wildlife refinements](WILDLIFE-REFINEMENTS.md).

Sixteen more original generated flower/shrub forms are retained in `assets/source/landscape-accent-variety.png`, with exact prompt and crop provenance in `assets/accent-variety-prompts.json`. Hawks/vultures and ground-rest poses use original articulated mesh sources; the offline baker retains their OBJ references and hashes. See [wildlife refinements](WILDLIFE-REFINEMENTS.md) for sampling and atlas tradeoffs.

Volcano source forms are retained in `assets/source/volcano-forms.png`, with exact ImageGen prompt, tool and hash in `assets/volcano-prompts.json`. Four reviewed 627×627 cells bake to registered 312×264 poses (288×240 artwork), three times the earlier linear resolution, with the same logical size. Shared manifest paths are traced through incandescent pixels for descending slope effects. Vertical shelf gaps are reclaimed to preserve the 64 MiB atlas budget without reducing other artwork. Shared procedural smoke/fire/ash and continuous molten/crust surface materials with registered painted outlets animate in the renderer without per-site textures. See [volcano artwork and lifecycle](VOLCANOES.md).

## Spacecraft encounters

Three rare spacecraft and their owned alien crews use world/agent schemas **22/18**. See [spacecraft design, retained artwork and validation](SPACECRAFT.md) for landing admission, bounded ownership, timed exploration, exact continuation and preview commands.
