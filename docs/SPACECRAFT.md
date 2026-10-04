# Rare visitors from space

Three rare spacecraft encounter classes share the jungle: the silver **saucer**, amber **tripod lander**, and violet **scout**. Each brings four to six explorers of its own species: green pear-headed Sprouts, orange cyclopean Embers, or lavender stalk-eyed Reeds. Individuals have stable IDs, sizes, scanner gestures, walking speeds, staggered exits and independent curiosity pauses.

Press **U** (or its Help command) to find an actual generated spacecraft clearing. This stops automatic travel so you can watch; **P** resumes it. The command does not spawn a ship or skip its timers. A fresh encounter waits 8–35 active seconds, so watch the clearing for a while. Ordinary encounters can occur anywhere suitable as you scroll, including negative coordinates. There are no fixed global landing landmarks or camera-triggered spawns.

**Shift+U** (also a Help button) cycles **saucer → lander → scout**, calling the selected design immediately and resuming a paused simulation. It searches only active chunks for safe dry ground, centers the camera and stops automatic travel. If that design is already visiting, the command focuses it without resetting its animation or crew. Otherwise it searches for a new site or reuses a waiting ship of that design. Other visiting crews continue normally; each owner chunk still has at most one ship. Failed calls do not advance the design selector. The selector belongs to the page controls, not saved world behavior. Explicit calls also work with animal life set to zero. If there is no safe site, the command explains that you should move toward a dry clearing. Called encounters use the usual landing aborts, crews, chunk sleep and checkpoints.

## Flight effects and voices

Airborne ships have a quiet stereo propulsion hum with soft beating harmonics and a faint, gently swept high whistle. Their engine glow flickers gently, with faint expanding, trembling rings suggesting warped space. These are translucent geometry effects, not a screen-space refraction shader: they share painter ordering and canopy occlusion across Memory, Canvas and WebGL, with no new atlas pixels or render targets. At most 96 small quads are added per visible airborne craft. The field fades at touchdown and departure height; simulation presentation time freezes it when paused.

Only exploring crews chatter, in short independently timed synthetic syllables with different pitches for Sprouts, Embers and Reeds. Boarding/hidden crews do not start new phrases. Both sounds follow the wildlife slider, distance attenuation, master mute and pause/visibility/suspension behavior. The propulsion layer is a single shared, panned loop mixed from nearby airborne craft, so overlapping visits cannot create unbounded drone nodes. It fades in/out over 0.12 seconds; chatter shares the existing 12-effect cap and 32-emitter history. Audio uses its own seeded caller state and cannot alter encounter RNG.

Tune `CONFIG.audio.sounds.hover` and `.alien` independently. `npm run audio:preview` exports `artifacts/audio/hover.wav` and `alien.wav`, including duration/pitch/rhythm/texture controls; playback gain/speed apply in the live mixer. Both are original procedural synthesis with no downloaded samples.

## Admission and visit

`CONFIG.world.spacecraft` defines a 2.2% candidate chance per four-by-four owner chunk, before terrain and clearance rejection. A separate seeded stream leaves other species' placement streams unchanged. Zero animal life disables encounters; higher animal settings do not multiply this already rare rate above its default.

A candidate must have a clear 1.3-tile exploration disk. Admission samples dry rendered terrain, rejects more than five pixels of elevation variation, checks all registered trunks plus canopy margins, and rejects volcanic clearance. Bounded searches stay inside the owner chunk. Each repeat visit must choose a site at least 0.4 tiles from the previous landing. If no suitable alternative is available, the ship waits and retries instead of landing on an obstruction.

The cycle is **wait → descend → open → disembark → investigate → recall → close → depart**. Ships check the pre-update neighbor snapshot before approach and again near touchdown. Ground animals occupying the site cause an aborted approach. Low ships reserve their hull footprint for other ground agents, using a collision snapshot taken before the simulation step.

Once every explorer has left the ramp, the whole crew investigates for a randomly chosen **15–30 seconds**. Explorers walk into different sectors ahead of the hatch, stop to examine their surroundings with handheld scanners, and make small further approaches. Their routes stay within the checked clearing. Each turns before translating, brakes on arrival and drives its gait by actual distance; blocked feet stop. Recall sends everyone back through the ramp. The ship waits until the final explorer is aboard before closing and departing, then waits 100–220 active seconds before seeking a different site.

## Baked ship motion and detail

Saucer rims now have segmented panel seams and service pods; landers have ribbed equipment housings and extra indicators; scouts have wing inlays, vents and paired engine nozzles. The saucer and rounded lander rotate through 16 baked world headings during flight. Their spin is tied to altitude and settles onto the reserved hatch heading at touchdown. Scouts retain their travel heading and cycle four baked bank poses, with transformed geometry and lighting. Hull beacons blink in the flight frames; three sparse beacon frames animate landed ships. A tiny shared vertical motor tremor (at most 0.21 logical pixels) moves the landed hull, lights and ramp together. Alien movement and hatch anchors remain unchanged.

