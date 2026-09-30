# Rare active volcanoes

Press **V** to visit the nearest volcano. Ordinary exploration can find the same seeded sites. Four retained ImageGen structural forms share one atlas: a steep cone, broad open lava lake, twin mouths with only one active, and a broken caldera. Source art is `assets/source/volcano-forms.png`; the exact prompt, tool and SHA-256 are in `assets/volcano-prompts.json`. Builds remain offline. Nearest-neighbor baking keeps one registered pose per form; shared procedural smoke, fire, ash and material strips animate the feature without extra textures per site.

## Placement and ground

`src/jungle/volcanoes.ts` chooses one candidate in each 160-tile cell, accepting 22% of cells. Bounded jitter guarantees at least **112 tiles** between sites; expected density is roughly one volcano per 116,000 tiles. The initial 40-tile area around world coordinate zero is excluded. Each cone is about five tiles across, with lava and its sparse outer vegetation reaching roughly eleven tiles. Site selection is stateless, reproducible and independent of camera, visit order or chunk ownership. Signed coordinates use floor division.

A shared radial scar raises the lake field while preserving connected river channels, biases the ground toward dry land and removes canopy near the cone. Sparse grass and bushes bridge its outer edge into jungle. Ordinary terrain sliders do not remove volcanic scars. Dust, ash and porous rubble overlays follow the same triangulated terrain height as actors. Cone clearance prevents ground animals walking through the mountain; low vegetation remains traversable. Sites overlapping the active region are reconstructed from seed, with no visited-site history.

## Lava and eruptions

Three curving ribbons spread from the visible mountain foot. They share sampled endpoints and widths across tile/chunk borders, and use textured dark crust, glowing red flow and a brighter molten core. Fresh fronts advance, develop drifting cooled plates and settle into black obsidian. Upper channels stay molten; distal surges recur every 48 seconds. Registered mouth smoke rises continuously. Seventeen-second spurt windows occasionally throw larger, faster explosive clasts. The inactive mouth of a twin volcano remains dark.

Rendering and contact use the **same 96 segments**, rather than separate approximate rivers. Geometry memoization is capped at eight entries. All surfaces and effects join the existing transparent painter stream; ground uses lower layers and smoke/clasts use the volcano's ground depth. Scene time interpolates fixed 60 Hz samples and freezes on pause. The source mountain and painted slope lava remain one registered sprite.

These are artistic downhill lobes with advancing thermal fronts, not a fluid, erosion or geological simulation. Crust is a bounded recurring visual scar; flows do not accumulate permanent terrain edits. Explosive clasts are visual effects, with animal contact governed by the ground lava ribbons. Water outside the scar retains the normal physical terrain field.

## Wildlife and replacements

The outer volcanic belt multiplies whole-group candidate probability by 1.8; species-local RNG, solitary predators and family sizes remain intact. `VolcanicWildlifeAgent` (type **63**) owns a ground/canopy animal's lifecycle near a site, its replacement template and one recent ash pile. Water and airborne ecological species keep their ordinary behavior. Animals above eight logical pixels are safe from ground contact; grounded monkeys/apes and climbing species can react when low enough.

Most animals choose a clear escape target away from hot lava, using their own terrain/habitat rules. Their existing motor still turns, accelerates and advances gait by actual distance. A small deterministic fraction hesitate; blocked escape or an advancing surge can also cause loss. 2.25 seconds of sustained hot contact triggers a cartoon 3.5-second charred wobble, convulsions, flames and smoke. Burning/waiting animals leave the neighbor snapshot and audio emitter list. The body then disappears in a smoke puff, leaving ash for at most 60 active seconds.

After at least 14 active seconds, the lifecycle considers 32 stable replacement points 6.5–8.5 tiles away from the volcano. Admission requires resident valid ground, species habitat, lava clearance and an off-screen margin of 220 logical pixels. If every point is visible or unavailable, replacement waits. Thus camping at a wide view can delay replenishment. The new animal travels toward its original home point, keeps species, appearance, group/leader/mother IDs, and starts with registered previous samples. The old record is reused: population cannot grow with repeated deaths. One ash pile per record bounds lingering effects.

Replacement excursions expand that record's territory to a bounded ten-tile ring, but ownership stays with the original chunk. Family members may therefore reappear at different times; ordinary following/waiting resumes after the return intent. There is no transfer into neighboring chunk records, permanent death history, reproduction, or ecology simulated beyond the active region.

## Checkpoints and limits

World/agent schemas are **19/15**. Older records fail explicitly. Nested animal state, original replacement bytes, lifecycle clocks, exposure, cycle count, ash and family links serialize through registry codecs. Active state flushes before checkpointing. Sleeping wildlife resumes its saved lifecycle without advancing; expired chunks regenerate their initial population. Volcanic thermal/eruption cycles use injected global world time. The screen visibility policy belongs to presentation and must be supplied by headless callers that want replacement admission (`world.spawnHidden`); it is not stored in checkpoints.

The single atlas retains its 4096 × 4096 / 64 MiB decoded ceiling and one-pixel transparent gutters. Template bytes and nested active state are included in managed memory estimates; cache budgets and the 144-active-chunk limit remain unchanged. Stable active-chunk iteration preserves simulation order after reactivation.

```sh
npm run volcanoes:preview # all four real sites and a dramatic burn/ash fixture
npm run check             # assets, types, build, headless tests and snapshots
npm run benchmark         # ordinary forest, wide zoom, travel and volcanic CPU scenarios
```

Tests cover rarity/separation/forms, signed terrain seams, shared flow/contact geometry, cooling, turning/escape, blocked burning, absence from perception, off-screen replacement, family/template preservation, sleeping and exact checkpoint continuation. Browser QA must additionally inspect WebGL and Canvas, V/keyboard exploration, pause, overlays and mobile layout; CPU benchmarks exclude GPU rendering and browser scheduling.

On this Apple Silicon/macOS host, the volcano CPU benchmark (672 active tiles / 360 records) measured simulation p95 around 2.0 ms and composition p95 around 3.6 ms. A 390×844 WebGL browser viewport reported 60 FPS and roughly 10 ms CPU p95; a larger Canvas view reported about 11 FPS / 139 ms CPU p95 while both renderer tabs were open. These are observations from this run, not device-independent targets or GPU completion measurements. Menu visibility, V navigation, pause/resume and mobile guide layout were inspected; no browser errors appeared in either renderer. Actual touch hardware was not tested.
