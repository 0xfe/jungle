import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, updateWorld, waterAt, HABITATS, climateAt, walkable, WORLD_SIZE } from '../src/jungle/world';

test('same seed and inputs reproduce a world, while regrowing changes plants', () => {
  const a = createWorld(2718), b = createWorld(2718);
  assert.deepEqual(a.plants, b.plants);
  assert.notDeepEqual(a.plants, createWorld(999).plants);
  for (let i = 0; i < 2400; i++) { updateWorld(a, 1 / 60); updateWorld(b, 1 / 60); }
  assert.deepEqual(a.deer, b.deer);
  assert.equal(a.tiles.length, 16);
});
test('pond and climate continue smoothly across the tile seam', () => {
  for (const habitat of HABITATS) {
    assert.ok(waterAt(.999, .71, habitat) > 0 && waterAt(1.001, .71, habitat) > 0);
    assert.ok(Math.abs(waterAt(.999, .71, habitat) - waterAt(1.001, .71, habitat)) < .03);
  }
  assert.ok(Math.abs(climateAt(.999, 1, 9).moisture - climateAt(1.001, 1, 9).moisture) < .001);
});
test('deer graze, look, walk, cross tiles, and remain on land for a simulated five minutes', () => {
  let crossed = false;
  const states = new Set<string>();
  for (const habitat of HABITATS) {
    for (const seed of [2718, 42, 10637]) {
      const world = createWorld(seed, habitat);
      const origins = world.deer.map(d => [Math.floor(d.x), Math.floor(d.y)]);
      for (let i = 0; i < 60 * 300; i++) {
        updateWorld(world, 1 / 60);
        for (const [index, deer] of world.deer.entries()) {
          states.add(deer.state);
          assert.ok(Number.isFinite(deer.x) && Number.isFinite(deer.y));
          assert.ok(deer.x > 0 && deer.x < WORLD_SIZE.width && deer.y > 0 && deer.y < WORLD_SIZE.height);
          assert.ok(waterAt(deer.x, deer.y, habitat) < 0, `${habitat}: deer entered water`);
          if (Math.floor(deer.x) !== origins[index]![0] || Math.floor(deer.y) !== origins[index]![1]) crossed = true;
        }
      }
    }
  }
  assert.deepEqual([...states].sort(), ['graze', 'groom', 'look', 'lower', 'raise', 'run', 'turn', 'walk']); assert.ok(crossed);
});
test('tree trunks and deep water block walking, rain changes movement speed', () => {
  const world = createWorld(); const tree = world.plants[0]!;
  assert.equal(walkable(world, tree.x, tree.y), false);
  assert.equal(walkable(world, 1.17, .71), false);
  const rainy = createWorld(); rainy.weather = 'rain';
  for (const w of [world, rainy]) Object.assign(w.deer[0]!, { x: 1.1, y: 1.5, target: { x: 1.5, y: 1.5 }, state: 'walk', timer: 10, heading: 0 });
  for (let i = 0; i < 60; i++) { updateWorld(world, 1 / 60); updateWorld(rainy, 1 / 60); }
  assert.ok(rainy.deer[0]!.x > world.deer[0]!.x);
});
