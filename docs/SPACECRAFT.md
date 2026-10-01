# Rare visitors from space

Three rare spacecraft encounter classes share the jungle: the silver **saucer**, amber **tripod lander**, and violet **scout**. Each brings four to six explorers of its own species: green pear-headed Sprouts, orange cyclopean Embers, or lavender stalk-eyed Reeds. Individuals have stable IDs, sizes, scanner gestures, walking speeds, staggered exits and independent curiosity pauses.

Press **U** (or its Help command) to find an actual generated spacecraft clearing. This stops automatic travel so you can watch; **P** resumes it. The command does not spawn a ship or skip its timers. A fresh encounter waits 8–35 active seconds, so watch the clearing for a while. Ordinary encounters can occur anywhere suitable as you scroll, including negative coordinates. There are no fixed global landing landmarks or camera-triggered spawns.

**Shift+U** (also a Help button) calls a ship immediately and resumes a paused simulation. It searches only active chunks for safe dry ground, centers the camera and stops automatic travel. Repeated presses focus an existing active visit instead of adding ships; later calls reuse a waiting ship and choose a new site. Explicit calls also work with animal life set to zero. If there is no safe site, the command explains that you should move toward a dry clearing. Called encounters use the usual landing aborts, crews, chunk sleep and checkpoints.

## Flight effects and voices

Airborne ships have a quiet stereo propulsion hum with soft beating harmonics. Their engine glow flickers gently, with faint expanding, trembling rings suggesting warped space. These are translucent geometry effects, not a screen-space refraction shader: they share painter ordering and canopy occlusion across Memory, Canvas and WebGL, with no new atlas pixels or render targets. At most 96 small quads are added per visible airborne craft. The field fades at touchdown and departure height; simulation presentation time freezes it when paused.

Only exploring crews chatter, in short independently timed synthetic syllables with different pitches for Sprouts, Embers and Reeds. Boarding/hidden crews do not start new phrases. Both sounds follow the wildlife slider, distance attenuation, master mute and pause/visibility/suspension behavior. The propulsion layer is a single shared, panned loop mixed from nearby airborne craft, so overlapping visits cannot create unbounded drone nodes. It fades in/out over 0.12 seconds; chatter shares the existing 12-effect cap and 32-emitter history. Audio uses its own seeded caller state and cannot alter encounter RNG.

Tune `CONFIG.audio.sounds.hover` and `.alien` independently. `npm run audio:preview` exports `artifacts/audio/hover.wav` and `alien.wav`, including duration/pitch/rhythm/texture controls; playback gain/speed apply in the live mixer. Both are original procedural synthesis with no downloaded samples.

## Admission and visit

`CONFIG.world.spacecraft` defines a 2.2% candidate chance per four-by-four owner chunk, before terrain and clearance rejection. A separate seeded stream leaves other species' placement streams unchanged. Zero animal life disables encounters; higher animal settings do not multiply this already rare rate above its default.

A candidate must have a clear 1.3-tile exploration disk. Admission samples dry rendered terrain, rejects more than five pixels of elevation variation, checks all registered trunks plus canopy margins, and rejects volcanic clearance. Bounded searches stay inside the owner chunk. Each repeat visit must choose a site at least 0.4 tiles from the previous landing. If no suitable alternative is available, the ship waits and retries instead of landing on an obstruction.

The cycle is **wait → descend → open → disembark → investigate → recall → close → depart**. Ships check the pre-update neighbor snapshot before approach and again near touchdown. Ground animals occupying the site cause an aborted approach. Low ships reserve their hull footprint for other ground agents, using a collision snapshot taken before the simulation step.

Once every explorer has left the ramp, the whole crew investigates for a randomly chosen **15–30 seconds**. Explorers walk into different sectors ahead of the hatch, stop to examine their surroundings with handheld scanners, and make small further approaches. Their routes stay within the checked clearing. Each turns before translating, brakes on arrival and drives its gait by actual distance; blocked feet stop. Recall sends everyone back through the ramp. The ship waits until the final explorer is aboard before closing and departing, then waits 100–220 active seconds before seeking a different site.

