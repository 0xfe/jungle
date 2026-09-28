import { DeerAgent } from './agents';
import { random } from '../iso/math';
import { invalidateLayout, walkable, WORLD_SIZE, type World } from './world';
/** Opt-in, deterministic profiling fixture; never run in the ordinary demo. */
export function addStressPopulation(world: World, factor: number): void {
  factor = Math.max(1, Math.min(16, Math.floor(factor) || 1));
  const rng = random(world.seed + 919), plants = [...world.plants], deer = [...world.deer];
  for (let i = 1; i < factor; i++) {
    for (const p of plants) world.plants.push({ ...p, id: `${p.id}-stress-${i}`, kind: 'plant',
      x: rng() * WORLD_SIZE.width, y: rng() * WORLD_SIZE.height, scale: .5 + rng() * .3, phase: rng() * 20 });
    for (const d of deer) {
      const next = new DeerAgent(`${d.id}-stress-${i}`, d.x, d.y, Math.floor(rng() * 0xffffffff));
      next.territory = [...d.territory]; world.deer.push(next);
    }
  }
  invalidateLayout(world);
  // Spread animals over valid land; dense fixture does not add dynamic avoidance.
  for (const d of world.deer.slice(deer.length)) for (let attempt = 0; attempt < 100; attempt++) {
    const x = .15 + rng() * (WORLD_SIZE.width - .3), y = .15 + rng() * (WORLD_SIZE.height - .3);
    if (!walkable(world, x, y)) continue;
    d.x = d.previous.x = d.target.x = x; d.y = d.previous.y = d.target.y = y; break;
  }
}
