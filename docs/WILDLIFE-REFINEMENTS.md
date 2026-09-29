# Wildlife and living landscape accents

Sound now starts muted on every platform. The speaker explicitly enables it; navigation and gestures retain mute. `?` / H opens the guide even with the menu hidden, revealing its toolbar. Touchscreens accept two nearby taps within 350 ms to show the menu. Drags, pinches, cancelled touches and long presses do not qualify. Enter/Return still toggles controls.

## Bears and zebras

Bears are now 25% larger, with proportionally longer strides, clearance and tree approaches. Black bears retain their quadruped walking and ground foraging. A reachable tree approach can now lead to a 1.4-second rise, an upright pause, repeated picking, and a registered lowering clip. The head stays level, hind feet stay planted, and the last pick finishes its cycle before lowering. Perches can expose their actual root separately from their landing offset. Bears target that root, face it before rising, and lower if the support disappears. Bounded searches fall back to ground foraging when trunks cannot be reached. Mothers/cubs retain their existing waiting/following rules. Tree target and support coordinates serialize exactly.

`ZebraAgent` owns stable type **59**. Two or three individuals form a dry-woodland herd. They alternate grazing, walking and occasional short runs, followers refresh their leader-relative destinations, and the leader waits for distant members. They avoid water and wet forest, turn before moving, brake on arrival and stop their walking cycle when blocked. The authored equid rig includes striped coat, upright mane, muzzle, ears and hooves. A 0.585 model-unit foot excursion over 68% stance matches the 0.19-tile body-scaled stride. This is stylized herd behavior, not a migration or reproduction simulation.

Giraffe model height increases **16%**, keeping ground-plane dimensions and stride unchanged. Shared mesh vertices transform once so adjoining triangles cannot multiply the stretch.

## Quiet ground rest and encounters

Deer, zebras, jaguars and bears own a reusable `Repose` controller: 1.3-second lowering/rising, 30–95 seconds lying quietly, a six-second breathing/head-look cycle, occasional 3.5-second weight shifts and a 35–85 second cooldown after rising. Deer/zebra legs fold under the body; jaguars stretch their front paws; bears settle into a broad prone posture. Eight real headings and eight frames per clip share registered union bounds. Rising reverses the lowering clip. Rest halts translation and stride; nearby threats wake prey through the rising transition. Timer, prior samples, phase and RNG resume exactly after sleeping/checkpointing.

A continuous world-space range field usually separates deer/zebra groups from jaguars, wolves and bears. A narrow overlap permits encounters. Ground prey owns its escape response, using the pre-update neighbor snapshot and bounded habitat-clear routes. Deer/zebras flee large hunters; squirrels flee jaguars, wolves, bears and low-diving hawks; ground monkeys respond to jaguars; toads hop from low hawks. High-flying hawks do not alarm ground wildlife, and butterflies, large herbivores and unrelated species do not flee indiscriminately. Trees retain climbing squirrels rather than interrupting their support mid-climb. This is local avoidance, not a persistent food-web simulation.

## Rare large birds

Hawks (type **61**) and vultures (**62**) are solitary, with low independently seeded candidate probabilities (`CONFIG.world.population`). Shared articulated rigs have hooked beaks, broad feathered wings and distinct vulture heads/ruffs. Their displayed scale is larger than ordinary birds. `FlightMotion` alternates powered flight with level-wing glides.

Hawks circle a roughly 5.6-tile-wide home range, mostly high overhead. Occasionally they choose a ground squirrel or toad within three tiles, make a 3.4-second fixed missed intercept, then resume circling after a long hunting cooldown. The hawk never tracks the animal during its dive, captures it or modifies its state. Nearby prey reacts to the low approach independently.

Vultures begin with 45–100 seconds picking at a small authored rib cage/hide, fly for 18–32 seconds, land at the same remains and resume for another 50–115 seconds. A 400-second regression requires most time on the ground and an actual return after flight. Home position, orbit, dive progress and prior presentation samples serialize exactly. Remains are static scene components owned by the vulture; no kills, gore, new carcass populations or migration are simulated.

## Elephant sampling and texture budget

Elephants now have **24 headings**, with **8 rest / 24 walk / 36 drink / 24 spray** frames per heading: **2,208 logical frames**, up from 1,088. One-shot endpoints and quantized trunk-tip effects stay registered. Elephants finish large turns before translating.

More poses trade some texel density for smoother motion: elephant baking uses 17.5 pixels/model-unit, displayed at the previous logical scale of 21. Legacy individual foliage used by the finite fixture uses half-resolution nearest-neighbor texels while retaining all 32 poses, anchors and logical size. The streamed compound landscape sources keep their resolution. Shared atlas limits remain 4096 × 4096 / 64 MiB, with transparent gutters and exact frame deduplication. Deer now bake at 21 pixels/model-unit and jaguars at 25 (both retain the previous logical scale of 28); this keeps all new resting and flight frames on the single page without interpolated resampling. Body dimensions, anchors and stride distances remain unchanged. All source art and models remain retained.

## Small animated overlays

`assets/source/landscape-accents.png` contains generated flowers, berry fern, butterfly and leaf/twig artwork. Exact built-in image-generation and background-cleanup prompts, plus the retained first reference, are in `assets/accents-prompts.json`. The offline baker isolates four equal cells, removes translucent fringes and samples nearest-neighbor into four shared atlas sprites. No live generation is needed to build.

