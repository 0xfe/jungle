# Animal rhythm and supported movement

Study 10 · 27 September 2026

## Monkeys

Monkeys now have separate resting, walking, climbing and swinging states, with corresponding authored directional clips. About 65% initialize on the ground; the others initialize against real tree supports. Initial timers span 18–58 seconds. Rest/climb pauses are long and individual. Ground journeys obey land/trunk clearance and use the shared acceleration motor and distance-driven gait.

A resting tree monkey only sometimes attempts a swing. It needs a nearby real tree support, clear land within its excursion and no nearby moving monkey. A 60–120-second cooldown prevents repeated swinging. The excursion is at most **0.2 tiles from the starting point**, lasts roughly 2.8–3.6 seconds divided by individual pace, and returns to the same tree. It does not leap across the forest or transfer between trees.

The path is a pendulum projected into the fixed isometric view. Time enters through an eased phase so starting/stopping velocity is zero. Rope length stays fixed; body elevation compensates for projection and terrain height. The 3D source rig holds both hands at a fixed grip point during the swing, while legs/tail move. The renderer draws a narrow vine quad from its fixed tree attachment to that grip. It shares painter ordering and all three rendering backends; there is no extra texture or rope physics engine. This is a stylized fixed-camera constraint, not full 3D branch collision or inverse kinematics.

```sh
npm run motion:preview
```

This writes a deliberately staged close-up of an otherwise rare behavior: `artifacts/monkey-supported-swing.png`, its draw list and `artifacts/monkey-swing-sequence.png`. Ordinary wildlife snapshots show the default behavior mix.

## Bird flight

`src/agents/flight.ts` provides the browser-independent `FlightMotion` controller. Species profiles live in `src/jungle/flight.ts`; simulation owns phase/state, and rendering still selects ordinary shared atlas frames.

| Bird | Base powered beats/second | Typical burst / glide duration |
| --- | ---: | --- |
| Seagull | 4.2 | 0.8 / 1.6 seconds |
| Macaw | 4.6 | 1.15 / 0.7 seconds |
| Toucan | 5.8 | 1.2 / 0.45 seconds |
| Parakeet | 7.2 | 0.9 / 0.3 seconds |
| Kingfisher | 7.8 | 1.1 / 0.35 seconds |

These are artistic animation parameters, not measured biological rates. Individual pace and trip pace modify cadence; a small smooth within-burst variation breaks metronomic timing. Climbing requests increase wing cadence by 22%. Burst and glide durations vary with each animal's serializable random stream.

A glide starts at a completed wing cycle and holds the horizontal wing pose. Powered intervals increase lift; glides let it decrease. Height eases toward the route's altitude plus lift, tapering near a landing. Gull routes target ground level on beaches and flight altitude over water. They do not fold their wings and rest in midair when a water route ends. Other birds rest at tree perches.

The four ecological bird rigs now use 24 flight phases, larger gull wing excursions, unequal stroke/recovery timing and tucked flight feet. Toucans retain their 16-phase rig with the same variable flight controller. Gliding reuses the level-wing flight frame, rather than adding a duplicate sprite sheet.

## Variation across animals

Deer already have individual pace, per-trip pace, variable decisions, occasional runs and distance-coupled stride. These are retained. Other wildlife now also gets a per-trip cruise multiplier (0.72–1.28 for ecological animals, 0.75–1.25 for toucans/orangutans/jaguars), in addition to its existing individual pace, size, random timers and social decisions. Rest/climb animation cadence varies with individual pace. Speed changes still pass through bounded acceleration/jerk; walking and swimming gait advance by actual distance, not arbitrary clocks.

Wolves now have a dedicated running rig; species that only have walking rigs keep walking. Speed never jumps randomly every frame. Birds have their own flight cadence; whales keep their individual breathing clock; fish retain school steering.

## Removals, state and costs

Crabs no longer spawn, appear in Wildlife navigation, or occupy runtime atlas frames. Their source rig/class and numeric type ID 44 are retained dormant for possible reuse. There are **14 active animal species**.

The gray areas were stone ridge materials. The ridge scalar now contributes only to elevation: hills carry normal forest/meadow/dry cover. The settings label is **Hills**; Explore visits dry scrub, meadow, lake and forest. Small authored decorative mushroom rocks remain individual plants, rather than gray terrain patches.

Current schemas are **world 8 / agents 7**. Flight powered state, remaining timer, cadence and lift, plus trip pace, serialize with wildlife. Existing route fields store monkey swing origin/progress/duration. Checkpoints preserve exact continuation and reject earlier layouts explicitly. The active-world/cache budgets stay unchanged.

Tests verify powered/glide alternation, climb cadence, rising/falling flight, individual pace, exact continuation, short fixed-length swings with real support, low swing occupancy, and absence of crabs/stone materials even at maximum settings. `npm run assets:preview` shows all headings and motion phases. The articulated rigs and branch anchors remain stylized; more detailed anatomy and physically modeled branches are future work.

## Wolf packs and solitary running

Wolf groups now request 3–5 adults; 48% also request 1–2 cubs, subject to valid habitat/spacing. Cubs use 52–64% of their parent's size, keep a parent ID, and take shorter strides. This is a seeded family composition, not a reproductive simulation.

`WolfAgent` refreshes its social target at individual decision intervals. Followers anticipate their parent's/leader's motion, retain separation, and switch to a run when falling behind or following a running guide. A leader sometimes starts a short run when the pack is close, slows when it spreads, and returns toward stragglers. Run eligibility recovers over 18–42 seconds; rests, individual pace and trip pace vary. Blocked followers try another clear local route. Full obstacle pathfinding and cross-chunk migration remain future work.

The authored wolf rig has 20 run poses × 16 headings, paired footfalls, shorter ground contact, higher foot clearance and body rise. At nominal cruise it covers **0.95 tiles/second** with a **0.42-tile stride** (about 2.26 cycles/second). Walking uses a recalibrated 0.142-tile stride. Both strides scale with body size, including cubs; actual distance drives playback. The existing motor bounds acceleration/jerk and brakes for arrival.

Jaguars remain solitary. In addition to brief non-contact deer pursuits, an eligible resting jaguar has a 16% chance of choosing a longer running journey. Such runs recover over 25–50 seconds and share the existing directional chase artwork and 1.22-tile/second / 0.43-tile stride mechanics. The separate `run` state does not invent prey or cause a kill. Parent IDs, run state, RNG, target, cooldown, pace, motor and prior samples survive compact serialization exactly. The state enum appends `run`; no existing numeric type or state ID is reassigned.

## Study 11 elephants and splash response

Elephants now use a dedicated anatomical rig, distance-driven four-beat walk and aligned one-shot drinking/spraying clips. A reusable local stimulus response gives recipients an away heading and bounded retreat/cooldown while respecting habitat and clearance. All state, including thirst and trunk load, resumes exactly through the current world 8 / agent 7 codecs. See [ELEPHANTS.md](ELEPHANTS.md).
