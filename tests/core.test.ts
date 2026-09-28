import test from 'node:test';
import assert from 'node:assert/strict';
import { FixedClock, project, unproject, hash, noise } from '../src/iso/math';
import { MemoryRenderer, sortCommands, WHITE, type DrawCommand } from '../src/iso/render';

test('projection round-trips fractional and negative world coordinates', () => {
  for (const tile of [{ width: 192, height: 96 }, { width: 64, height: 32 }])
    for (let x = -4.5; x < 5; x += .25) for (let y = -3.7; y < 4; y += .31) {
      const p = unproject(project({ x, y }, tile), tile);
      assert.ok(Math.abs(p.x - x) < 1e-12 && Math.abs(p.y - y) < 1e-12);
    }
});
test('fixed simulation gives identical steps at 30, 60 and 144 Hz', () => {
  const results = [30, 60, 144].map(hz => {
    const clock = new FixedClock(); let steps = 0;
    for (let i = 0; i < hz * 10; i++) clock.advance(1 / hz, () => steps++);
    return steps;
  });
  assert.deepEqual(results, [600, 600, 600]);
  assert.equal(new FixedClock().advance(100, () => {}), 6);
});
test('coordinate seeds are repeatable and climate is continuous at negative boundaries', () => {
  assert.equal(hash(-30, 200, 8), hash(-30, 200, 8));
  assert.notEqual(hash(-30, 200, 8), hash(200, -30, 8));
  assert.ok(Math.abs(noise(-1 - 1e-6, 3, 5) - noise(-1 + 1e-6, 3, 5)) < 1e-5);
});
const quad = (overrides: Partial<DrawCommand>): DrawCommand => ({ id: 'a', layer: 0, depth: 0, x: 0, y: 0, width: 2, height: 2, color: WHITE, ...overrides });
test('painter ordering uses layer, ground depth, then a stable ID', () => {
  const list = sortCommands([quad({ id: 'z', depth: 3 }), quad({ id: 'b', depth: 2 }), quad({ id: 'a', depth: 2 }), quad({ id: 'ground', layer: -1, depth: 50 })]);
  assert.deepEqual(list.map(c => c.id), ['ground', 'a', 'b', 'z']);
});
test('in-memory canvas clips, mirrors, tints and composites real RGBA pixels', () => {
  const renderer = new MemoryRenderer({ width: 2, height: 1, data: new Uint8Array([255, 0, 0, 255, 0, 255, 0, 255]) });
  const region = { x: 0, y: 0, width: 2, height: 1 };
  renderer.render({ width: 2, height: 1, clear: [0, 0, 255, 255], commands: [quad({ height: 1, region, flip: true, color: [255, 255, 255, 128] })] });
  assert.deepEqual([...renderer.pixels.data], [0, 128, 127, 255, 128, 0, 127, 255]);
  renderer.render({ width: 2, height: 1, clear: [0, 0, 0, 0], commands: [quad({ x: -1, height: 1, region, color: [255, 128, 255, 255] })] });
  assert.deepEqual([...renderer.pixels.data], [0, 128, 0, 255, 0, 0, 0, 0]);
});
