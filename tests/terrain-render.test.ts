import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { MemoryRenderer, WHITE } from '../src/iso/render';
import { quadBounds, quadUV, type QuadCorners } from '../src/iso/quad';
import { writeQuads } from '../src/iso/batch';
import { InfiniteWorld } from '../src/jungle/infinite';
import { cameraBounds, composeInfinite } from '../src/jungle/infinite-scene';
import type { AtlasManifest } from '../src/jungle/scene';
const atlas: AtlasManifest = JSON.parse(await readFile('public/assets/jungle.json', 'utf8'));

test('sloping textured quads share the same corner and inverse mapping contract in memory and GPU batches', () => {
  const corners: QuadCorners = [{ x: 2, y: 0 }, { x: 4, y: 2 }, { x: 0, y: 2 }, { x: 2, y: 5 }];
  assert.deepEqual(quadUV(corners, 2, 0), { u: 0, v: 0 }); assert.deepEqual(quadUV(corners, 2, 5), { u: 1, v: 1 });
  assert.equal(quadUV(corners, 0, 0), undefined);
  const command = { id: 'slope', ...quadBounds(corners), corners, color: WHITE, layer: 0, depth: 0, region: { x: 0, y: 0, width: 1, height: 1 } };
  const vertices = new Float32Array(48); writeQuads([command], 1, 1, vertices);
  assert.deepEqual([...vertices.slice(0, 2)], [2, 0]); assert.deepEqual([...vertices.slice(40, 42)], [2, 5]);
  const renderer = new MemoryRenderer({ width: 1, height: 1, data: new Uint8Array([20, 100, 50, 255]) });
  renderer.render({ width: 5, height: 6, clear: [0, 0, 0, 0], commands: [command] });
  assert.equal(renderer.pixels.data[3], 0); assert.equal(renderer.pixels.data[(2 * 5 + 2) * 4 + 3], 255);
});

test('camera-relative streaming works far from zero, keeps the viewport filled, and accounts only visible tiles', () => {
  const world = new InfiniteWorld(2718), view = { width: 900, height: 600, pixelRatio: 1, zoom: 1, grid: false, cameraX: -10000, cameraY: 12000 };
  world.ensure(cameraBounds(view)); const frame = composeInfinite(world, atlas, view);
  assert.ok(frame.commands.length > 50); assert.ok(world.renderedNow > 10 && world.renderedNow < world.tiles.length);
  assert.ok(frame.commands.every(c => Math.abs(c.x) < 2000 && Math.abs(c.y) < 2000));
  const tiles = frame.commands.filter(c => c.corners);
  for (let y = 1; y < view.height; y += 31) for (let x = 1; x < view.width; x += 31)
    assert.ok(tiles.some(c => quadUV(c.corners!, x, y)), `missing ground at ${x},${y}`);
});
