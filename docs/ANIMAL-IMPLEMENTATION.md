# Wildlife implementation tracker

Implements the recommendations in [ANIMAL-REVIEW.md](ANIMAL-REVIEW.md), following its five phases. Counts describe verified work, not lines changed. The original review remains the baseline; this file records completion and evidence.

## Phase checklist

- [x] 1. Core activities: giraffe browsing/gait, boar rooting, kingfisher fishing, beaver feeding, gull shore walking/pecking (5/5).
- [x] 2. Transitions: bison/zebra/hippo feeding, bank entry, tiger posture, bird takeoff/landing/perch grip.
- [x] 3. Individual variety: stable visible coats/patterns, body/feature forms and young/adult differences across the catalog.
- [x] 4. Social/environmental detail: remaining species activities, family waiting/play, supported climbing, curved fish/bird routes, pond residents and environmental responses.
- [x] 5. Visible animation detail: more directions/frames where useful, calibrated cadence, complete source/pose/browser review and scale validation.

## Species acceptance (31/31)

A species is checked only after its full review row is addressed and validated. Existing artistic non-contact encounters and bounded chunk ownership remain intentional.

- [x] Black bear
- [x] Deer
- [x] Zebra
- [x] Bison
- [x] Hippo
- [x] Elephant
- [x] Giraffe
- [x] Wolf
- [x] Tiger
- [x] Jaguar
- [x] Boar
- [x] Squirrel
- [x] Beaver
- [x] Crocodile
- [x] Toad
- [x] Boa
- [x] Small snake
- [x] Monkey
- [x] Orangutan
- [x] Toucan
- [x] Macaw
- [x] Parakeet
- [x] Kingfisher
- [x] Seagull
- [x] Hawk
- [x] Vulture
- [x] Fish
- [x] Whale
- [x] Koi
- [x] Duck
- [x] Pelican

## Validation log

Baseline: commit `5627cde`, 227 tests, 63.94 MiB decoded atlas. No population increases are planned.

### Phase 1

Five core activities implemented with species-specific targets and shared transition mechanics. Seven focused activity/crossing tests pass. The full suite initially passed 231/232; the kingfisher crossing regression was then fixed and its tests rerun successfully. Chrome packed-pose, WebGL/Canvas, navigation and 390-pixel mobile-layout checks produced no runtime exceptions. The CPU benchmark completed; peak quads increased (bear scenario 3,714 to 4,850) as a measured cost of exact pixel sharing. Atlas 47.75 MiB, down from 63.94 MiB without reducing source resolution. The manifest is minified for delivery. Final full-suite and benchmark results will supersede these intermediate measurements.

### Phase 2

Six transition groups implemented. Nine focused transition/social/flight tests and eight resting/raptor tests pass. Feeding, folded wings, tiger crouches and both hippo forms have pixel-identical registered endpoints in every heading. Vultures now distinguish aerial approach from wing folding and unfold before departure. Chrome packed loops inspected bison, zebra, hippo, tiger and small birds; the final atlas/browser pass will include the additional vulture clips. Intermediate atlas 56.13 MiB.

### Phase 3

All 31 types have distinct authored visible forms, including native pond palettes and stable size variation. Age-aware forms cover deer, giraffes, elephants, wolves and both primates. The packed atlas is 37.69 MiB through exact pixel sharing, with no resolution reduction. Four packed variety sheets were inspected. Full `npm run check`: 240/240 tests pass, plus typecheck, build and snapshots. Chrome validation and final performance measurements are recorded with the final acceptance pass.

### Phase 4

Eight implementation groups: family mammals; primates; canopy birds/raptors; bank animals; snakes; open-water swimmers; pond residents; large-animal secondary gestures/environmental effects. Species own the triggers and targets; the shared action clock only advances registered planted clips. New routes, action phases, water-entry state and appearance remain binary-serializable. Existing non-contact pursuits and sparse populations are retained. Focused tests: 20/20 pass, including all new planted actions and their endpoints, elephant waiting/browsing, fish lead/escape and pond containment. Ducks may now visit the immediate dry bank; the containment regression explicitly checks this allowed state. Final rendered and full-suite validation follows.

The intermediate full suite passed 242/246 tests. Two scheduling defects (monkey feeding reused the swing cooldown; birds always preened before a first flight) were fixed, with 8 rhythm/crossing/occupancy checks then passing. Two older expectations were updated to require a real squirrel support and recognize deer grooming. The atlas was 45.38 MiB. Chrome packed-animation inspection covered the new mammal, bird, snake, swimmer and pond actions without runtime exceptions.

### Phase 5

Large 8-heading mammals now use 16 headings and 32 walk/run samples. Wolves, river animals, snakes, fish, primates, hops and whale surfacing receive targeted additional poses; tiny parakeets and toads retain eight headings because their small silhouettes remain readable. Rest transitions use 16 directions/poses. Primate stance and climbing cadence follow distance. Whale strokes use their own aquatic cadence, and the surfacing body pitch follows the breathing phase.

Bear approaches use bounded footprint-checked curves, followed by registered stopping clips sampled from walk/run phases. Each paw returns through a small lifted step; the root stays planted. Muzzle and ear forms remain distinct. Static pixel layers reduce draw/metadata overhead; changing pixels retain lossless tiled sharing. Tests compare every byte at native and fractional display scales. Analytic margin checks cover every authored ecological pose/form at every possible heading; stop endpoints match sampled gaits and planted rest.

## Catalog implementation details

