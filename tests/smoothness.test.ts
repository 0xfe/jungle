import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { FixedClock } from '../src/iso/math';
import { SpatialGrid } from '../src/iso/spatial';
import { createWorld, invalidateLayout, updateWorld, walkable } from '../src/jungle/world';
import { composeScene, sampleDeer, type AtlasManifest } from '../src/jungle/scene';
const atlas: AtlasManifest = JSON.parse(await readFile('public/assets/jungle.json', 'utf8'));
const view = { width: 900, height: 600, zoom: 1, panX: 0, panY: 0, grid: false };

test('144 Hz presentation interpolates between 60 Hz ticks without mutating physics', () => {
  const world = createWorld(); world.deer = [world.deer[0]!];
  const d = world.deer[0]!;
  Object.assign(d, { x: .5, y: 2.7, target: { x: 2.5, y: 2.7 }, state: 'walk', heading: 0, speed: .14, pace: 1, tripPace: 1, timer: 30 });
  Object.assign(d.previous, { x: d.x, y: d.y, state: d.state, heading: d.heading, gait: d.gait, actionTime: d.actionTime });
  const clock = new FixedClock(); let last = d.x, moves = 0;
  for (let i = 0; i < 144; i++) {
    clock.advance(1 / 144, dt => updateWorld(world, dt));
    const before = JSON.stringify(d), sample = sampleDeer(d, clock.alpha);
    assert.equal(JSON.stringify(d), before); assert.ok(sample.x >= last);
    if (sample.x > last) moves++;
    if (i > 3) assert.ok(Math.abs(sample.x - last - .14 / 144) < 1e-10);
    last = sample.x;
  }
  assert.ok(moves > 138);
  assert.deepEqual(sampleDeer(d, 1).x, d.x);
  clock.reset(); assert.equal(clock.alpha, 0);
});

test('subpixel camera motion reaches draw commands and interpolation crosses heading wrap safely', () => {
  const world = createWorld();
  const a = composeScene(world, atlas, view), b = composeScene(world, atlas, { ...view, panX: .125 });
  assert.equal(a.commands.length, b.commands.length);
  a.commands.forEach((c, i) => assert.ok(Math.abs(b.commands[i]!.x - c.x - .125) < 1e-9));
  const d = world.deer[0]!; d.previous.heading = Math.PI * 2 - .1; d.heading = .1;
  assert.ok(Math.abs(sampleDeer(d, .5).heading - Math.PI * 2) < 1e-9);
  d.previous.state = 'graze'; d.state = 'raise'; d.previous.actionTime = 4; d.actionTime = .01;
  assert.equal(sampleDeer(d, .9).state, 'graze'); assert.equal(sampleDeer(d, 1).state, 'raise');
});

test('spatial queries include negative cell boundaries and static layout invalidation refreshes both caches', () => {
  const grid = new SpatialGrid<number>(.5);
  grid.insert(-.5, 0, 1); grid.insert(.5, 0, 2); grid.insert(500, 0, 3);
  const found: number[] = []; grid.visit(-.5, -.1, .5, .1, n => found.push(n));
  assert.deepEqual(found, [1, 2]);
  const world = createWorld(); composeScene(world, atlas, view);
  assert.ok(walkable(world, 1, 2.7));
  world.plants.push({ id: 'added-tree', kind: 'tree', variant: 0, x: 1, y: 2.7, scale: 1, phase: 0 });
  invalidateLayout(world);
  assert.equal(walkable(world, 1, 2.7), false);
  assert.ok(composeScene(world, atlas, view).commands.some(c => c.id === 'added-tree'));
  const before = composeScene(world, atlas, view);
  for (let i = 0; i < 10000; i++) world.plants.push({ ...world.plants[0]!, id: `offscreen-${i}`, x: 100 + i });
  invalidateLayout(world);
  assert.deepEqual(composeScene(world, atlas, view), before);
});

test('changing weather does not jump the wind animation phase', () => {
  const world = createWorld(); for (let i = 0; i < 1000; i++) updateWorld(world, 1 / 60);
  const plants = () => composeScene(world, atlas, view).commands.filter(c => c.layer === 2 && !c.id.startsWith('deer-'));
  const before = plants(); world.weather = 'rain';
  assert.deepEqual(plants(), before);
  const phase = world.windTime; updateWorld(world, 1 / 60);
  assert.ok(Math.abs(world.windTime - phase - 1.35 / 60) < 1e-9);
});

test('uniform terrain fast path agrees with interpolated contours, including mixed dry regions',async()=>{
  const {TerrainChunk,TerrainTile,TerrainKind,fieldKind}=await import('../src/jungle/terrain');
  for(let cy=-2;cy<=2;cy++)for(let cx=-2;cx<=2;cx++){
    const chunk=TerrainChunk.generate(cx,cy,2718);
    for(let y=0;y<4;y++)for(let x=0;x<4;x++){
      const tile=chunk.tile(x,y);
      for(const u of [.01,.27,.51,.99])for(const v of [.01,.27,.51,.99])
        assert.equal(tile.materialAt(tile.x+u,tile.y+v),fieldKind(tile.fieldsAt(tile.x+u,tile.y+v)));
    }
  }
  // Shore sand and inland dry scrub are disjoint scalar-field regions. Their
  // endpoints may all say Dry while interpolated land between them is Forest.
  const fields=Array.from({length:9},(_,i)=>i%2?[.10,0,.2,-1] as const:[.01,0,-.2,-1] as const);
  const tile=new TerrainTile(0,0,TerrainKind.Dry,.3,[0,0,0,0],new Uint8Array(16).fill(TerrainKind.Dry),fields);
  assert.equal(tile.uniform,false);assert.equal(tile.materialAt(.25,0),TerrainKind.Forest);
});
