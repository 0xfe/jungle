# Woodland wildlife and connected streams

The forest now balances plants and animals differently. The seeded 3–22-tile opening still starts at 24% plant density, but retains 85% of the base animal-group rate instead of 8%. Estimated canopy combines the opening, vegetation patches, shore/dry cover and the plant setting. Open ground increases deer, small-snake, squirrel and bird candidates by up to 2.25×. Wolves and jaguars use a cover factor of `0.12 + 0.88 × canopy²`; boar also favor cover. Habitat and spacing checks still apply, and families/flocks remain intact. These are artistic placement rules, not an ecological population simulation.

## Five additional species

| Species / binary type | Behavior |
| --- | --- |
| Squirrel / 53 | Solitary short foraging trips. Sometimes approaches an actual tree, climbs to at most 34 pixels above ground, rests, descends, then waits 30–65 seconds before another climb. Ground travel and climbing phases advance by distance. |
| Boar / 54 | Solitary rooting/ambling. An eligible nearby deer may provoke a dash of at most 1.8 seconds, aimed half a tile short of its observed position. Close deer stop the dash; 32–70 seconds of recovery prevents repeated charges. |
| Beaver / 55 | Solitary bank visits and swimming, with occasional bank targets near woody cover. No dam construction or tree cutting. |
| Crocodile / 56 | Rare solitary bank basking, slow wading and swimming. Longer rests than beavers; no attacks. |
| Toad / 57 | Small solitary residents of water margins. Brief, individually timed arcs hop along/across the shore, with 2–7-second pauses. No synchronized hopping groups. |

Deer perceive boar, wolves and jaguars through the existing pre-update neighbor snapshot and choose their own valid escape route. Wolves retain their family movement and do not hunt. Encounters do not kill or remove animals. Every new class keeps timers, route, RNG, motor and previous presentation samples in the existing ecological record. Agent schema **9** and world schema **11** reject old checkpoints explicitly. Sleeping cached animals resume; expired chunks regenerate their initial populations. There is no durable migration or automatic persistence.

## Water geometry and flow

`src/jungle/rivers.ts` generates sparse, jittered pond nodes about 32 tiles apart. Eastbound connections link neighboring ponds; occasional southbound tributaries join these chains. Curved paths have shared endpoints, variable channel widths and 25 sampled positions per reach. The associated pond basins merge with pre-existing noise lakes where they overlap. This connects the network's ponds; it does not promise that every independently generated lake joins a river.

Channels and basins carve the existing signed water field, before half-tile sampling and quantization. Rendering, spawn tests and movement therefore share the same water boundary, including at negative chunk edges. Terrain chunks remain **986 bytes**. Water abundance zero removes the entire network; abundance affects channel width, while Lake size also changes pond radius. `CONFIG.world.rivers` controls spacing, width and flow speed.

Foam, branches and forked twigs follow the same arc-length path downstream, with per-reach speed variation and gentle periodic surges. Endpoints fade inside ponds. These are bounded presentation effects derived from injected simulation time, so Pause freezes them and checkpointed time reproduces them. They have no persistent identities, collisions, dams or accumulated litter history. Solid painter-ordered quads work in Memory, Canvas and WebGL without extra textures. Effects whose endpoints leave the rendered water are omitted.

Geometry is stateless apart from a bounded 128-reach memo. Active path lists rebuild only on streamed membership changes. The managed-memory estimate includes a conservative 512 KiB allowance for the memo plus 4 KiB per active path. There is no erosion, hydrodynamic solver or downhill terrain routing; water is rendered at the existing flat water elevation.

## Art and review

All five animals have authored articulated meshes in `scripts/art/river-model.ts`, eight world-space headings and shared immutable baked clips. Original colored OBJ exports live in `assets/models/`. No third-party model, new generated bitmap or network dependency is required. The source model and behavior module participate in the atlas fingerprint.

Packing retains the existing artwork and pose resolution, with a **one-pixel transparent gutter** between frames. This is appropriate to the existing nearest-neighbor, non-mipmapped texture contract; switching to filtering/mipmaps would require a different gutter strategy. A pixel regression checks every unique frame's entire gutter. Union trimming and shared anchors remain unchanged.

`J` includes all 21 animal habitats. `N` cycles dry ground, meadow, lake, forest and a flowing stream. Run:

```sh
npm run check
npm run assets:preview
npm run rivers:preview
npm run benchmark
```

`artifacts/river-{0,1}.png` and matching JSON show the same reach three seconds apart. Species contact sheets and habitat snapshots cover the new models. Tests check connected wet centerlines, downstream motion, zero-water settings, signed seams, population bias, climbing/cooldowns, bank crossing, hopping, non-contact dashes, deer escape and exact continuation.

Study 15 adds shared multi-tile landscape groups, tint masks and static trunk templates. Current world/agent schemas are **15/12**; see [landscape groups](LANDSCAPE-PATCHES.md) for source provenance, animation, navigation and memory details.
