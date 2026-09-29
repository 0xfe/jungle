# Wildlife and living landscape accents

Sound now starts muted on every platform. The speaker explicitly enables it; navigation and gestures retain mute. `?` / H opens the guide even with the menu hidden, revealing its toolbar. Touchscreens accept two nearby taps within 350 ms to show the menu. Drags, pinches, cancelled touches and long presses do not qualify. Enter/Return still toggles controls.

## Bears and zebras

Black bears retain their quadruped walking and ground foraging. A reachable tree approach can now lead to a 1.4-second rise, an upright pause, repeated picking, and a registered lowering clip. The head stays level, hind feet stay planted, and the last pick finishes its cycle before lowering. Perches can expose their actual root separately from their landing offset. Bears target that root, face it before rising, and lower if the support disappears. Bounded searches fall back to ground foraging when trunks cannot be reached. Mothers/cubs retain their existing waiting/following rules. Tree target and support coordinates serialize exactly.

`ZebraAgent` owns stable type **59**. Two or three individuals form a dry-woodland herd. They alternate grazing and walking, followers refresh their leader-relative destinations, and the leader waits for distant members. They avoid water and wet forest, turn before moving, brake on arrival and stop their walking cycle when blocked. The authored equid rig includes striped coat, upright mane, muzzle, ears and hooves. A 0.585 model-unit foot excursion over 68% stance matches the 0.19-tile body-scaled stride. This is stylized herd behavior, not a migration or reproduction simulation.

Giraffe model height increases **16%**, keeping ground-plane dimensions and stride unchanged. Shared mesh vertices transform once so adjoining triangles cannot multiply the stretch.

## Elephant sampling and texture budget

Elephants now have **24 headings**, with **8 rest / 24 walk / 36 drink / 24 spray** frames per heading: **2,208 logical frames**, up from 1,088. One-shot endpoints and quantized trunk-tip effects stay registered. Elephants finish large turns before translating.

More poses trade some texel density for smoother motion: elephant baking uses 17.5 pixels/model-unit, displayed at the previous logical scale of 21. Legacy individual foliage used by the finite fixture uses half-resolution nearest-neighbor texels while retaining all 32 poses, anchors and logical size. The streamed compound landscape sources keep their resolution. Shared atlas limits remain 4096 × 4096 / 64 MiB, with transparent gutters and exact frame deduplication. All source art and models remain retained.

## Small animated overlays

`assets/source/landscape-accents.png` contains generated flowers, berry fern, butterfly and leaf/twig artwork. Exact built-in image-generation and background-cleanup prompts, plus the retained first reference, are in `assets/accents-prompts.json`. The offline baker isolates four equal cells, removes translucent fringes and samples nearest-neighbor into four shared atlas sprites. No live generation is needed to build.

Selected land components receive a small rooted flower or bush overlay. A subset also carries fluttering butterflies or drifting leaf/twig sprites. Plants sway around their roots; butterfly wings fold continuously; falling leaves fade at the loop boundary. These are decorative components, not new simulation species or per-leaf entities. Their bounded count follows visible compound arrangements, using each owner's interpolated/checkpointed clock. They follow sampled ground height, skip water, retain painter depth, and do not consume behavior RNG or allocate textures per instance. `CONFIG.world.patches.accentCoverage` controls coverage.

World schema **16** and agent schema **13** reject earlier saves. Sleeping cached agents resume; expired chunks regenerate initial populations. No durable migration/history or automatic persistence is implemented.

## Review

`npm run check` rebuilds the atlas, typechecks, tests and writes scene snapshots, including zebra habitat. `npm run assets:preview` writes all headings/actions for bears, zebras, giraffes and elephants. `npm run patches:preview` shows the landscape overlays; `npm run benchmark` measures CPU work, excluding GPU completion. Browser inspection must cover both WebGL and Canvas, hidden-menu Help, sound, keyboard travel, mobile layout and touch interaction where available.

The reviewed atlas contains 13,673 logical / 11,508 unique frames in 4096 × 4032 pixels (**63.0 MiB decoded**, about 2.89 MiB PNG). CPU-only benchmark p95 simulation/composition on this host: opening forest 1.01/2.77 ms, mature forest 1.19/4.24 ms, wide rain 3.38/12.29 ms; travel stream maximum 19.73 ms. These are local measurements, not GPU completion or device-independent guarantees.

Browser review on this host covered WebGL desktop and Canvas at a 390 × 844 viewport, hidden-menu Help, mute/unmute, drag, keyboard/landscape travel and minimum zoom. The mobile guide remained scrollable and controls fitted within the viewport. Double-tap recognition, drag/pinch exclusion and cancellation are headless-tested; physical-phone touch delivery was not verified because the available browser connection has no touch-injection control.
