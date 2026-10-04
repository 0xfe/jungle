# Reusable agents and motion

`src/agents/` is a browser-independent library. It imports only the isometric math/spatial primitives, never jungle rules, textures, DOM APIs, or a wall clock. Species live in `src/jungle/agents/`. A different application can supply its own classes, environment and registry while retaining the same renderer.

## Contracts

| Type | Responsibility |
| --- | --- |
| `Agent` | Stable ID/type, position, `update(dt, environment)`, binary writer; optional speed marks a mobile actor; altitude and local stimulus support perception |
| `AgentEnvironment` | Current simulation time, local moisture/light/wind/elevation/water, movement clearance, nearby mobile actors and optional tree perches and a `hasStimuli` fast-path hint |
| `AgentSystem` | Takes a position/speed/heading/group/alarm/altitude/stimulus snapshot before stepping agents; builds a spatial index for perception |
| `AgentRandom` | Per-agent PRNG with an explicit serializable uint32 state |
| `SpeedMotor` | Velocity and acceleration, bounded acceleration and jerk, eased target-speed response |
| `StartleResponse` | Serializable local splash response with heading, duration and repeat cooldown |
| `herdIntent` | Reusable cohesion, alignment, separation and parent/leader following |
| `ease` | Exponential, frame-rate-independent smoothing of changing parameters |
| `AgentRegistry` | Stable numeric type IDs mapped to species decoders; encodes/decodes collections |
| `BinaryWriter` / `BinaryReader` | Little-endian numeric, UTF-8 string and byte-array records with bounds checking |

An agent's update is synchronous and independently testable. “Independent” means owned state and decisions, not a thread or worker per animal. All active agents receive the same fixed 1/60-second timestep. Per-agent PRNG streams prevent loading or updating an unrelated animal from consuming its random decisions. The scheduler snapshots neighbors before any update, so spatial perception is not biased toward actors stepped earlier in a tick.

`nearby()` returns a borrowed array valid until the next query; copy it if retaining it. It contains mobile actors, including the caller. Static clearance belongs to `canMove()`; local terrain and climate belong to `sample()`. Environment implementations can use entirely different terrain, collision or perception providers.

## Current artifact classes

- `ToucanAgent`, `OrangutanAgent`, `JaguarAgent`: species decisions over shared `WildlifeAgent` movement/interpolation and codecs. See [wildlife behavior](WILDLIFE.md).
- `DeerAgent`: group/leader/parent IDs, juvenile flag, size/coat, fear and perception timer, plus behavior state, destination, heading/angular speed, gait, action time, speed/acceleration, pace, trip variation, curiosity, alertness, per-agent RNG, territory and previous presentation sample.
- `UmbrellaTreeAgent`, `PalmAgent`, `BananaAgent`, `FloweringTreeAgent`, `BushAgent`, `FernAgent`, `BromeliadAgent`, `MushroomRockAgent`: concrete species over `PlantAgent`. Shared immutable definitions select artwork and moisture/wind response. Instances own wind phase, previous phase, response rate, vigor, structural form, scale and position.
- `WaterAgent`: integrated ripple phase and eased wind response at a fixed water location.
- `MoteAgent`: independently phased drifting light, derived from the same small phase-state class; the renderer derives its offset from phase.
- `TerrainTile` / `TerrainChunk`: immutable compact landscape data, not ticking creatures. Rain tint/drops and shadow quads are presentation effects, not separately simulated biological assets.

A sprite sheet/frame is shared visual data, not a new agent instance. There is one species class per artifact type, not a class per animation frame. All instances use the same atlas.

## Deer motion and behavior

`graze → raise → look → turn → walk/run → lower → graze`

A nominal run is **1.05 tiles/second**, up from 0.34. Its **0.45-tile stride** corresponds to about **2.33 full strides/second**, up from 0.94. The baked model's foot excursion increases from 0.6 to 0.75 model units at 36% stance. Translation and gait both advance from actual traveled distance, so faster playback cannot leave an animal running on the spot. The 20-pose run is displayed at roughly 47 poses/second at nominal cruise; individual/trip/weather variation changes this naturally.

Walks use 0.14 tiles/second and the existing 0.125-tile stride. Individual pace spans 0.85–1.25 and trip variation 0.85–1.15. Rain quickens travel; dusk reduces running and increases resting. Curiosity changes look duration. A nearby rushing animal raises alertness and makes a subsequent run more likely; candidate destinations avoid nearby deer. Family cohesion and parent-following now guide destinations; predator perception interrupts grazing and propagates alarm. See [WILDLIFE.md](WILDLIFE.md) for social rules and limits.

`SpeedMotor` eases toward target speed, bounds acceleration, and bounds its rate of change (jerk). Arrival selects the lower of cruise, a stopping-distance envelope and a close-range speed envelope. The curve therefore rounds starts and brakes before the destination. Emergency blocked movement still stops immediately rather than crossing water/trunks. Heading speed and camera velocity also ease; head raising/lowering uses eased baked poses. Plants and water smooth changes in wind before advancing phase.

Deer turn before translating. A streamed herd owns a four-tile-square territory; animals cross its internal tile edges but choose destinations within that territory. This keeps ownership and regeneration unambiguous. Cross-chunk migration with durable identities/tombstones is future work. Do not add migration by copying animals between chunks without defining eviction semantics.

## Compact serialization

```ts
import { DeerAgent, jungleAgents } from '../src/jungle/agents';

const deer = new DeerAgent('herd-a:0', 2, 3, 1234);
const bytes = jungleAgents.encode([deer]);
const [restored] = jungleAgents.decode(bytes);
// restored is a DeerAgent with its behavior, RNG, motor and previous sample intact.
```