## Agents and persistence

`SaucerAgent`, `LanderAgent`, and `ScoutAgent` use IDs **64–66**; `SproutExplorer`, `EmberExplorer`, and `ReedExplorer` use **67–69**. Specifications live beside the ecology definitions but stay outside the wildlife behavior loop. The ship is the chunk-owned top-level agent; up to six owned explorer records remain inside its binary payload. This prevents streaming boundaries from stranding a crew or duplicating ship/crew ownership. Crew members are not independent global population entries.

World schema **22**, agent schema **18** reject older checkpoints. State includes owner, destination, visit count, hatch/flight phase, timers, PRNG, crew identities/traits, movement/gesture phase and prior presentation samples. Sleeping cached encounters resume exactly; expired chunks regenerate their initial seeded encounter. There is no off-screen time catch-up, durable visit history, automatic persistence or migration between owner chunks. The resource estimate allows 896 bytes per top-level agent plus 768 bytes per owned explorer, independently of the actual encoded payload counted by the chunk cache.

## Artwork and inspection

The built-in image-generation tool created the retained concept sheet [`space-visitors-reference.png`](../assets/source/space-visitors-reference.png). The exact prompt and tool provenance are in [`space-visitors-prompts.json`](../assets/space-visitors-prompts.json). The source backdrop is retained as generated; it is not used as runtime transparency. Original articulated meshes in [`scripts/art/space-visitors.ts`](../scripts/art/space-visitors.ts) interpret the reference; they are not reconstructed meshes. Six exported OBJ references are retained under `assets/models/`.

All ships and explorers have eight world-space headings. A ship stores one closed hull plus an opaque hatch/ramp difference overlay, registered to the same ground origin; compositing both reproduces the complete open mesh pixel for pixel. This avoids storing the same hull twice. Explorers share rest, six-phase walking and three-phase inspection clips. The baker preserves clip union bounds and anchors, uses nearest-neighbor logical scaling and fingerprints model/spec/agent/source/provenance inputs and exported outputs. Normal builds remain offline. The single painter-ordered atlas retains the 4096 × 4096 / 64 MiB cap and one-pixel transparent gutters.

```sh
npm run spacecraft:preview
npm run check
npm run benchmark
```

`artifacts/spacecraft-directions.png` shows every heading. `spacecraft-sequence.png` has one row per craft and columns for approach, disembarking, investigating, boarding and departure, with JSON state alongside it. The three `spacecraft-{saucer,lander,scout}.png` files show enlarged crews in deliberately empty review fixtures. Browser inspection uses naturally generated clearings instead. Tests cover complete timed visits, varied signed-coordinate landing sites, aborts/clearance, planted turns/blocked strides, exact codecs and chunk sleep, asset bounds/budgets/fingerprints, and scene composition. Headless images do not by themselves verify browser presentation.

The initial implementation passed all 195 tests and the CPU benchmark. All three directional sheets and visit sequences were inspected. Live WebGL and Canvas checks showed the scout and its exploring crew in the natural seed-2718 clearing near (46, -29.4); the Help command also worked at a 390 × 844 mobile viewport without horizontal overflow. Full timed departure and repeat-site behavior are covered by simulation tests. The resulting atlas is 4096 × 4092 (63.94 MiB decoded); benchmark timings do not measure GPU completion.

The sound/flight-effects and manual-call update passed 198 tests, a fresh build, audio/spacecraft previews and the CPU benchmark. Live WebGL verified Shift+U, sound enable and paused flight; a 390 × 844 Canvas view verified the tappable call command and flight presentation without horizontal overflow. Hum/chatter synthesis, phase gating, pause/mute, PCM budgets and shared-loop adapter behavior have headless tests; sound balance can be auditioned with the exported WAVs on the intended speakers.
