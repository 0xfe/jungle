# Recurring jungle regions and black bears

The quiet 3–22-tile opening remains a seed-anchored envelope. Beyond it, independent smooth fields in `src/jungle/regions.ts` bring back open woodland, flowering groves, fruiting/vine stands and wetter stretches. These are recurrent world-space regions, not a camera-triggered sequence or a density ramp that keeps rising. The default regional wavelength is 24 tiles; fields overlap, so a flowering region can also be open or wet. Terrain contours, habitat sampling and rendering share the regional water field, including negative chunk borders. Setting water to zero still removes all water.

## Art and placement

Two new retained ImageGen sheets add **16 structural variants**:

- `assets/source/landscape-color-groves.png`: four flowering groves and four fruit/vine groves. The reviewed three-root layouts retain the original grove registration; branch ownership and crown ledges remain approximate vector templates.
- `assets/source/landscape-color-ground.png`: four wildflower carpets and four muddy leaf-litter glades with ferns, fallen branches and mushrooms.

Exact prompts, reference and tool provenance are in [`assets/variety-prompts.json`](../assets/variety-prompts.json). These are original generated assets; builds stay offline. Leaves use shared tint masks while flowers, fruit, bark and soil preserve their source colors. The new variants retain the continuous registered wind introduced in the previous revision. Ground flowers and leafy ground cover wave above stationary soil, joined by porous grass skirts; fruit-tree vines are painted into their shared tree sections, not separate ticking entities.

Broad region fields favor compatible colorful neighbors. Rare accents also interrupt ordinary forest: about 5.5% of eligible grove candidates become leaf-litter gaps; occasional flower and fruit groves remain outside their dominant regions. These substitute components inside the existing 16-tile compound arrangements. No single-tile plant agents, per-chunk textures, rectangular cutouts, or per-leaf objects were added. Roots retain land checks, deterministic spacing, painter depth and movement/perch templates.

`CONFIG.world.regions` sets regional scale, open-canopy fraction and wet-region water depth. Existing plant/water controls remain authoritative. The regional art has four structural variants, not arbitrary rotated 3D geometry. The atlas contains 11,589 logical frames / 9,844 unique frames in 4096×4064 pixels: **63.50 MiB decoded**, approximately 3.07 MiB PNG, within the unchanged 64 MiB limit.

## Population and visibility

The previous clearing revision retained candidate rates, but changed usable supports and the number of placement RNG draws, reducing some actual populations. In the previous mature benchmark there were 228 animals versus 258 before clearings (264 versus 294 total agents, including 36 arrangements). Mixed-material habitat sampling now uses moisture from the material under an animal rather than the tile center. Ground animals can also be hidden by foreground canopy; painter ordering remains physically anchored rather than drawing wildlife through trees.

Ecological placement now has a seeded stream per species and owner chunk. Changing one species' candidate rate or placement attempts cannot consume another ecological species' placement stream. Dense-canopy macaw, parakeet, kingfisher and toucan candidates get an additional configurable weight, without enlarging their social groups. Reviewed per-trunk crown heights replace the uniform group-scale perch approximation, so birds occupy different visible canopy ledges. They still fly between real supports with their existing powered/glide controller.

Nine fixed samples (seeds 71, 2718, 2026; x = −40, 40, 80; each bounds x…x+16 and y = −8…8) changed from **1,357 to 1,523 animals**, **475 to 605 colorful canopy birds**, and **200 to 201 deer**; the new samples include 30 bears. These include the active chunks admitted at the inclusive bounds and describe this generator sample, not promised counts in every viewport. Terrain and habitat changes can still change local populations.

## Black bears

`BlackBearAgent` owns type **58**, its PRNG, motor, destination, foraging intent, timers, family IDs and presentation samples. Most candidates are solitary; 28% request one mother with one or two cubs, subject to habitat/space. Cubs are 43–56% of their parent's size. No adult bear packs are generated.

Bears make slow, dry-footed approaches beside actual trees, stop to forage with a lowered sniffing head, and rest before moving again. Cubs refresh their parent-following target during travel; mothers stop for lagging cubs. They turn before translating, brake on arrival, and advance gait by actual distance with a body-scaled 0.175-tile stride. The authored +X-facing rig has rounded ears, a tan muzzle, broad plantigrade paws, a heavy black body and a short tail. Eight headings share rest, 16-frame walking and 12-frame foraging clips. `assets/models/blackBear.obj` is a static inspection export; the editable pose source is `scripts/art/black-bear-model.ts`.

The broad solitary/mother–cub and plant-foraging choices follow the [National Park Service black bear overview](https://www.nps.gov/articles/black-bears.htm). The mixed jungle is artistic, not a geographically accurate ecosystem. Bears do not hunt, reproduce, hibernate or migrate between owner chunks in this version. They are included in **J** wildlife navigation.

World schema **15** and agent schema **12** reject older layouts. Family links, foraging intent, motor/RNG and previous samples survive checkpoints exactly. Sleeping cached agents resume; expired chunks regenerate initial populations. There is no durable migration/history or automatic persistence.

## Verification

`npm run patches:preview` produces the neutral asset contact sheet, opening/mature views, and `artifacts/region-{flowers,fruit,open,wet}.png` at fixed points along a long diagonal route. `npm run assets:preview` includes bear direction/action sheets; `npm run snapshot` includes a real generated bear habitat.

Tests cover recurrent regional diversity, shared negative-edge water fields, no-water settings, mixed grove root spacing, all asset variants and fingerprint inputs, species RNG isolation, dense-canopy bird rates, solitary/family bear spawning, cub following/mother waiting, calibrated stride/blocked movement, valid clips and exact continuation through foraging and family behavior. See [performance](PERFORMANCE.md) for the current CPU benchmark and browser observations.
