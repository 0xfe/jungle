# Shared landscape groups

Two retained ImageGen source sheets supply 20 structural variants: four groves, bush thickets, grassy clearings, wet undergrowth and water/lily-pad overlays. The exact generation and background-edit prompts are in `assets/landscape-prompts.json`. These are original generated artwork; no external asset license is required. Normal builds read the committed PNGs, never a generation service.

## Artwork and animation

`scripts/art/landscape-patches.ts` splits reviewed source cells into neutral wood/soil and grayscale foliage masks. Three shared RGB palettes in `CONFIG.world.patches.foliage` color only those leaves; trunks and soil keep their original color. Set these palettes to russet, brown or deeper greens without baking another atlas. Colors are bounded palette choices, not unique per-instance textures. Water retains its blue reflection strokes and shares the leaf mask for aquatic plants.

Each structural view keeps one registered source pose. A continuous, two-frequency wind shear moves each tree section about its reviewed trunk foot, with wood and foliage sharing the exact same transform. Its clock interpolates between fixed simulation steps; no two-frames-per-second pose selection remains. Bushes and wet plants sway about their base, water overlays move more gently, and ground/grass skirts stay still. Individual phase offsets prevent synchronized movement. Source pixels retain nearest-neighbor filtering, with no blurred crossfades or per-frame source resampling. Four structural variants are shared artwork, not arbitrary 3D rotation.

The source grids are four columns, two rows for groves/bushes and three rows for grass/wet/water. Reviewed trunk feet live in `GROVE_ROOTS`. Grove images use 128-pixel-wide bake cells; other groups use 96. Logical display dimensions are independent of texel size. The old finite-island ground textures use half-resolution texels with unchanged logical bounds, freeing atlas space without reducing animal artwork. The production streaming terrain keeps its existing texture resolution.

## Placement, movement and draw order

`planArrangement()` produces a **compound landscape with a 4×4-tile ownership area and roughly one extra tile of overlapping vegetation around its perimeter**. Its visible footprint can reach about 6×6 tiles. A compound sprite consists of shared immutable art pieces and vector supports; it is not a new full-size texture per chunk. Four-tile grass pieces remain useful internal middle/filler components. No independent tree, bush, small wet-plant or per-tile water agents spawn in the streamed world. The finite regression fixture retains its individual art.

Placement is continuous across ownership boundaries. A staggered triangular pattern is warped by smooth world-space noise and smaller individual offsets. It does not line up with the terrain grid, nor leave a blank row around chunks. World-space vegetation fields form correlated stands: grove interiors give way to adjoining bush thickets, then grassy fringes. Bush pieces overlap their compatible neighbors, rather than standing in separate plots. Palette choice varies over whole stands, with independent structural views, scales and animation offsets inside them.

An independent smooth world-space clearing field reduces canopy only around occasional glades, leaving most dense stands intact. The five-tile field eases trees through bush into grass; it neither cuts rectangular holes nor fades trunks. Across three uniform mature forest samples (seeds 71, 2718 and 2026; 1,024 tiles each), visible tree counts fell about 14–23%. Opening density, wildlife population settings and shared border rules remain in effect.

Each grove/bush component includes a wider porous grass skirt; registered soil is subdued so it no longer outlines each piece with a separate brown island. Grass blades, low leaves and scattered transparent edges bridge neighboring arrangements. Water plants form coherent colonies with open water between them. Wet vegetation follows the actual shore field, and tree roots are individually checked against land. Tree density changes placement, never trunk opacity: sparse openings do not contain translucent trees.

One `LandscapePatchAgent` owns the whole arrangement and its animation clock. Component data and vector trunk supports are immutable; they do not tick or keep separate RNG streams. Trunks compete with neighboring candidates using deterministic priorities and a 0.44-tile clearance, including across negative chunk borders. Only surviving trunks enter movement/perch templates. Spawn clearance also checks neighboring arrangements. Low vegetation remains traversable.

The existing grove art is split into three tree sections and a ground section. Each visible tree section sorts at its own root and follows the same triangulated ground height as animals. Animals can pass between and behind trees throughout a compound landscape. The result still uses one transparent painter-ordered stream; a large forest is not submitted as one foreground rectangle. Reviewed masks approximate branch ownership rather than reconstructing a 3D canopy.

## Memory and reproducibility

All groups share the existing single painter-ordered atlas, including their tint masks and animation. The current atlas is 4096×4060, **63.44 MiB decoded**, roughly **3.06 MiB PNG**. Source sheets are retained for authoring and excluded from the shipped site. Loading still fetches one atlas, not one image per group. No per-tile textures or per-leaf objects are introduced.

Planning uses temporary candidate/terrain-vertex maps within a bounded chunk halo; they are discarded after generation. There is no persistent arrangement memo or visited-coordinate history. At most 64 components fit in one record. Memory estimates include component and support objects in addition to the agent itself. Schema **15 / 12** (world / agents) stores each arrangement, its component choices/positions/opacity/visible-trunk masks and exact animation continuation. Sleeping arrangements resume; expired arrangements regenerate. No durable migration/history or automatic persistence is implied.

```sh
npm run patches:preview # masks, roots and structural variants; opening and mature scenes
npm run rivers:preview  # narrow muddy banks and wet vegetation
npm run check           # deterministic bake, types, tests and scene snapshots
npm run benchmark       # CPU-only scale measurements
```

Tests cover compound object counts and absence of single-plant placements, all variant assets, atlas/dependency limits, continuous border coverage, cross-chunk support spacing, traversable versus blocked positions, depth ownership, visit order and exact continuation. See [performance](PERFORMANCE.md) for benchmark/browser observations.

Two companion source sheets add flowering/fruiting groves, painted vines, wildflower carpets and muddy gaps. Recurrent regional placement, per-trunk crown ledges and population changes are documented in [regional variety](REGIONAL-VARIETY.md).