The offline baker splits ship poses into registered 2 × 2 pieces, retaining every clip's complete phase sequence and one shared root. Exact identical patches deduplicate across headings and phases; empty pieces are omitted. `spacecraftParts` in the manifest lists the pieces for each clip, and the renderer submits them contiguously in painter order before the hatch and beacon overlays. All three renderers use the same atlas regions, without screen-space sprite rotation or mirrored headings. Tests reconstruct each full baked pose pixel for pixel and check root registration and the transparent gutters. `artifacts/spacecraft-flight.png` samples the flight loops.

## Agents and persistence

`SaucerAgent`, `LanderAgent`, and `ScoutAgent` use IDs **64–66**; `SproutExplorer`, `EmberExplorer`, and `ReedExplorer` use **67–69**. Specifications live beside the ecology definitions but stay outside the wildlife behavior loop. The ship is the chunk-owned top-level agent; up to six owned explorer records remain inside its binary payload. This prevents streaming boundaries from stranding a crew or duplicating ship/crew ownership. Crew members are not independent global population entries.

World schema **22**, agent schema **18** reject older checkpoints. State includes owner, destination, visit count, hatch/flight phase, timers, PRNG, crew identities/traits, movement/gesture phase and prior presentation samples. Sleeping cached encounters resume exactly; expired chunks regenerate their initial seeded encounter. There is no off-screen time catch-up, durable visit history, automatic persistence or migration between owner chunks. The resource estimate allows 896 bytes per top-level agent plus 768 bytes per owned explorer, independently of the actual encoded payload counted by the chunk cache.

## Artwork and inspection

The built-in image-generation tool created the retained concept sheet [`space-visitors-reference.png`](../assets/source/space-visitors-reference.png). The exact prompt and tool provenance are in [`space-visitors-prompts.json`](../assets/space-visitors-prompts.json). The source backdrop is retained as generated; it is not used as runtime transparency. Original articulated meshes in [`scripts/art/space-visitors.ts`](../scripts/art/space-visitors.ts) interpret the reference; they are not reconstructed meshes. Six exported OBJ references are retained under `assets/models/`.

Grounded ships and explorers have eight world-space headings; round flight clips add intermediate headings. A grounded ship stores a closed hull plus sparse beacon and opaque hatch/ramp difference overlays, registered to the same ground origin; compositing both reproduces the complete open mesh pixel for pixel. This avoids storing the same hull twice. Explorers share rest, six-phase walking and three-phase inspection clips. The baker preserves clip union bounds and anchors, uses nearest-neighbor logical scaling and fingerprints model/spec/agent/source/provenance inputs and exported outputs. Normal builds remain offline. The single painter-ordered atlas retains the 4096 × 4096 / 64 MiB cap and one-pixel transparent gutters.

```sh
npm run spacecraft:preview
npm run check
npm run benchmark
```

`artifacts/spacecraft-directions.png` shows every heading. `spacecraft-sequence.png` has one row per craft and columns for approach, disembarking, investigating, boarding and departure, with JSON state alongside it. The three `spacecraft-{saucer,lander,scout}.png` files show enlarged crews in deliberately empty review fixtures. Browser inspection uses naturally generated clearings instead. Tests cover complete timed visits, varied signed-coordinate landing sites, aborts/clearance, planted turns/blocked strides, exact codecs and chunk sleep, asset bounds/budgets/fingerprints, and scene composition. Headless images do not by themselves verify browser presentation.

The initial implementation passed all 195 tests and the CPU benchmark. All three directional sheets and visit sequences were inspected. Live WebGL and Canvas checks showed the scout and its exploring crew in the natural seed-2718 clearing near (46, -29.4); the Help command also worked at a 390 × 844 mobile viewport without horizontal overflow. Full timed departure and repeat-site behavior are covered by simulation tests. The resulting atlas is 4096 × 4092 (63.94 MiB decoded); benchmark timings do not measure GPU completion.

The sound/flight-effects and manual-call update passed 198 tests, a fresh build, audio/spacecraft previews and the CPU benchmark. Live WebGL verified Shift+U, sound enable and paused flight; a 390 × 844 Canvas view verified the tappable call command and flight presentation without horizontal overflow. Hum/chatter synthesis, phase gating, pause/mute, PCM budgets and shared-loop adapter behavior have headless tests; sound balance can be auditioned with the exported WAVs on the intended speakers.

The detailed-motion update passed all 200 tests, fresh asset/build/snapshot checks, audio and spacecraft previews, and the benchmark including three simultaneously called ships. The ship scenario measured 1.08 ms simulation / 4.04 ms composition at p95 on this run (CPU only, not GPU completion). WebGL and 390 × 844 Canvas checks covered the designs and shortcut/button cycle. The atlas is now 4096 × 4088 / 63.88 MiB, with 27,958 logical piece frames and 17,310 unique regions; full-pose counts are smaller because one pose consists of several pieces. A flight clip has at most 138 pieces, all shared between instances. No existing non-spacecraft artwork was reduced or removed.

The sanctuary extension further shares hull pixels in 2×2 pieces, preserving all poses exactly. The shared atlas remains under 64 MiB; see [current budgets and validation](ZEN.md).
