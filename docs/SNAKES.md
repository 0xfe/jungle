# Snakes: slow travel and tree residence

The two new species are **boa** (type 51) and **smallSnake** (type 52). `J` visits both habitats. Type 44 remains reserved for disabled crabs. The world now has 21 active animal species.

Boas are solitary, slow constrictors that favor tree-containing chunks. They rest, seek cover, approach an actual tree and occasionally wrap around its lower trunk. A planted turn precedes the five-second wrap; residence lasts 22–60 seconds, followed by unwrapping and a 45–95-second cooldown. They do not hunt or constrict other animals. The broad reference is the [Smithsonian account of solitary, terrestrial and arboreal boas](https://nationalzoo.si.edu/animals/boa-constrictor).

Small striped snakes spawn in loose groups of 3–5, with independently seeded sizes, phases, pauses and routes. They use nearby cover and the moving group center, refreshing a target when separated. This grouping is an artistic behavior requested for this world, not a claim that small snake species generally form coordinated herds. All snakes retain bounded owner-chunk territories and dry-ground checks.

## Motion and artwork

`src/jungle/agents/snakes.ts` owns decisions, support state and movement. Shared ecological transport/serialization lives in `ecological-base.ts`; existing animal behavior remains in `ecological.ts`. The generic agent library gains no jungle dependencies.

`scripts/art/snake-model.ts` authors a continuous tapered tube with a head, eyes, boa saddle markings and a golden stripe on smaller snakes. Eight headings use the same world-space +X convention as other rigs. Twelve travel poses carry a lateral wave; gait advances by actual distance divided by the body-scaled stride. A blocked snake stops its motor and travel wave. Turning begins while planted. Size changes both visible body length and stride length.

Boas add ten wrap poses and one held coil pose. Unwrapping reverses the registered wrap clip. The wrap morphs the low body into a rising helix around a real trunk; it is a stylized transition, not a segment-contact physics solver. Front/back mesh sections bake separately and straddle the supporting tree's painter depth. Quantized heading registration and terrain-height compensation keep the held coil centered on that tree. All sprites share the existing atlas; there are no runtime meshes, per-segment agents or per-animal textures. Static OBJ models remain inspectable under `assets/models/`.

## State and reproduction

Agent schema **9** registers both classes and supported action states. Snake records add a support flag and three float64 values (trunk x/y and heading), 25 bytes beyond the common ecological record. Records retain RNG, motor, timer, target, size, phase, previous samples and group IDs. World schema **11** also pins the revised opening/vegetation generator; older records fail explicitly.

Cached snakes sleep and resume exactly. Expired chunks regenerate their original populations; no durable migration, branch network or population history is implemented. Perches supply approximate trunk anchors, so coils do not conform to every irregular root or lean in the generated tree art.

```sh
npm run check
npm run assets:preview  # boa/smallSnake heading and action sheets
npm run snakes:preview # staged, unobstructed wrap sequence and draw list
```

Tests cover real-support acquisition, wrap/residence/unwrap, exact continuation through each action, planted turns, blocked waves, size-coupled travel, loose grouping, solitary generation and dry habitat. The standard snapshot pipeline also writes both snake habitat scenes.
