import test from 'node:test';
import assert from 'node:assert/strict';
import { ChunkCache, Cardinality } from '../src/streaming';
import { InfiniteWorld } from '../src/jungle/infinite';
import { TerrainChunk, TerrainKind, coordinateHash, landscape } from '../src/jungle/terrain';
import { jungleAgents, DeerAgent } from '../src/jungle/agents';
const one = (x: number, y = 0) => ({ minX: x * 4, minY: y * 4, maxX: x * 4 + 3.9, maxY: y * 4 + 3.9 });

test('compact terrain is deterministic, varies by region and shares negative-coordinate height seams', () => {
  const a = TerrainChunk.generate(-1, -1, 2718), b = TerrainChunk.generate(0, -1, 2718);
  assert.equal(a.data.length, 986);
  assert.deepEqual(a.data, TerrainChunk.generate(-1, -1, 2718).data);
  for (let y = 0; y < 4; y++) {
    assert.equal(a.tile(3, y).heights[1], b.tile(0, y).heights[0]);
    assert.equal(a.tile(3, y).heights[3], b.tile(0, y).heights[2]);
    for (let t = 0; t <= 1; t += .125) assert.ok(Math.abs(a.tile(3, y).heightAt(0, -4 + y + t) - b.tile(0, y).heightAt(0, -4 + y + t)) < 1e-9);
  }
  const kinds = new Set<number>(); for (let y = -100; y < 100; y += 3) for (let x = -100; x < 100; x += 3) kinds.add(landscape(x, y, 2718).kind);
  assert.equal(kinds.size, 5);assert.ok(!kinds.has(TerrainKind.Stone));
});

test('LRU and distance expiry enforce byte and count caps without evicting pinned chunks', () => {
  const cache = new ChunkCache<number>({ maxBytes: 25, maxEntries: 2, maxDistance: 3 });
  cache.put(0, 0, 1, 10, new Set()); cache.put(1, 0, 2, 10, new Set()); cache.get(0, 0);
  cache.put(2, 0, 3, 10, new Set(['0,0'])); assert.equal(cache.peek(1, 0), undefined); assert.equal(cache.expired, 1);
  assert.throws(() => cache.put(3, 0, 4, 10, new Set(['0,0', '2,0'])), /Active chunks/);
  assert.ok(cache.bytes <= 25 && cache.size <= 2);
  cache.expire({ x: 20, y: 20 }, new Set(['0,0'])); assert.equal(cache.size, 1); assert.equal(cache.peek(0, 0), 1);
});

test('scrollback restores sleeping agent state; evicted chunks regenerate deterministic terrain and populations', () => {
  const world = new InfiniteWorld(2718, 'rainforest', { maxBytes: 100000, maxEntries: 3, maxDistance: 100 });
  world.ensure(one(0)); const original = world.checkpoint(); const terrain = world.active.get('0,0')!.terrain.data.slice();
  for (let i = 0; i < 120; i++) world.update(1 / 60);
  const awake = jungleAgents.encode(world.agents);
  world.ensure(one(1)); for (let i = 0; i < 120; i++) world.update(1 / 60);
  world.ensure(one(0)); assert.deepEqual(jungleAgents.encode(world.agents), awake);
  for (let i = 1; i < 20; i++) world.ensure(one(i));
  assert.ok(world.cache.size <= 3 && world.cache.bytes <= 100000); assert.ok(world.stats.expired > 0);
  world.ensure(one(0)); assert.deepEqual(world.active.get('0,0')!.terrain.data, terrain);
  const fresh = InfiniteWorld.restore(original, { maxBytes: 100000, maxEntries: 3, maxDistance: 100 }); fresh.ensure(one(0));
  assert.deepEqual(jungleAgents.encode(world.agents), jungleAgents.encode(fresh.agents));
});

test('binary world checkpoints retain active RNG and interpolation state for exact continuation', () => {
  const world = new InfiniteWorld(2718); world.ensure(one(0));
  for (let i = 0; i < 200; i++) world.update(1 / 60);
  const checkpoint = world.checkpoint(), restored = InfiniteWorld.restore(checkpoint); restored.ensure(one(0));
  assert.ok(checkpoint.length < 20000); assert.deepEqual(jungleAgents.encode(restored.agents), jungleAgents.encode(world.agents));
  for (let i = 0; i < 500; i++) { world.update(1 / 60); restored.update(1 / 60); }
  assert.deepEqual(jungleAgents.encode(restored.agents), jungleAgents.encode(world.agents)); assert.equal(restored.time, world.time);
  assert.throws(() => InfiniteWorld.restore(checkpoint.subarray(0, checkpoint.length - 1)), /Truncated/);
});

test('long travel has bounded storage, bounded statistics and valid active animals', () => {
  const world = new InfiniteWorld(42, 'rainforest', { maxBytes: 150000, maxEntries: 24, maxDistance: 5 });
  for (let i = 0; i < 200; i++) {
    world.ensure({ minX: i * 4, minY: -4, maxX: i * 4 + 7.9, maxY: 3.9 });
    for (let j = 0; j < 10; j++) world.update(1 / 60);
    assert.ok(world.cache.bytes <= 150000 && world.cache.size <= 24); assert.ok(world.active.size === 4);
    for (const a of world.agents) if (a instanceof DeerAgent) {
      assert.ok(world.tileAt(a.x, a.y)!.materialAt(a.x, a.y) < TerrainKind.Shallow);
      assert.ok(a.x >= a.territory[0] && a.x <= a.territory[2]);
    }
  }
  assert.ok(world.stats.expired > 1000); assert.ok(world.stats.worldSize > 5000);
  assert.equal(world.explored.registers.byteLength + world.drawn.registers.byteLength, 8192);
});

test('distinct world counters use fixed memory and do not count revisits twice', () => {
  const c = new Cardinality();
  for (let i = 0; i < 20000; i++) c.add(coordinateHash(i, -i, 11));
  const count = c.estimate; assert.ok(Math.abs(count - 20000) / 20000 < .06, `estimate ${count}`);
  for (let i = 0; i < 20000; i++) c.add(coordinateHash(i, -i, 11));
  assert.equal(c.estimate, count); assert.equal(c.registers.length, 4096);
});


test('signed coordinate hashes do not alias opposite quadrants in exploration counters', () => {
  const unique = new Set<number>(), c = new Cardinality();
  for (let y = -12; y < 12; y++) for (let x = -20; x < 20; x++) {
    const h = coordinateHash(x, y, 671); unique.add(h); c.add(h);
  }
  assert.equal(unique.size, 960);
  assert.ok(Math.abs(c.estimate - 960) < 40, `estimated ${c.estimate}`);
});
