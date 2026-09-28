# Elephants: anatomy, water and play

Study 11 · 27 September 2026

Elephant families now favor waterside chunks. Individuals approach reachable drinking spots, lower their trunks into water, curl them toward their mouths and linger. Some filled-trunk actions become short sprays aimed at a nearby elephant or another animal. Recipients turn away or retreat within their own habitat rules.

## Art and motion

The old generic quadruped mesh is replaced by `scripts/art/elephant-model.ts`: domed shoulders and forehead, smaller lobed ears, a heavy rounded body, column-like legs with padded feet/toenails, curved tusks, a tapered tail and a connected tapered trunk. It is an Asian-elephant-inspired pixel-art rig, not a complete anatomical model. The visual/behavior reference is the [San Diego Zoo elephant account](https://animals.sandiegozoo.org/animals/elephant), including collecting water in the trunk before transferring it to the mouth.

The build-only software baker renders sixteen headings. Each heading contains eight resting, twenty walking, twenty-four drinking and sixteen spraying poses: **1,088 frames**. Drink and spray include both endpoints of their normalized action; cyclic clips exclude the duplicate endpoint. Registered roots and union trimming prevent pose-dependent sprite jumps. Body size scales the sprite, footprint, drinking reach and walking stride together.

The walk has a long four-beat stance. Nominal speed is 0.12 tiles/second with a 0.175-tile stride, calibrated to the authored foot excursion. The existing motor accelerates and brakes smoothly; gait advances from actual displacement. Ear, tail and trunk motion give resting animals small independent movements.

## One shared trunk curve

`src/jungle/elephant-pose.ts` defines cubic trunk controls for relaxed, dipped, mouth-curled and raised poses. Smooth transitions form a 5.4-second nominal drinking sequence and 2.8-second spray, varied by individual pace. `ElephantAgent` turns toward the water/recipient before advancing the action.

Both the offline mesh and runtime effects use this curve. The renderer samples the actual selected sprite phase and quantized heading before projecting the trunk tip; droplets originate at that nozzle rather than an approximate body offset. Four small surface glints accompany trunk filling. Sprays use up to sixteen analytic droplets following shallow arcs; they create no particle agents or textures.

## Water seeking and social behavior

`ElephantAgent` owns thirst, water-search delay, remembered water position, trunk load and spray target. Thirst rises over time. When thirsty and resting, the elephant searches for a spot in its current four-tile-square territory:

1. Test a bounded 9×9 grid of possible standing positions and eight headings.
2. Keep feet on traversable ground and the trunk tip in rendered water.
3. Require a clear direct route and choose a nearby valid spot.
4. Walk there, align, fill the trunk, and curl it to the mouth or occasionally spray.

Search retries are spaced 8–16 seconds apart. Candidate elephant chunks use an 8.5% × density rate, retaining only 12% of inland candidates; shoreline placement is preferred within suitable chunks. Existing family links and smaller calves remain intact. This makes water encounters more likely without filling every shore with elephants.

A filled trunk can initiate play with a grounded neighbor 0.4–1.5 tiles away, subject to a chance and a 28–56-second cooldown. Water must be collected first. Normal drinking satisfies thirst; the elephant then rests nearby for 16–32 seconds. A playful spray can be followed by another attempt to drink. Animals remain bounded to their current territory, so a herd cannot migrate toward a distant lake yet.

## Reusable local reactions

`src/agents/startle.ts` supplies `LocalStimulus` and `StartleResponse`. An active spray publishes a small splash area centered on its remembered target. `AgentSystem` copies this into the pre-update spatial snapshot. Recipients sense it on their normal decision ticks, so reactions do not depend on agent update order or direct mutation by the elephant.

The response lasts three seconds and has a nine-second repeat cooldown. Deer, wolves and jaguars can run; other grounded species move away using their own motion and terrain rules. If no escape route is clear, an animal turns away. High-flying birds and aquatic animals ignore splashes. Targets that move clear before the water arrives may escape without reacting. A stimulus is a short-lived area, not collision tracking for every droplet.

The `hasStimuli` environment hint avoids extra wildlife queries when there are no active sprays. Per-agent RNG remains deterministic. No interaction history grows with play time.

## State and budgets

Agent collections are schema **7** and world checkpoints schema **8**; older checkpoints fail explicitly. The response component uses 24 bytes per mobile animal; elephant-specific water fields add 50 bytes beyond the common ecological record. The elephant record is 380 bytes plus UTF-8 identity/group/parent lengths, excluding the collection header. Exact mid-spray continuation is tested.

The shared atlas is **4096×3980, 62.19 MiB decoded**, below the existing 64 MiB ceiling. The finite fixture's soft island shadow uses fewer texels at the same displayed size to make room. No plant/animal resolution, world-cache limit or fixed simulation rate was reduced. See [performance measurements](PERFORMANCE.md).

## Reproduce and review

```sh
npm run check
npm run assets:preview
npm run elephants:preview
npm run benchmark
npm run serve
```

The elephant preview writes `artifacts/elephant-water-sequence.png`, individual drink/spray PNGs and their scene-command JSON. It deliberately clears plants in a staged shoreline fixture so anatomy and trunk registration are visible; it is not a replay of naturally timed behavior. Directional contact sheets inspect all headings, while `tests/elephants.test.ts` exercises reachable drinking, loaded-trunk play, responses/blocked escapes, cooldowns, exact continuation, update order, water-biased generation and unstaged drinking/spraying in a generated world.

In the browser, **Enter/Return** reveals the otherwise hidden controls. **J / Wildlife** cycles to elephant habitat; zoom in to inspect the new poses. The same frames/effects run in WebGL, Canvas and the headless memory renderer.

Full skin deformation, fluid simulation, general pathfinding around obstacles, migration and durable interaction history remain future work.
