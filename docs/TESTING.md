# Testing and debugging

```sh
npm run check
npm run benchmark
npm run assets:preview
```

`check` rebuilds assets, runs strict TypeScript checking, bundles the static site, runs **50 headless tests**, and writes actual RGBA-rendered PNG/JSON snapshots. It requires no browser, display, native Canvas package, GPU or generation service. CI in `.github/workflows/check.yml` runs the check on Node 22 and uploads `artifacts/`; remote CI has not been run from this workspace.

## Coverage

Study 05 adds parent following, herd separation/alignment, predator acquisition and flight/recovery, social update-order independence, exact new-species codecs, canopy motion, sparse spawning, structural variants, litter placement and every new rig heading/action margin.

- Projection/inverse projection, negative coordinates, stable hashes, fixed timestep and 144 Hz interpolation.
- Actual RGBA compositing, clipping/mirroring/tint, stable painter order, atlas bounds/alpha/key removal, quad vertex encoding and sloping triangle inverse mapping.
- Deterministic finite-scene fixtures, weather, connected water, depth and long simulated animal movement.
- Shortest turns, forward displacement, stride registration, walk support and run suspension, transparent margins at every heading/clip, fixed roots and loop continuity.
- Independent pacing, bounded acceleration, faster running distance/cadence, bounded jerk, arrival braking, head transition endpoints and environmental easing.
- Every artifact's concrete class survives an exact binary round trip. Continued behavior/RNG/interpolation remains identical. Unknown/truncated data is rejected.
- Snapshot neighbor perception is independent of update order; nearby activity changes alertness.
- 338-byte chunk generation, negative chunk seams, all landscape types, deterministic regeneration and land-safe animals.
- Cache byte/count/distance limits, pinning, sleeping-state scrollback, intentional post-eviction regeneration and exact world checkpoint continuation.
- Long travel through 200 positions stays bounded; distinct world counters remain fixed-size and ignore repeated visits.
- A distant camera stays numerically local and has ground coverage throughout the viewport.

The renderer isn't a mock that just records `drawImage`: tests and snapshots sample real sprite/terrain pixels. GPU and Canvas edge rounding/antialiasing can differ, so software images don't certify browser presentation.

## Inspectable artifacts

`npm run snapshot` writes:

| Artifact | Purpose |
| --- | --- |
| `expedition-forest.png`, `expedition-dry.png`, `expedition-hills.png`, `expedition-lake.png` | Current streamed landscapes after three simulated seconds |
| Matching `expedition-*.json` | Seed, camera, statistics and complete submitted frame |
| `rainforest.png`, `flowering.png`, `wetland.png` and JSON | Retained 16-tile regression fixture |
| `animation-strip.png` | Finite fixture contact strip |
| `deer-directions.png` | Six action rows × sixteen headings, via `assets:preview` |
| `deer-walk-strip.png`, `deer-run-strip.png` | Full locomotion clips at four representative headings |
| `wildlife-{deer,toucan,orangutan,jaguar}.png` / JSON | Current sparse wildlife habitats and instance state |
| `{toucan,orangutan,jaguar}-directions.png` and action strips | New rigs in sixteen headings and successive poses |
| `benchmark.json` | Streaming/simulation/composition/encoding profiles and cache counters |

For a reproduction, record seed, preset, weather, camera, simulation ticks, cache policy and input path. Per-agent RNG is serializable; use `jungleAgents.encode/decode` or `InfiniteWorld.checkpoint/restore` when exact behavior continuation matters. A screenshot or seed alone does not preserve a herd that has already moved.

## Browser checks

1. Build, serve, open http://localhost:4173. The canvas fills the screen and controls overlay its bottom. The jungle fills the viewport and drifts continuously; no finite soil border appears.
2. Open `?`. World size/rendered estimates grow with travel; resident and active counts are bounded; expired totals rise after sufficient travel. GB is labeled estimated and JS heap is separate/optional.
3. Arrows/WASD/drag pan; Shift travels faster. N/Explore visits dryland, meadow, water and forest. Home returns to the starting forest; +/- and wheel zoom.
4. J/Wildlife cycles animal habitats and stops drift. Check fawns near adults, perched/flapping birds, tree-climbing apes and solitary cats. R changes the seed. Habitat buttons/1–3, weather/T, pause/resume and guide controls work. Reduced-motion preference starts paused.
5. Check `?renderer=canvas`, particularly sloping terrain/shorelines and alpha edges. Compare against WebGL and headless snapshots.
6. Check mobile 390×844, desktop and resize. Guide statistics and keyboard-command disclosure must remain reachable. Inspect console warnings/errors.

