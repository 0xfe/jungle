# Zen sanctuaries and the hidden world editor

**Shift+Z** visits the nearest eligible sanctuary and stops automatic travel. **P** resumes travel. **H** toggles the hidden artifact editor; five short, nearby touchscreen taps also toggle it. `?` continues to open the field guide. The editor has no toolbar button. Its native expanding groups and labeled sliders work with keyboard and touch; Escape closes it.

## Generation and settings

Sanctuaries are seeded rare candidates in 96-tile ownership cells, with independent jitter, three temple designs and wide separation. Candidate frequency defaults to 0.32 before clearance rejection. They avoid volcanoes and existing rivers, rather than blocking river connections. A six-tile interior blends back into the surrounding terrain over two tiles. The temple and walking court are level; the separately offset elliptical pond uses the same half-tile fields, contour split and signed-coordinate heights as normal water. Native terrain colors and shoreline feathering give it a continuous edge. Garden sites occur away from the opening.

`src/jungle/zen-sites.ts` plans independent cherry/maple/pine trees, irregular flower clusters, lotus colonies and four watering beds. A front viewing corridor and inner walking court remain clear. Pink blossoms predominate, with orange and green companions. Layouts depend on site seeds and template form; they are neither a single scene bitmap nor an identical group at every site. Existing compound vegetation clears the inner garden. Garden trees enter the normal trunk/perch index. The index and plant layouts rebuild only when streamed membership changes.

The hidden editor groups all generated kinds into landmarks, gardens, vegetation, mammals, birds, and water/reptiles. Percentages multiply the default admission rate, rather than promising exact area coverage. Vegetation can be thinned from 100% to 0%; other groups reach 300%, subject to saturation, population caps and habitat rules. Sanctuary resident controls scale the bounded resident counts. Zero removes the selected kind. Spacecraft controls affect natural admission; the explicit Shift+U call remains available. Normal Settings still owns landscape water/size/relief and overall animal/plant density. Garden populations are independently controlled; Water = 0 also removes garden pond water, lotus, koi, ducks and pelicans.

Changes debounce for 250 ms, regenerate the same seed and clear scrollback; they preserve the camera and weather. Navigation flushes any pending slider change first. The editor's reset affects only artifact probabilities. Settings' reset affects only its landscape sliders. Controls live for the page session and in headless checkpoints; automatic browser storage is not implemented.

## Inhabitants and motion

`ZenGardenAgent` (type 70) owns at most 33 residents, with a separate class and binary tag for each kind: monk 71, koi 72, duck 73, pelican 74. Defaults are five monks, seven koi, three ducks and two pelicans. Appearance varies in palette and pose; three distinct pagodas, three generated tree species, three flower forms and three lotus forms are shared across sites.

Monks have staggered exits, seated breathing meditation, flower watering with a visible can and droplets, a common circular procession and a return to the registered doorway. Their repeating 220-second routine advances only on simulation ticks. Travel turns first, brakes on arrival and advances the walking pose by accepted distance. Koi follow individually phased loose circuits; ducks alternate paddling, dabbling and preening. Pelicans slowly approach koi, watch and dip their bills with a splash. Koi dart in response to the pre-update pond snapshot; no agent mutates another and fish are not removed or killed. Every resident owns serializable RNG, prior presentation samples and timers.

The sanctuary strongly reduces ordinary wildlife admission. Deer, zebras and birds have greater visitor retention than other animals. Most jaguars, wolves, bears, crocodiles and boas also reject the refuge when selecting/moving to destinations; a small individual exception remains, so it is not an absolute magic barrier. Birds can use the garden's real tree supports. Ordinary fauna retains its existing territory and social behavior.

The sanctuary owner sleeps with its chunk. It resumes exactly if cached and regenerates its initial population after expiry. Residents remain owned components, not migrating world agents. There is no durable history or automatic persistence. World/agent schemas are now **23/19**; older checkpoints fail explicitly. Accounted memory adds 512 bytes per nested resident beyond the existing owner allowance, plus bounded static garden layouts. Site memoization caps at 128 entries.

## Artwork and audio

Original generated source trees are retained at `assets/source/zen-{cherry,maple,pine}.png`. The exact three prompts and built-in ImageGen provenance are in [zen-prompts.json](../assets/zen-prompts.json). Existing generated flower sources are reused with their original provenance. The pagodas, lotus and separate directional monk/koi/duck/pelican rigs are code-native sources in `scripts/art/zen.ts`, baked offline. Normal builds never call image generation.

The temple has tiled curved roofs, finials, lattice walls, an open doorway and steps; three designs vary roof palette and tier count. Hanging lamps sway and glow, petals drift, the pond sparkles, pads bob, flowers rustle, and trees sway continuously around their roots. The new trees use one registered bitmap plus continuous rooted deformation, matching the compound-landscape approach. Residents and lotus blossoms use generated pose frames. Rigid architecture is held still; its lamps supply the live motion.

Lossless registered pieces share repeated pixels between small resident frames and temple surfaces. Temple pieces use 4×4 source regions; residents and spacecraft use 2×2 regions. All pieces retain the same whole-clip root and frame order. The full new trees and lotus use whole sprites to keep draw counts bounded. This preserves every source pixel, transparent gutters, painter order and a single shared atlas. No per-instance textures, additional texture page or runtime mesh rig is created. Exact reconstruction tests check the pieces against every original pose. Source files and all build dependencies participate in cache fingerprints.

A localized original `zen` sound adds soft flute-like pentatonic tones and a resonant bowl near a temple. It fades with distance through the Environment volume and respects master mute, pause, visibility, suspension and per-sound `SoundTuning`. One shared 8 kHz mono buffer contains the low-register music, keeping the entire enabled bank under 10 MiB. The synthesizer and audition exporter use the same compact PCM. No recording or third-party music is used. Audio never consumes behavior RNG.

## Inspect and validate

- `npm run zen:preview`: separate artifact contact sheet, four scene stages and inspectable resident state JSON in `artifacts/zen-*`.
- `npm run audio:preview`: includes `artifacts/audio/zen.wav`.
- `npm run check`: normal complete build, regression suite and snapshots.
- `npm run benchmark`: includes a pagoda alongside forest, wide view, travel, volcano and spacecraft scenarios. This measures CPU work, not GPU completion.

Tests cover rarity/variety, level ground, real pond habitat, signed seams, every disabled artifact kind, exact individual/owner/checkpoint continuation, sleep/resume, all monk activities, pelican/koi reactions, five-tap cancellation, proximity/mute sound and lossless art reconstruction. Browser review additionally checks WebGL and Canvas, the hidden controls, navigation and a narrow viewport. Actual touchscreen hardware and subjective audio listening remain separate from synthetic gesture tests and PCM checks.

Validation on 2026-10-04: the complete 208-test check passed, followed by 12 focused audio/sanctuary tests after the final sound tuning. The atlas is 4096 × 4088 (63.88 MiB decoded). This machine's pagoda benchmark submitted 6,160 quads, with p95 simulation/compose/encode times of 1.393/8.176/3.726 ms; these are CPU-only observations, not frame-rate guarantees. WebGL and Canvas review covered landmark jumps, 65% zoom, accelerated keyboard navigation, the grouped editor, zero/default probability behavior and a 390 × 844 layout without horizontal overflow. Browser warnings/errors were empty during those checks. The watering snapshot was reviewed after moving the monks to the visible edge of the flower beds.
