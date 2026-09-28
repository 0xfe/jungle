# Landscape settings and smooth terrain

**Settings / O** opens the panel; Escape closes it. Sliders apply after a brief 250 ms debounce, keeping the seed, camera, weather and habitat preset. They regrow terrain/populations and clear the previous scrollback cache and exploration counters. This prevents old terrain rules from meeting new ones at a seam. Settings live in the current page; there is no automatic persistence. World checkpoints preserve generator settings.

| Control | Default | Range / meaning |
| --- | ---: | --- |
| Trees & undergrowth | 1× | 0–1.5× placement probability; zero removes plants |
| Animal life | 2.5× | 0–5× candidate group probability; families/schools stay together |
| Water abundance | 20% | Relative abundance, not an exact area percentage; zero removes water |
| Lake size | 15% | Sets the main water-field wavelength from 4–18 tiles |
| Barren clearings | 8% | Relative dry-patch abundance; small 4.5-tile field wavelength |
| Meadows | 10% | Relative open-grass abundance |
| Hills | 8% | Relief beneath ordinary vegetation; no gray rock material |

Jungle fills the remaining land. Probabilities saturate; 5× animals does not guarantee exactly five times the visible count, since habitat and clearance still matter. Water animals require suitable water even with high animal density. The default animal multiplier increased from the previous generator's effective 1× to 2.5×; it preserves individual pace and social groups.

The historical Study 07 sample of seed 2718, x/y ∈ [−200,200) sampled every two tiles, gives **81.27% forest, 4.31% meadow, 5.04% dry/beach, 2.26% ridge, 4.64% shallow and 2.49% deep water**. These are measurements of this sample, not global quotas. The lake-size control changes scale independently of water abundance. High water settings can intentionally join lakes into larger bodies.

## Continuous contours

The previous renderer assigned one material to each quarter-tile square, making staircase shores. The new generator stores four scalar fields on shared half-tile vertices: signed lake level, ridge, dry clearing and meadow. Smooth world-space noise plus low-amplitude domain warping makes natural irregularities. The lake wavelength is smaller by default; clearings also use short wavelengths and high thresholds, so they are rare isolated patches among forest.

A cell splits into two triangles. `src/iso/contour.ts` clips each triangle against interpolated thresholds, preserving all fields and UV coordinates. Disjoint bands select deep water → shallow water → sand → dry → meadow → forest. The ridge field affects height only; Study 09 removes gray stone patches. Polygon fans become degenerate quads (one textured triangle each) using optional `DrawCommand.uvCorners`. Memory, WebGL and Canvas share this contract. Ground elevation still uses the original tile's two triangles.

Shared quantized vertex values and identical triangle orientation make crossings agree at tile/chunk boundaries, including negative coordinates. Runtime `TerrainTile.materialAt()` interpolates exactly these fields, so fish and land animals respect the visible shoreline. Uniform tiles still draw one quad. Boundary geometry is prepared once per tile in a WeakMap; no per-tile image is allocated and contour clipping never runs per animation frame.

Terrain remains compact: **986 bytes per 4×4 chunk**. The existing 338-byte kind/moisture/height/material metadata is retained, with 81 shared vertices × four signed int16 fields (648 bytes) added. Generation samples each vertex once and derives metadata/materials from those stored fields. Four normalized field values use 1/4096 precision. World checkpoints are schema **8**; agent collections are schema **7**, including plant traits and the new flight controller. Older world checkpoints fail explicitly.

## Limitations and extension points

This is a piecewise linear approximation to smooth noise, not a spline/vector beach at arbitrary magnification. Pixel sampling remains nearest-neighbor. Canvas may show small antialiased triangle-edge differences from WebGL. There is no erosion, river routing or island connectivity guarantee. Relative sliders can remove habitats entirely; wildlife navigation reports unavailable habitat when animals/water are disabled.

`WorldSettings` normalization is pure and tested. Construct `new InfiniteWorld(seed, preset, budget, settings)` outside a browser to reproduce any configuration. Add new fields/settings with explicit checkpoint versioning, seam/habitat tests and coverage/scale measurements. Keep thresholds in the generator and visual material selection aligned.