## Validation record

The current 50-test suite passed on the development Mac, including compact checkpoints and bounded long travel. A failed checkpoint-continuation test caught active state not being flushed before encoding; it was fixed and the continuation test now passes. Headless world images and browser landscape transitions were inspected. Device-specific performance measurements and limitations are in [PERFORMANCE.md](PERFORMANCE.md).

Study 05: desktop WebGL, Canvas fallback, mobile 390×844 layout and toolbar controls were exercised. The mobile WebGL check showed 60 FPS and 3.6 ms CPU p95 on this machine. The mobile guide and bottom toolbar were corrected after visual inspection. Study 04 fixed Canvas tint-cache churn. With Study 05's larger atlas and full-screen scene, Canvas initially dropped to 2 FPS on this host; compact terrain sources and DPR 1 improved the checked fallback to 28 FPS / 33.8 ms CPU p95. Dense full-screen Canvas still runs slower than WebGL. These observations are device-specific, not performance guarantees. A signed-coordinate hash collision regression also guards the procedural fields and distinct-world counters.

Historical studies passed 14, 21 and 27 tests respectively; their fixed-island FPS/population counts are not current streamed-world benchmarks.

## Common issues

- Missing `dist/` or stale code: run `npm run build`, then serve and refresh. The server doesn't watch files.
- `file://` loading fails: use the local server for module/manifest requests.
- Port in use: `PORT=8080 npm run serve`.
- Unknown sprite/key validation error: inspect source/manifest provenance; don't silently substitute empty frames.
- Unsupported checkpoint version: add an explicit migration rather than interpreting new layouts as old records.
- Active chunks exceed budget: increase the supplied cache budget or constrain the requested viewport; don't disable pinning or silently exceed the cap.
- Visual mismatch: record renderer, viewport/DPR and zoom; compare Memory, Canvas and WebGL.

## Study 06 regression coverage

`tests/ecology.test.ts` adds exact continuation for all eleven concrete classes, tree-anchored swing arcs, fish cohesion and dry-shore rejection, whale submerged/surface duty cycle, beach-only crab travel, all-species landmark/habitat generation without inflated world counters, coherent upright groves/subtle litter, and transparent margins for every new rig heading/action. `npm run snapshot` now writes habitat PNG/JSON pairs for all 15 animal species; `npm run assets:preview` writes the new directional/action contact sheets. Whale scene snapshots advance to a visible breathing phase.

Study 06 validation: the full build/test/snapshot check passed, followed by the additional marine-composition regression and typecheck (59 tests total). Browser checks exercised the 15-species wildlife tour, desktop WebGL and Canvas, weather controls and the 390×844 mobile toolbar/guide. No console warnings or errors were reported. Local samples were 60 FPS / 8.9 ms CPU p95 in a desktop land view, 58 FPS / 13.8 ms at the whale coastline, and 60 FPS / 8.5 ms in the mobile bird view. Full-screen Canvas was 25 FPS / 38.8 ms in the checked land view; it remains a slower fallback. These are scene/device-specific observations, not guarantees.

## Study 07 controls, terrain and sound

The full check now runs **66 tests**, builds the static site and produces inspectable PNG/JSON snapshots. New tests measure forest-heavy defaults, abundance and lake scale, zero-population settings, default wildlife increase, settings checkpoints, signed seam continuity, material/habitat agreement, contour UV registration in Memory/GPU buffers, deterministic PCM/headroom/DC/loop joins, audio layering/spatial events, bounded history, lazy Web Audio initialization, shared loops, gain ramps, voice limits and disposal via an injected context.

Desktop/mobile browser checks exercised world slider changes, reset, audio startup/mute, environment volume, pause/resume and rain controls. The mobile panel scrolls independently above the toolbar. Canvas and WebGL were inspected for the new contours; no console warnings/errors were reported in these checks. Sound startup/control wiring was verified, while subjective balance should be auditioned on the target audio device. `npm run audio:preview` writes six stereo WAVs under `artifacts/audio/` for this purpose.

## Study 08 forest validation