Collections start with schema version `14` (the generic registry accepts an application-selected schema) and a uint32 count. Each record starts with a one-byte type tag: plants `1–8`, deer `20`, water `21`, motes `22`, toucan `30`, orangutan `31`, jaguar `32`, ecological species `40–59`, landscape groups `60`, hawks `61`, vultures `62` with `44` reserved for dormant crabs (IDs never shift when the active list changes). IDs are UTF-8 length-prefixed strings. Mutable simulation values use float64 deliberately: a round trip resumes exactly rather than accumulating quantization drift. Static terrain uses smaller integer fields separately.

Per-record cost, excluding the five-byte collection header:

| Species | Bytes, plus UTF-8 ID length |
| --- | ---: |
| Plant | 62 |
| Water / mote | 45 |
| Deer | 331 plus group/leader/mother UTF-8 lengths |
| Toucan / orangutan / jaguar | 331 plus group/leader/mother UTF-8 lengths |
| Base ecological species | 387 plus group/leader/mother UTF-8 lengths |
| Black bear | 405 plus group/leader/mother UTF-8 lengths |
| Boa / small snake | 412 plus group/leader/mother UTF-8 lengths |
| Elephant | 437 plus group/leader/mother UTF-8 lengths |
| Hawk / vulture | 427 plus group/leader/mother UTF-8 lengths |

Prototype methods, shared species definitions, sprites and textures are never serialized. A class spread or JSON round trip does **not** preserve this contract; use the registry. Decoding rejects unknown schema/types, duplicate IDs, non-finite numbers, truncated records and trailing bytes. This is an application save format, not a general untrusted-object deserializer. Bump the schema or supply migrations when record layout changes.

## Adding an artifact

1. Implement `Agent` in an application-specific class. Own its traits, timers, PRNG and prior presentation state.
2. Read environment/perception through the interface; don't import the world's container or renderer into behavior.
3. Assign a stable unused type ID and register its decoder. Include every mutable value that affects future behavior.
4. Add a visual adapter in the application composer; use existing quads/atlas clips, or extend the build-only baker for new poses.
5. Test an exact encode/decode continuation, environmental responses, movement constraints and repeatability with reordered independent agents. Inspect the rendered result too.

For example, a tiger would need rest/stalk/pursue/recover states, distinct senses and acceleration curves. It should not inherit a deer state machine with its sprite renamed.

The ecological extension preserves seven additional float64 values: swing origin x/y/height, normalized route progress, route duration, current breathing clock and prior breathing clock. Environment samples optionally expose `depth` (normalized habitat depth) and `beach`; neither field introduces a jungle import into the generic agent library. All eleven new class codecs have exact multi-step continuation tests.

Plant records now include a two-byte genotype, expanded once into cached appearance traits. Structural morphology, growth scale, phase, previous phase, wind rate and vigor remain owned by the concrete plant agent. Vines are attached presentation components; they do not consume separate ticks or state records. Current collection schema is 14 and world checkpoint schema is 18. See [botanical design](FOREST.md).

`FlightMotion` is a reusable DOM-free component that advances a wing phase through powered/glide bouts, varying cadence and lift from a caller-supplied profile and per-agent random stream. Wildlife records add its powered flag and three float64 values plus a trip-pace float64 (33 bytes). Restoring these fields is necessary for exact continuation. Monkey support geometry reuses the existing route origin/progress/duration fields. See [animal motion](ANIMAL-MOTION.md).

## Local stimuli and elephant water actions

`Agent.stimulus` optionally returns a `LocalStimulus` with kind, center and radius. `AgentSystem` copies it into the same pre-update neighbor snapshot as position, so a recipient observes the same event regardless of update order. `hasStimuli === false` skips extra wildlife perception queries when none are active; custom environments may omit the hint. `StartleResponse` chooses a stable source ID if several overlap and stores an away heading, three-second response and nine-second repeat cooldown (24 bytes).

Recipients choose valid habitat-specific escape targets; blocked animals turn away. Flying birds above the splash and aquatic animals ignore it. There are no per-droplet agents, direct cross-agent mutations or growing event histories. Elephant water search, thirst, trunk load and spray target add 50 bytes beyond the common ecological record. See [elephant design](ELEPHANTS.md) for behavior, sprite registration and tests.

Boas and small snakes each have a concrete class, with tree-support or loose-group decisions and exact continuation tests. See [snake motion, support and codec details](SNAKES.md).

Types 53–57 register solitary squirrels, boar, beavers, crocodiles and toads. Their route/climb/hop state uses the existing ecological codec; bank habitat is an optional generic environment sample field. See [river wildlife](RIVERS.md).

Study 15 adds shared multi-tile landscape groups, tint masks and static trunk templates. Current world/agent schemas are **18/14**; see [landscape groups](LANDSCAPE-PATCHES.md) for source provenance, animation, navigation and memory details.

Recurring colorful regions, canopy population/perch changes, new generated source provenance and black bear type 58 behavior/rig/codecs are documented in [regional variety](REGIONAL-VARIETY.md). Current world/agent schemas are **18/14**.

## Spacecraft encounters

Three rare spacecraft and their owned alien crews use world/agent schemas **22/18**. See [spacecraft design, retained artwork and validation](SPACECRAFT.md) for landing admission, bounded ownership, timed exploration, exact continuation and preview commands.

## Zen sanctuaries

See [zen sanctuaries and the hidden artifact editor](ZEN.md) for original tree provenance, baked directional inhabitants, localized music, H/five-tap controls, bounded ownership and validation. Current world/agent schemas are **25/20**.

Tigers (75), hippos (76), bison (77), registered monk stair transitions and the retained CC0 tiger recording are documented in [megafauna](MEGAFAUNA.md). Current world/agent schemas are **26/21**.
