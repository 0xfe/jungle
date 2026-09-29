# Families, flocks and individual wildlife — Study 06

The jungle is now a full-screen world with a floating bottom toolbar, hidden with the other overlays until Enter/Return is pressed. **J** visits deer, monkey, wolf, giraffe, elephant, seagull, fish, whale, macaw, parakeet, kingfisher, boa, small snake, squirrel, boar, beaver, crocodile, toad, toucan, orangutan and jaguar habitats in sequence, pauses camera drift for three seconds, and leaves simulation running. **N** still visits landscape types. The guide counts active animals separately from plants/water/motes and reports the number of deer families.

## Social structure

Species have different social rules. Deer form families of 3–5, including a smaller fawn attached to an adult. Toucans occur in groups of 2–3. Orangutans occur alone or as an adult with young; jaguars remain solitary. This is an artistic mixed jungle, not a geographically accurate community.

`src/agents/social.ts` contains reusable `SocialMember`, `SocialIntent`, and `herdIntent` contracts. Membership includes stable group, leader and optional mother IDs. Perception snapshots include heading, speed, group, juvenile status and alarm. A member combines cohesion, forward-motion alignment and close-range separation, with stronger parent-following for juveniles. Leaders choose exploratory destinations while followers keep up; leaders return toward distant stragglers. Members retain their own timers and pace, rather than marching through one shared animation phase.