`npm run check` passes **71 tests** and regenerates landscape/wildlife PNGs and draw lists. New botanical coverage checks cross-cell/negative-boundary spacing, absence of a cell-edge exclusion band, root registration under asymmetric mirroring/lean/scale, within-stand form/size variation, exact plant/checkpoint continuation, chunk visitation-order independence, complete atlas form inventory and memory budget, pinned vine attachments and removal of disconnected source fragments. Existing wind-loop, codec, habitat, animal and renderer tests remain green.

`npm run plants:preview` writes `artifacts/plant-forms.png`. Inspect full silhouettes, root baselines, small detached fragments and variation at native scale. Browser QA checked WebGL and Canvas affine plants, travel/landscape jumps, zoom, pause, console logs and the desktop settings overlay. The browser viewport override did not change the captured viewport on this pass, so mobile UI validation was not reconfirmed; its prior Study 07 check is historical. The UI and source sheet are visually reviewed; automated tests do not certify botanical realism. Updated CPU profiles are in [performance](PERFORMANCE.md).

## Study 09 motion validation

`npm run check` passes **75 tests**. The new rhythm tests verify powered/glide timing, continuous phase, faster climbing beats, lift and descent, independent pacing, exact controller/agent continuation, a low monkey swing duty cycle, and absence of crabs/stone terrain even at maximum settings. The swing constraint test checks a fixed rope length throughout the arc, bounded excursion, return to the same support, cooldown and refusal to swing without a tree. Directional rigs retain clear margins.

Inspect `npm run motion:preview` for visible hand-to-vine registration, plus `npm run assets:preview` for the revised monkey and gull action strips. The supported-swing fixture deliberately triggers the rare action; ordinary habitat snapshots retain normal state selection. Older Study 06 crab/ridge images describe superseded behavior.

Study 09 browser checks covered WebGL gull flight, Wildlife navigation (14 active species), zoom, Canvas rendering, and the renamed Hills setting, with no reported console warnings/errors. The source contact strips and staged in-memory swing sequence were inspected. Mobile layout was unchanged and not revalidated.

## Study 10 pack and performance validation

`npm run check` passes **83 tests**, builds the static site and writes fresh PNG/JSON snapshots. `tests/packs.test.ts` covers parent-following cubs, independent pacing, adult run bouts, pack cohesion, order-independent decisions, exact mid-run continuation, solitary jaguar runs, acceleration/braking and displacement-to-gait coupling. Generated populations are checked for adult groups, occasional cubs, valid parent IDs and separated spawn positions. Existing tests inspect every wolf heading/action for clipping and every atlas animation for distinct pixels.

Additional regressions ensure wind preserves the registered source palette, shelves backfill with gutters intact, and uniform terrain shortcuts match scalar interpolation (including a mixed shore/scrub trap). The atlas remains below 64 MiB. `npm run assets:preview` includes `wolf-run-strip.png` and the third row of `wolf-directions.png`; `wildlife-wolf.png` is a normal habitat snapshot.

Final browser QA covered the 250% limit and disabled zoom button, wolf habitat navigation, rain, keyboard travel, both renderers and the mobile field guide/toolbar at a verified 390×844 viewport. No console warnings/errors were reported. Dense Canvas remains slow; measured stage costs and benchmark comparisons are in [performance](PERFORMANCE.md).

## Study 11 elephant and presentation validation

`npm run check` passes **89 tests**, builds the static site and writes fresh PNG/JSON snapshots, covering the new elephant model, shared trunk poses and interaction state. `tests/elephants.test.ts` checks dry-footed reachable drinking, fill-before-spray, recipient escape/blocked turns, cooldowns, deterministic update order, exact mid-action codec continuation, water-biased families and naturally occurring drinking/spraying in an unstaged generated world. Existing all-heading bake and atlas tests check frame margins, distinct animation pixels and the 64 MiB limit.

`npm run elephants:preview` produces a deliberately cleared shoreline fixture with six drinking/spraying poses and individual PNG/command-JSON captures. Review this alongside `npm run assets:preview`: it exposes trunk-to-water and nozzle-to-droplet registration that dense foliage can obscure. It does not replace behavioral tests.

Browser validation covers the initially unobstructed scene, Enter/Return reveal/hide, the new infinity title, settings restored after hiding, WebGL and Canvas, and the 390×844 mobile overlay layout. DOM checks verify hidden/inert controls; screenshots verify that no visible overlay remains. See [elephant design](ELEPHANTS.md) for reproduction and limitations.