| Group | Implemented behavior and artwork |
| --- | --- |
| Bear, deer | Grounded bear walk/run/settle/curves; deer chooses vegetated grazing targets, grooms and plays near a parent; adult/fawn/feature forms. |
| Zebra, bison, hippo | Feeding transitions; cohesive sparse herds; extra headings/gaits; bison shoulder weight and small dust flecks; hippo gradual submergence, ear/nostril detail and yawning. |
| Elephant, giraffe | Real foliage browsing with registered trunk/neck motion, calves/family spacing/waiting, stable age/build/pattern forms; elephant water nozzle remains unchanged. |
| Wolf, tiger, jaguar | Wolves sniff, groom, rest on the ground and cubs play; cats stalk through posture transitions, groom and lie down; jaguars may feed at already-existing scavenging remains. No new kills or wolf hunting. |
| Boar, squirrel, beaver | Rooting, supported squirrel climbing/feeding, beaver gnawing/grooming/wakes and gradual bank entry; detailed coat/tusk/tail forms. |
| Crocodile, toad, snakes | Basking/alert and gradual waterline changes; toad breath/throat/feed/hop poses; snake tongue investigation, planted head-led bends and finer support/travel poses. |
| Primates | Separate feed/groom/play actions, grounded approaches before climbing, actual supports and distance-driven contact cadence. Rare monkey swings retain their fixed support and cooldown. Orangutans transfer along the retained tree's short root-to-perch branch and reverse it before descending; there are no unsupported canopy leaps. |
| Canopy/shore birds, raptors | Preen/feed, wing-fold/foot-grip transitions, shore steps/pecks, actual-water kingfisher dives, less regular raptor courses and multi-frame hawk tuck/recovery. |
| Fish, whale | Moving school leads, separation, bounded escape and feeding; whale vertical fluke propulsion, curved courses and breathing-phase surface pitch; native fin/pattern/body forms. |
| Koi, duck, pelican | Independently chosen contained routes and feeding/dip phases; koi avoid active bills, ducks paddle/dabble/preen and visit the immediate bank, pelicans settle/watch/dip from varied fish-directed locations. |

Artistic limits remain explicit: anatomy is authored rather than motion-captured, local curves are not full pathfinding, and ecology remains non-contact. No populations were increased. Sleeping cached agents resume; expired chunks regenerate their initial populations. No durable migration/history or automatic persistence was added.

## Final acceptance evidence

`npm run check` passes **255/255 tests**, typechecking, the site build and headless snapshots. The subsequently added bear obstacle-curve/exact-continuation test also passes (**256 checked cases total**). Four focused archive/cache/pixel checks pass after the final packaging changes. All ordinary animal forms and action margins are covered, with endpoint, habitat, social, timing and binary-continuation regressions.

Chrome loaded all **31 packed action previews** and completed a **29-stop habitat tour** (28 ordinary types plus the pagoda). WebGL and Canvas, keyboard/Shift movement, wide zoom, landscape jumps, help and a 390×844 mobile viewport passed without runtime exceptions or horizontal overflow. Packed variant sheets and representative action/context screenshots were inspected. The connected-browser list was empty, so checks used an isolated **Google Chrome** profile, not another browser. These checks are not physical-phone testing or GPU timing; the habitat tour verifies navigation/rendering, not every rare behavior occurring on camera. Seeded simulation tests cover those behaviors.

The final atlas is **4096×2768 / 43.25 MiB decoded**, with **324,498 unique images** shared by **14,467,947 logical piece-frame references**. No source resolution or authored pose was dropped. Exact stationary layers, interned moving pixels and shared registered timelines keep the expanded catalog within the 64 MiB budget. The browser receives **17.64 MiB compressed metadata** (105.51 MiB packed JSON); the 302 MiB expanded inspection JSON is generated locally from a retained compressed archive. This remains a substantial fixed metadata allocation, not a claim of negligible browser memory.

### Final scale measurements

`npm run benchmark` completed all 11 scenarios on darwin/arm64 with v26.9.0. Chrome and competing build/test jobs were stopped for this CPU-only run. Values exclude GPU rendering, uploads, browser scheduling and display.

| Scenario | Peak quads | Simulation p95 (ms) | Composition p95 (ms) | Encoding p95 (ms) |
| --- | ---: | ---: | ---: | ---: |
| forest | 5,902 | 1.146 | 5.187 | 0.983 |
| outer-forest | 9,860 | 1.278 | 5.445 | 1.993 |
| wide-rain | 19,990 | 3.655 | 13.050 | 5.318 |
| travel | 12,138 | 0.734 | 6.358 | 2.583 |
| volcano | 8,581 | 2.472 | 7.215 | 3.687 |
| spacecraft | 7,649 | 1.103 | 7.943 | 3.179 |
| pagoda | 9,252 | 1.184 | 8.920 | 4.241 |
| tiger | 13,883 | 1.459 | 10.685 | 5.587 |
| hippo | 10,513 | 1.583 | 8.164 | 4.378 |
| bison | 12,780 | 1.818 | 9.102 | 5.033 |
| blackBear | 6,875 | 1.124 | 6.113 | 3.228 |

The bear scenario increases **3,714 → 6,875 peak quads** versus the recorded review baseline. Its simulation p95 is 1.124 ms, composition 6.113 ms and encoding 3.228 ms. The wide-rain case is heavier (13.050 ms composition and 5.318 ms encoding); these are not claims of universal 60 fps. Additional forms and exact small pixel pieces trade more CPU submissions/metadata for a bounded single texture. Populations remain unchanged and painter order is preserved. The cold cache remains below 0.4 MiB accounted in these scenarios; travel expires old chunks.

Final build inventory/checksums pass. A clean-checkout-style test removed the local inspection JSON, restored it through `npm run assets`, and compared it byte-for-byte with the original; the asset cache then validated without rebaking. All retained producer/model/atlas/archive hashes are current.
