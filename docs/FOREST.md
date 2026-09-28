# Natural forest composition

Study 08 · 27 September 2026

The forest uses coherent species stands with varied individuals, irregular spacing, mixed growth stages and patchy understory. Adding random rotation to the same tree cannot provide different branch structures, so the source art and the placement system both changed.

## Research and choices

[NVIDIA's virtual botany chapter](https://developer.nvidia.com/gpugems/gpugems2/part-i-geometric-complexity/chapter-1-toward-photorealism-virtual-botany) explores plant structure, populations and the balance between reusable geometry and variety. Our application uses that separation: structural source forms, compact individual traits and a spatial population field. This is an adaptation to fixed-camera pixel art, not an implementation of its 3D system.

[NVIDIA's procedural tree wind chapter](https://developer.nvidia.com/gpugems/gpugems3/part-i-geometry/chapter-6-gpu-generated-procedural-wind-animations-trees) separates trunk/branch motion and describes phase variation and spatial wind fields. We retain rooted 32-frame leaf deformation and add a very small continuous, spatially coherent gust. The browser does not simulate a physical branch hierarchy.

Three approaches were considered:

| Approach | Decision |
| --- | --- |
| More independent images of every animation pose | Avoid: registration and anatomy drift, with unnecessary atlas cost. Generate structural source poses and bake their wind loops. |
| Fully procedural 3D trees | Useful for a future rotating camera and arbitrary branch reconstruction. Defer: matching the current organic art would require substantial authoring and a new tree model pipeline. |
| Generated structural forms + deterministic placement/traits + procedural vine curves | Implemented. Changes the recognizable silhouettes while retaining the existing renderer, sprites and headless tests. |

## Structure and placement

There are **22 tree forms**: seven broadleaf, five palm, five banana and five flowering forms. **Ten understory forms** cover shrubs, ferns, bromeliads and mushroom rocks. The new generated sheet adds ten trees and six low plants; original source sheets remain available. New forms include narrow tiered crowns, airy juvenile growth, asymmetrical branching, irregular dense crowns and different frond arrangements.

`src/iso/distribution.ts` provides reusable stateless priority thinning. Two seeded candidates per integer cell compete with candidates in a one-cell halo. Trees keep a 0.44-tile minimum separation even at negative chunk boundaries; visiting a neighbor first cannot change placement. Candidates can approach cell edges, so there is no repeated empty border around each tile. Density and habitat filters only remove candidates and preserve the spacing guarantee.

`src/jungle/groves.ts` chooses domain-warped stands with a dominant species. Broadleaf stands are more common; individual trees usually inherit the local species. Structural form, growth stage and proportions vary within a stand. Rare leaning forms remain grouped, and the large majority of trunks remain upright. The original, easily recognized umbrella sprite is now uncommon.

`src/jungle/botany.ts` supplies continuous canopy and understory fields. They create fuller patches, small openings and fern/shrub colonies. Low plants use independent sub-tile positions. They are not placed at four fixed offsets, nor do all moist tiles select the same fern. Plants still obey the rendered land/water material and vegetation density setting. Population generation is deterministic rather than a growth or ecological competition simulation.

## Individual traits and rooted geometry

Each `PlantAgent` stores a 16-bit genotype in addition to its existing scale, morphology and wind state. It expands once into cached width (±12%), height (±7%), small lean (under one degree), orientation, a restrained color choice and optional vine form. Young trees coexist with mature trees, whose larger crowns overlap more naturally. Serialized appearance survives sleeping and checkpoints exactly.

`src/iso/sprite-geometry.ts` supplies `rootedQuad()`. It preserves the ground anchor when changing width, height, lean or mirroring, including asymmetrically trimmed sprites. Both slow gusts and fixed lean use this transform. The existing quad contract handles it in Memory, Canvas and WebGL. Canvas recognizes affine quads and uses one direct draw instead of two clipped triangles; untinted plants sample the atlas directly.

Orientation means distinct authored branch/frond views plus left/right billboard mirroring. This is **not arbitrary 3D rotation**, and mirroring also mirrors baked lighting. Color variation is deliberately limited to avoid a rainbow forest and an excessive Canvas tint cache. No per-plant images or extra atlas pages are allocated.

## Vines

`scripts/art/vines.ts` generates four hanging liana patterns with curved strands, alternating leaves and 32 wind phases. Canopy attachments stay fixed while the lower tips move. The runtime adds a shared vine sprite to a small subset of mature trees; it follows the host's proportions, lean, orientation, depth and wind phase. A vine is a visual component owned by its tree, not an independent mobile agent. It has no extra simulation tick or RNG stream.

This is an intentionally small procedural grammar. It does not yet connect different trees, collide with branches, grow over time or provide monkey swing paths. Those features would need explicit world-space attachments and lifecycle state.

## Assets and reproducibility

The built-in image generation tool produced [`assets/source/forest-forms.png`](../assets/source/forest-forms.png). Exact initial and correction prompts are in [`assets/forest-prompts.json`](../assets/forest-prompts.json). The accepted source has alpha, four columns and **unequal row heights**, despite the grid instruction. The baker uses reviewed normalized row gutters `[0, .30, .578, .827, 1]`; do not replace them with quarter-height crops.

`scripts/art/foliage.ts` retains the main connected plant and a small fringe, removing neighboring-cell fragments. Every source is normalized with transparent margins before wind deformation. Existing additional tree forms use a smaller bake resolution with compensating logical size; new tree/plant cells use 72×88 / 56×44 texels. Shared frames, clip-wide trimming and exact deduplication keep the one-page atlas under 64 MiB without lowering the 32-frame wind cadence.

```sh
npm run build           # deterministic bake from committed sources
npm run plants:preview  # artifacts/plant-forms.png, all forms on aligned baselines
npm run check           # unit tests plus headless landscape/wildlife images
npm run benchmark       # CPU stages, excluding browser/GPU rasterization
```

To add forms: generate and inspect one stable source pose, retain prompts/source alpha, record the actual cell bounds, update the form IDs/counts, bake with a stable root and inspect the contact sheet and whole forest. To extend vines: change the offline curve grammar, preserve the attachment and transparent margin tests, then rebuild. Normal builds never invoke image generation.

Study 08 introduced world schema 5 / agent schema 4. Current motion changes use **world schema 8 / agent schema 7**; see [animal motion](ANIMAL-MOTION.md). Older checkpoints fail explicitly. Settings and cache budgets are unchanged; there is still no automatic persistent save or cross-chunk growth history.

## Study 10 wind registration

Source leaf detail is now registered once at bake resolution before applying the wind loop. Each phase shifts existing rows; the actual crown bounds determine the moving mask, and roots remain exact. Continuous rooted shear supplies the broad sway between fixed ticks. This removes the changing high-resolution source samples that made leaves appear to redraw, while retaining nearest-neighbor pixels, 32 phases and shared vine assets. See [animation](ANIMATION.md).
