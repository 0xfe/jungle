# Tigers, hippos and bison

Three original articulated rigs add occasional wildlife to the mixed artistic jungle. **J** includes their actual generated habitats; **H → Mammals** includes independent likelihood sliders. Normal builds remain offline. Each species has its own controller, owned RNG, prior motion samples and stable binary type: tiger **75**, hippo **76**, bison **77**.

- **Tiger:** rare solitary candidates (0.7% × animal density, reduced in open canopy), mostly resting or patrolling. Eligible prey can prompt a slow stalk, a pursuit capped at 2.5 seconds, and a long recovery. The cat stops before contact; prey reacts through the pre-update snapshot. Roaring is a separate stationary action. Tigers usually avoid sanctuaries. The broad solitary behavior follows [Smithsonian's tiger account](https://nationalzoo.si.edu/animals/tiger).
- **Hippo:** one to three animals near shallow water and banks (4.5% × density candidates). Individuals linger in water, graze on the bank and choose bounded routes between the two, with stronger daytime water preference. Feet and body footprints respect physical water/bank fields and obstacles. Deep water and inland ground are excluded. Separate wading/wallowing artwork clips the submerged body at the waterline. This simplified behavior follows the [San Diego Zoo hippo account](https://animals.sandiegozoo.org/animals/hippo); it does not simulate underwater buoyancy or long-distance night migration.
- **Bison:** dry-ground herds request four to six spaced members (2.5% × density, biased toward open canopy). They graze on individual timers, regroup and sometimes make short herd runs. Followers refresh staggered destinations from the leader's current snapshot; the leader waits for stragglers. There is no hunting or stampede damage. Broad grazing/herd behavior follows [NPS bison ecology](https://www.nps.gov/yell/learn/nature/bison.htm).

Candidate rates are per owner chunk, subject to settings, habitat and room. Tigers remain solitary; a bison group may be smaller when placement cannot fit every member. Sleeping cached groups resume exactly; expired chunks regenerate initial populations. There is no durable migration/history or automatic persistence. World/agent schemas **26/21** reject older layouts explicitly.

## Art and motion

`scripts/art/megafauna-model.ts` contains original +X-facing pose producers: a striped orange tiger with white cheeks and an articulated tail, a broad-muzzled hippo with high eyes and ears, and a shaggy, humped bison with curved horns and a beard. Eight world headings include distance-driven walking, tiger stalking/chasing/roaring, hippo grazing/wading/wallowing and bison grazing/running. Roots and union bounds remain registered. All source geometry stays outside the browser bundle; retained OBJ files are static inspection exports, not runtime meshes.

The baker shares exact registered pixel pieces for the three new rigs and existing elephant/giraffe rest clips. Every frame reconstructs the original artwork without filtering or resolution reduction. Pieces stay contiguous in the transparent painter order. The shared atlas retains its 64 MiB limit; additional instances reuse the same regions.

Walking strides are calibrated from the authored foot excursion and stance fraction, including body scale. Animals turn before translating, brake near destinations, and stop their travel gait when blocked. Species use bounded owner territories; their group IDs, route state, timers, RNG, speed motor and interpolation samples survive exact binary continuation.

## Recorded sound

The real [“Tiger Roar” by lauramellis](https://freesound.org/people/lauramellis/sounds/263115/) was recorded at Louisville Zoo and released under CC0 1.0. The public HQ MP3 preview is retained in `assets/source/audio/tiger-roar.mp3`. The runtime uses the single roar at 0.75–2.75 seconds, converted to mono 16 kHz PCM16 with endpoint fades and 1.5× source amplitude. Exact conversion, source/download/license URLs and SHA-256 hashes are in [tiger-provenance.json](../assets/source/audio/tiger-provenance.json). Attribution ships with the site. Builds validate both hashes and never download or reconvert audio.

A nearby roaring tiger supplies one bounded audio-only caller; distance, wildlife volume, mute, pause, suspension and the existing voice/history caps all apply. Audio never consumes simulation RNG. `CONFIG.audio.sounds.tiger` exposes the standard recording controls. Elephant default per-sound gain rises from **0.7 to 1.15**; the master/wildlife settings and default mute are unchanged.

## Inspect and validate

- `npm run megafauna:preview`: directional action sheets, generated habitat PNGs and coordinates for all three species.
- `npm run zen:preview`: the smaller landing and independent monk routines.
- `npm run audio:preview`: retained tiger/elephant WAVs and the default forest audition.
- `npm run check`: builds, regression tests and snapshots.
- `npm run benchmark`: adds tiger, hippo and bison scenarios; CPU timings exclude GPU/rasterization work.

Regression coverage includes rarity/group admission, habitat/clearance, controls, stalking and non-contact recovery, water/bank residence, group running and grazing, blocked gait, exact continuation, every directional pose's margins and pixel-piece reconstruction, recorded PCM budget and mute behavior.

October 4 validation: `npm run check` passed all **219 tests** and wrote headless snapshots. Both preview commands and `npm run audio:preview` completed; all three directional sheets, generated habitats and four close-up monk entry/exit frames were inspected. The atlas is **4096 × 4068 / 63.56 MiB decoded**, with 39,766 unique frames; enabled shared PCM remains below 10 MiB. CPU benchmark p95 composition was **6.785 ms tiger / 5.675 ms hippo / 6.337 ms bison**, at peak 8,220 / 8,491 / 7,615 quads respectively on this machine. Browser QA could not run because the browser connection became unavailable; these timings and software renders do not verify Canvas/WebGL interaction or device audio balance.