Selected land components receive a small rooted flower or bush overlay. A subset also carries fluttering butterflies or drifting leaf/twig sprites. Plants sway around their roots; butterfly wings fold continuously; falling leaves fade at the loop boundary. These are decorative components, not new simulation species or per-leaf entities. Their bounded count follows visible compound arrangements, using each owner's interpolated/checkpointed clock. They follow sampled ground height, skip water, retain painter depth, and do not consume behavior RNG or allocate textures per instance. `CONFIG.world.patches.accentCoverage` controls coverage.

The additional [source sheet](../assets/source/landscape-accent-variety.png) supplies sixteen flowers/shrubs: hibiscus, daisies, bells, bird-of-paradise, lavender, ginger, stars, coral clumps, round shrubs, feather ferns, berries, broad leaves, low ferns, airy bushes, pink tips and cream blooms. The [exact prompt and reviewed row gutters](../assets/accent-variety-prompts.json) are retained. Main connected silhouettes are cleaned and sampled at 32–56 pixels, with individual display scales of 0.60–1.55 and varied wind timing. Coverage increases from 65% to 90% of eligible compound components. Overlay count is still bounded to one rooted accent and at most one fluttering component per selected piece; there are no independent plant agents or instance textures.

Auto-scroll increases from 16 to **20 CSS pixels/second**, preserving the three-second navigation delay and explicit pause/drift toggles.

World schema **18** and agent schema **14** reject earlier saves. Sleeping cached agents resume; expired chunks regenerate initial populations. No durable migration/history or automatic persistence is implemented. Estimated live-agent memory allowance is 896 bytes per agent, plus existing landscape-piece/support allowances and shared resources; it is not total browser RAM.

## Review

`npm run check` rebuilds the atlas, typechecks, tests and writes scene snapshots, including zebra habitat. `npm run assets:preview` writes all headings/actions for bears, zebras, giraffes and elephants. `npx tsx scripts/art/preview-repose.ts` writes resting contact sheets and the sixteen accent forms. `npm run patches:preview` shows the landscape overlays; `npm run benchmark` measures CPU work, excluding GPU completion. Browser inspection must cover both WebGL and Canvas, hidden-menu Help, sound, keyboard travel, mobile layout and touch interaction where available.

The reviewed atlas contains 15,738 logical / 12,927 unique frames in 4096 × 4080 pixels (**63.75 MiB decoded**, about 3.08 MiB PNG). CPU-only benchmark p95 simulation/composition on this host: opening forest 1.25/3.16 ms, mature forest 1.18/4.39 ms, wide rain 3.76/9.85 ms; travel stream maximum 20.63 ms. These are local measurements, not GPU completion or device-independent guarantees.

`npm run check` passes 166 tests, including rest transitions, planted feet, exact continuation, predator escape, toad hops, climbing support, signed-coordinate population ranges, bounded raptor flights and vulture ground residence.

Browser review covers WebGL desktop and Canvas at a 390 × 844 viewport, hidden-menu Help, keyboard/landscape travel and zoom. The mobile guide remains scrollable and controls fit within the viewport. Double-tap recognition, drag/pinch exclusion and cancellation are headless-tested; physical-phone touch delivery has not been verified because the available browser connection has no touch-injection control.

The browser on this host reported around 30–58 FPS across sampled views. Canvas submission is appreciably heavier than the CPU-only benchmark; this is desktop responsive emulation, not a phone performance measurement.

## Gentle rustling and river crossings

Vulture candidate frequency falls from 0.012 to 0.008 (one third fewer); seagulls from 0.30 to 0.23 (about 23% fewer). Habitat/density still determine actual counts, and individual flock sizes are preserved.

The sixteen flower/shrub accents now have fourteen baked phases each. `scripts/art/accent-rustle.ts` deforms the registered low-resolution painting locally: leaf fans move sideways with differing phases, and a smaller second wave nods flower heads vertically. The bottom four rows remain byte-identical. Inverse nearest-neighbor sampling preserves the palette without holes from forward splatting or blurred interpolation. All phases share union bounds and one anchor; the source artwork, prompts and resolution are unchanged. No live image generation is needed. Existing broad rooted shear runs continuously on top of the pixel loop. `world.patches.accentRustlePeriod` sets the 4.8-second base cycle, varied by form; the owner's interpolated clock freezes on pause and restores exactly. Draw counts and per-instance texture counts do not increase.

`npx tsx scripts/art/preview-accent-rustle.ts` writes a contact strip of the actual atlas frames. Tests inspect every form for local movement, exact roots, transparent gutters and identical loop endpoints; scene tests check frame selection and frozen/restored presentation.

Canopy birds (toucans, macaws, parakeets and kingfishers) have an 18% opportunity per trip to choose a real dry perch across water within 4.5 tiles. Searches examine at most 64 supports and sample bounded routes across the shared water field. Their owner territories gain a two-tile margin on each side so chunk edges do not behave as invisible river walls. The owner chunk still retains the bird; this is bounded local flight, not migration. Ordinary flock behavior and powered/gliding cadence continue. Crossings reuse already serialized targets, altitude, motor, RNG and prior samples. World schema 18 pins changed populations/territories; agent layout remains 14.