The model draws on [Craig Reynolds' separation, alignment and cohesion behaviors](https://www.red3d.com/cwr/boids/), adapted to intermittent grazing and family following. Orangutan social grouping follows the broad solitary/mother–offspring pattern described by [Smithsonian's National Zoo](https://nationalzoo.si.edu/animals/orangutan); it does not treat every species as a herd animal.

The common agent library knows no jungle species. The application decides which neighbors are threats and which terrain/perches are suitable. Group IDs and family relations serialize with each animal, so there is no unbounded global herd table to synchronize or retain after cache eviction.

## Behavior and animation

| Species | Behavior | Visual source and movement |
| --- | --- | --- |
| Deer | Graze, look, follow family, catch up, flee nearby jaguars, wolves, boar and shared alarm; fawns follow a mother | Existing 16-heading articulated model; individual size/coat, smaller juveniles; stride distance scales with body size |
| Toucan | Rest in canopy, move between perches, follow flock activity | Large bill, throat, eyes, tail, feathered wings and feet; 16-heading rest/flight loops; flight altitude rises and settles smoothly |
| Orangutan | Long rests, slow arm-supported travel toward trees, climbing and feeding-height pauses; juvenile follows adult | Long arms, short legs, orange body, face/hands; separate travel and alternating climbing-arm poses |
| Jaguar | Rest/patrol, detect nearby deer, occasional brief pursuit, recovery | Low muscular torso, rosettes, rounded ears, long tail, distinct four-beat walk and faster bounding chase |

Jaguars consider nearby prey at throttled decision intervals. An eligible encounter has a chance of becoming a pursuit; pursuit lasts roughly 2.5–4 seconds and is followed by a 25–45-second recovery. Deer sense threats independently and can begin fleeing before a pursuit starts. Encounters stop short of contact; there are no kills or disappearing animals. Changing a target while moving uses bounded turning and slows forward acceleration when poorly aligned. Movement and stride phase use actual distance, including individual body scale. Wing beats and climbing have their own cadence.

The new `WildlifeAgent` base shares motors, interpolation, codecs, clearance and territory handling. `ToucanAgent`, `OrangutanAgent` and `JaguarAgent` supply species decisions. It does not inherit the deer grazing state machine. Each model is authored in [`scripts/art/wildlife-model.ts`](../scripts/art/wildlife-model.ts), baked offline through the existing CPU rasterizer, and exported to a colored OBJ. These are stylized articulated models, not anatomically complete rigs or AI-reconstructed meshes.

## Sparse generation

A separate seeded wildlife stream makes animal placement independent of foliage decoration. Per 4×4 chunk, deer-family probability is 7.5%, toucan-flock probability 4.5%, and orangutan probability 2.5%, further limited by land and trees. Jaguar probability is 1.2%, rising to 24% in a deer-family candidate chunk so rare encounters can occur. Not all candidate groups find suitable space. Jaguars get an initial recovery delay to avoid instant chases on arrival.

The original Study 05 population sample had 87 animals on 4,624 tiles; Study 06 adds habitat-limited populations, so that historical count no longer describes the current generator. This is a population sample, not a promised density in every view. Large stretches have no animals. The old generator attempted two deer in every chunk; sparse clustered encounters replace that policy.

## Tree structure and forest floor

Each of four tree species has its original form plus two retained generated structural forms. The most severely leaning column is preserved in the source image but omitted from the runtime atlas. Domain-warped five-tile stands choose a shared dominant species, form and size. About 91% of stands use upright/forked forms; occasional leaning stands lean together. Individual size variation is restrained and about 10% of trees use a companion species. Form and scale are stable instance traits and serialize. Wind loops remain rooted, with 32 poses per form. The new source, prompt and cleaning process are recorded in [ASSETS.md](ASSETS.md).

Root beds are small, porous soil speckles and scattered dry leaves, rather than continuous brown puddles. About three quarters of trees receive a patch; its radius stays below .25 tiles and opacity below .4. Close neighbors modestly increase those values. Four reusable irregular alpha textures avoid stamped circular edges. Patches follow terrain height, render below shadows/animals, and are excluded where their corners cross water. Ground-cover placement derives from the local tree index only when the active chunk set changes; it is not an extra ticking agent or per-tile texture allocation.

## State and boundaries

Jungle agent collections are schema **12**; world checkpoints are schema **15**, including terrain fields, settings and the revised forest generator. Older checkpoints are rejected; there is no silent reinterpretation of old layouts. Records preserve group/parent links, size/coat/form, RNG, decision timers, recovery, fear, speed/acceleration, target and canopy height, plus previous presentation samples. See [AGENTS-LIBRARY.md](AGENTS-LIBRARY.md).

Groups remain owned by 4×4 chunk territories. They cross internal tiles, but do not migrate across owner boundaries. Cached offscreen families sleep and resume intact; expired families regenerate their initial seeded state. No reproductive lifecycle, aging, predator nutrition, general obstacle pathfinding or full branch skeleton is simulated. Perching/climbing uses approximate tree anchors, and direction/pose changes retain pixel-art quantization.

## Reproduce and inspect

```sh
npm run check
npm run assets:preview
npm run benchmark
```

Contact sheets include `artifacts/<species>-directions.png` and per-action strips for every model species. `artifacts/wildlife-<species>.png` plus JSON records show the current streamed habitats. Tests cover family following and update-order independence, acquisition/pursuit/flight/recovery, exact wildlife continuation, flying/climbing, sparse generation, shoreline-safe litter, and transparent margins across every heading/action.

## Canopy, grassland and coastline agents

[`ecology.ts`](../src/jungle/ecology.ts) centralizes immutable movement/bake specifications and habitat rules. [`ecological.ts`](../src/jungle/agents/ecological.ts) supplies one concrete class per species, shared transport, exact codecs and species decisions. [`ecology-model.ts`](../scripts/art/ecology-model.ts) owns the authored articulated geometry. No live 3D renderer, downloaded pack or inferred AI mesh is needed.

| Species | Population and movement |
| --- | --- |
| Monkey | Small social groups mostly forage, rest or climb. Rare short pendulum swings use a visible fixed-length vine attached to the current tree. |
| Wolf | Packs of 3–5 adults, sometimes 1–2 cubs (space permitting). Ongoing parent/leader following, separation, catch-up runs, short pack runs and independent pacing. Wolves do not hunt in this version; jaguars retain their existing deer pursuit. |
| Giraffe | Small groups restricted to drier land. Tall necks, long legs, patterned coats, slow strides and larger clearance. |
| Elephant | Small family groups including a smaller juvenile following an adult. Broad footprint checks, slower acceleration, ears, trunk and heavy strides. |
| Crab | Disabled in Study 09; type ID 44 and model source remain reserved for possible return. |
| Seagull | Coastal groups alternate fast powered wingbeats/ascent and level-wing descending glides; settle on beaches and keep flying over water. |
| Fish | Schools of 7–11. Refresh moving social targets at decision intervals; steer together, oscillate tails, and reject paths crossing dry shore cells. Render below surface glints. |
| Whale | Rare solitary deep-water animals with a water footprint. Slow fluke-driven motion; spend most of a roughly 54-second cycle submerged, briefly rise, blow and dive. Visibility and height vary smoothly. |
| Macaw | Small canopy flocks, red/yellow/blue plumage, long tails and broad wing beats. |
| Parakeet | Slightly larger groups of small green/yellow birds, quick wing beats and canopy hops. |
| Kingfisher | Small blue/orange canopy groups with long bills and fast flights; diving/fishing behavior is future work. |

Candidate probabilities per chunk are 6% monkey, 1.8% wolf, 3.5% giraffe, 2.5% elephant, 55% crab, 30% gull, 40% fish, 2.5% whale, 7.5% macaw, 8.5% parakeet and 6% kingfisher. Coastal/water probabilities apply only when suitable positions are found; these are not per-tile spawn rates. Individual pace, size, coat, action phase and breath phase vary deterministically. Fish retain group cohesion during travel, not just when choosing an initial destination.

Habitat checks follow the same interpolated scalar contours as rendered shores. Candidate travel segments are checked before movement; active terrain samples reuse decoded terrain instead of recomputing procedural fields each tick. Large ground animals and whales additionally test footprint clearance. Trees supply approximate canopy anchors, not physically simulated branches or ropes. These remain stylized, bounded-territory animals; geographic realism and full animal anatomy are outside this demo.

Wildlife navigation previews candidate chunks without admitting them to the resident cache or inflating exploration counters, and selects an actual spawned animal. Snapshots wait for a whale's visible surfacing phase. A visited whale may initially be underwater in the live demo.

## Study 07 population controls

Default group candidate probabilities are multiplied by **2.5** relative to the base rates above (capped implicitly at 100%). The Settings animal slider ranges from 0–5×; groups retain their sizes, relationships and individual behavior. The denser forest also supplies more valid canopy anchors. The low-density regression explicitly uses 1×, while a separate test verifies default life increases and 0× removes all animals. Small lakes make coastal encounters less widespread; Wildlife still locates actual populations.

Tree structure and placement were revised in Study 08; the current rules and source counts are in [natural forest composition](FOREST.md). Animal spawning rates and the 2.5× default setting are retained.

## Study 09 motion revision

Current monkey, bird and speed variation behavior is detailed in [animal motion](ANIMAL-MOTION.md). Crabs are excluded from generation, navigation and the runtime atlas. The base spawn rates above are historical; the crab rate is now disabled. Tree/perch positions initialize canopy animals at actual supports. Hills keep ordinary land cover, with no gray ridge material.

## Study 11 waterside elephant families

Elephant candidates now use 8.5% × density per chunk near water; inland candidates retain only 12% of that rate (1.02% × density). Other animal rates are unchanged. Valid shoreline positions are preferred, retaining the existing two-to-three adults and possible calf. These are candidate probabilities, not guaranteed populations or exact area fractions.

Thirst drives a dry-footed shoreline approach, trunk filling, curling water to the mouth and lingering. Some filled-trunk actions instead spray a nearby grounded animal; that animal turns away or moves to a valid escape spot. Elephants may splash one another, while high-flying and aquatic animals ignore the stimulus. [Elephant design](ELEPHANTS.md) explains anatomy, timing and the local-territory limitation.

## Constrictors and small snakes

Boas are solitary tree-associated candidates (5.5% × local animal density per chunk); small snakes request varied groups of 3–5 (4.5% × density). Dry habitat and placement clearance still apply. Slow distance-driven waves, planted turns, trunk wrapping and loose-group decisions are documented in [SNAKES.md](SNAKES.md). No predation or cross-chunk migration is added.

Canopy-biased placement, five additional solitary woodland/bank species and connected waterways are described in [RIVERS.md](RIVERS.md). The opening now supports extra friendly wildlife; deer perceive boar and wolves as well as jaguars.

Recurring colorful regions, canopy population/perch changes, new generated source provenance and black bear type 58 behavior/rig/codecs are documented in [regional variety](REGIONAL-VARIETY.md). Current world/agent schemas are **16/13**.

Bears now stand and pick at actual trunks; zebra herds (type 59) graze and regroup in dry woodland. See [wildlife refinements](WILDLIFE-REFINEMENTS.md) for rigs, motion, checkpoint state and atlas tradeoffs.
