# Animal quality and acceptance

These requirements apply to wildlife and decorative animal residents, with complexity proportional to their size and role. They complement the deterministic simulation, streaming, assets and rendering rules in [AGENTS.md](../AGENTS.md). The current species-by-species findings are in [ANIMAL-REVIEW.md](ANIMAL-REVIEW.md).

## Plan the animal before making frames

Record its habitat, characteristic silhouette/posture, normal gait and pace, feeding and resting behavior, social unit, age/size range, threats and environmental responses. Include a short activity table: common actions, occasional actions and intentionally absent actions. Do not interpret the list as requiring a fish to walk or a solitary predator to join a herd. Play is particularly useful for young mammals; grazing, browsing, rooting, preening and basking need different poses and intent.

Use primary natural-history references where behavior is uncertain. Keep artistic choices explicit. Standing black bears, for example, should briefly inspect/smell their surroundings, rather than make upright locomotion their default; [NPS describes the standing posture as a way to look or smell](https://www.nps.gov/dena/planyourvisit/bear-safety.htm). The project remains an artistic mixed habitat, not a geographically accurate ecosystem.

## Movement and anatomy

- Agree on forward direction and root before producing clips. The body, head, limbs, paws/hooves, tail and support points must stay anatomically connected at every phase and heading. Carry weight through contacting feet; counterbalance the head/body subtly rather than bouncing the whole model as one piece.
- Calibrate each locomotion gait. For a planted foot, local backward travel × model-to-world scale must cancel forward travel. Stride scales with individual body size. Running requires its own stance fraction and poses, not just a faster walk.
- Measure **cycles per second = actual travel speed / body-scaled stride**. Increasing frame count cannot fix an animal taking two seconds per step when its desired gait is brisk. Tempo should vary by individual, trip and context, with bounded acceleration, braking and steering. Turn before translating; blocked feet stop.
- Large mammals normally start with **16 headings, 24–32 walk/run samples, and 16–24 samples for substantial posture transitions**. More complex actions may need more. Small silhouettes or breathing-only loops can use fewer if reviewed at their actual display cadence. Pose counts are a starting point; inspect footfalls and motion at real playback speed.
- Give feeding, standing and lying transitions shared endpoints. Reverse compatible transitions when useful. Avoid abruptly snapping a lowered head, extending zombie-like arms, resetting stride mid-step or moving a planted root during a state change. Preserve previous samples and interpolate world position/heading/gait at the fixed-clock alpha.
- Preserve readable texture and features at 100% and close zoom: face/muzzle, ears/eyes, paws or hooves, body proportions and species-specific markings. Bake at useful pixel resolution with nearest-neighbor sampling and clip-union anchors. No per-frame independent trimming or blurry image crossfades.

## Individual variety and ecology

Normally provide multiple structural forms with full compatible action sets. A single well-articulated rig can instead use visibly distinct authored palettes/markings or shared feature components, especially when the species silhouette should remain consistent. Tiny brightness differences are not enough. Adults must vary in size; young use parent-relative proportions/scale where appropriate. Traits stay seeded and stable through sleeping and checkpoints, with shared immutable art rather than per-animal textures.

Social behavior must remain species-specific. Families wait for lagging young; herds retain spacing and independent activity/stride phases; flocks/schools stay cohesive without overlapping in lockstep. Solitary animals remain solitary. Habitat checks apply to movement as well as generation, including the full body footprint near water/obstacles. Predator/prey responses should be believable and bounded: alert, turn, flee or seek cover where appropriate, then recover. Not every large animal flees every carnivore. Realistic movement does not require contact kills or gore.

## Required review evidence

1. Review a direction sheet and a normal-speed walk/run/transition loop, not just a static hero frame. Include small/large individuals and every art variant, plus ordinary in-world activity.
2. Test stance calibration, turn-before-travel, acceleration/braking, blocked gait, transition endpoints, geometry margins and expected activity occupancy over several seeds. Include the relevant social/environmental cases: nearby threat, safe route/water rejection, missing support, straggler recovery and lack of crowd overlap.
3. Test every owned state through binary save/restore with exact continuation, including RNG, motors, cooldowns and previous presentation samples. Recheck negative-coordinate generation when habitat/spawn rules change.
4. Inspect Memory snapshots and Chrome WebGL/Canvas at normal/close/wide zoom, with navigation and a mobile viewport. Use the user's connected Chrome when available; if unavailable, explain the limitation and use a separate Chrome test profile. Do not present mobile emulation or software rendering as physical-device performance.
5. Run `npm run check`, `npm run benchmark` for scale-sensitive changes, and hash/cache verification. Report decoded atlas size and draw-count impact separately. Optimize exact shared pixels/poses first; do not lower unrelated species' detail or cadence to hide a budget overrun.

A review may identify work for later. Label existing behavior, changes completed now and proposals distinctly, and prioritize visible behavioral errors over cosmetic additions. Do not silently declare the whole wildlife catalog compliant.
