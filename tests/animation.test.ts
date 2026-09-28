import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, updateWorld } from '../src/jungle/world';
import { angleDelta, DEER_DIRECTIONS, DEER_CLIPS, DEER_STRIDE, DEER_RUN_STRIDE, DEER_TURN_RATE, directionIndex, TAU, turnToward, PLANT_FRAMES } from '../src/jungle/animation';
import { deerMesh, deerPose } from '../scripts/art/deer-model';
import { bakeMesh } from '../src/iso/bake/rasterize';
import { windFrames } from '../scripts/art/wind';
import { packAtlas, trimClip } from '../src/iso/bake/atlas';
import { writeQuads } from '../src/iso/batch';

test('deer take the shortest turn, stay planted while turning, and then walk forward', () => {
  assert.ok(Math.abs(angleDelta(turnToward(TAU - .1, .1, .15), .05)) < 1e-10);
  const world = createWorld(); const d = world.deer[0]!;
  Object.assign(d, { x: 1.1, y: 1.55, target: { x: 1.55, y: 1.55 }, heading: Math.PI, state: 'turn', timer: 3, gait: 0 });
  let ticks = 0;
  while (d.state === 'turn' && ticks < 200) {
    const before = d.heading; updateWorld(world, 1 / 60); ticks++;
    assert.ok(Math.abs(angleDelta(before, d.heading)) <= DEER_TURN_RATE / 60 + .015);
    assert.equal(d.x, 1.1); assert.equal(d.y, 1.55);
  }
  assert.equal(d.state, 'walk'); assert.ok(ticks > 60);
  const x = d.x, y = d.y; updateWorld(world, 1 / 60);
  assert.ok(d.x > x); assert.equal(d.y, y);
  assert.ok(Math.abs(d.gait - Math.hypot(d.x - x, d.y - y) / (DEER_STRIDE*d.size)) < 1e-9);
});

test('walking displacement follows heading and direction selection bounds angular error', () => {
  const world = createWorld();
  for (let tick = 0; tick < 6000; tick++) {
    const before = world.deer.map(d => ({ x: d.x, y: d.y })); updateWorld(world, 1 / 60);
    world.deer.forEach((d, i) => {
      const dx = d.x - before[i]!.x, dy = d.y - before[i]!.y;
      if (Math.hypot(dx, dy) > 0) assert.ok(Math.abs(angleDelta(d.heading, Math.atan2(dy, dx))) < 1e-9);
      const facing = directionIndex(d.heading) / DEER_DIRECTIONS * TAU;
      assert.ok(Math.abs(angleDelta(facing, d.heading)) <= Math.PI / DEER_DIRECTIONS + 1e-9);
    });
  }
});

test('four-beat gait keeps support feet grounded and clips loop without a pose discontinuity', () => {
  for (let step = 0; step < 100; step++) {
    const pose = deerPose('walk', step / 100);
    assert.ok(pose.feet.filter(foot => Math.abs(foot[2] - .04) < 1e-8).length >= 2);
    assert.ok(pose.feet.every(foot => foot[2] >= .04));
  }
  const a = deerPose('walk', 0), b = deerPose('walk', 1);
  a.feet.forEach((foot, i) => foot.forEach((n, j) => assert.ok(Math.abs(n - b.feet[i]![j]!) < 1e-10)));
});

test('3D baker preserves transparent margins at every heading and produces different views', () => {
  const model = deerMesh('look', 0), camera = { width: 72, height: 72, anchor: [36, 55] as [number, number], scale: 28 };
  const directions: Uint8Array[] = [];
  for (let i = 0; i < DEER_DIRECTIONS; i++) {
    const image = bakeMesh(model, i / DEER_DIRECTIONS * TAU, camera); directions.push(image.data);
    let opaque = 0;
    for (let y = 0; y < 72; y++) for (let x = 0; x < 72; x++) {
      const alpha = image.data[(y * 72 + x) * 4 + 3]!; if (alpha) opaque++;
      if (x === 0 || x === 71 || y === 0 || y === 71) assert.equal(alpha, 0, `clipped heading ${i}`);
    }
    assert.ok(opaque > 150);
  }
  assert.notDeepEqual(directions[0], directions[4]); assert.notDeepEqual(directions[0], directions[8]);
  // New running and head-transition poses must also fit, not just the standing silhouette.
  for (const clip of Object.keys(DEER_CLIPS) as (keyof typeof DEER_CLIPS)[]) for (const phase of [0, .25, .5, .75, 1]) {
    const pose = deerMesh(clip, phase);
    for (let direction = 0; direction < DEER_DIRECTIONS; direction++) {
      const image = bakeMesh(pose, direction / DEER_DIRECTIONS * TAU, camera);
      for (let i = 0; i < 72; i++) for (const p of [i, 71 * 72 + i, i * 72, i * 72 + 71])
        assert.equal(image.data[p * 4 + 3], 0, `clipped ${clip}, phase ${phase}, heading ${direction}`);
    }
  }
});

test('32-frame wind loop preserves roots exactly and closes with a normal-sized frame step', () => {
  const data = new Uint8Array(80 * 80 * 4);
  for (let i = 0; i < data.length; i += 4) data.set([(i / 4) % 255, 180, 50, 255], i);
  const frames = windFrames({ width: 80, height: 80, data }, 40, 40, 'tree', 0);
  assert.equal(frames.length, PLANT_FRAMES);
  for (const f of frames) assert.deepEqual(f.data.subarray(26 * 40 * 4), frames[0]!.data.subarray(26 * 40 * 4));
  const difference = (a: Uint8Array, b: Uint8Array) => a.reduce((n, v, i) => n + Number(v !== b[i]), 0);
  const steps = frames.map((f, i) => difference(f.data, frames[(i + 1) % frames.length]!.data));
  assert.ok(steps[steps.length - 1]! <= Math.max(...steps.slice(0, -1)) * 1.5);
  assert.ok(steps.some(n => n > 0));
});

test('atlas packing trims once per clip, deduplicates identical frames, and enforces budgets', () => {
  const a = { width: 8, height: 8, data: new Uint8Array(256) };
  a.data.set([100, 200, 30, 255], (3 * 8 + 2) * 4);
  const b = { ...a, data: a.data.slice() }; b.data.set([100, 200, 30, 255], (4 * 8 + 5) * 4);
  const sprite = { id: 'leaf', frames: [a, b, a], anchor: [4, 7] as [number, number] };
  const trimmed = trimClip(sprite); assert.deepEqual(trimmed.anchor, [2, 4]);
  assert.equal(trimmed.frames[0]!.width, 4); assert.equal(trimmed.frames[1]!.width, 4);
  const packed = packAtlas([sprite], 32, 32); assert.equal(packed.manifest.stats.frames, 3); assert.equal(packed.manifest.stats.uniqueFrames, 2);
  assert.deepEqual(packed.manifest.sprites.leaf!.frames[0], packed.manifest.sprites.leaf!.frames[2]);
  assert.deepEqual(packAtlas([sprite], 32, 32), packed);
  assert.throws(() => packAtlas([sprite], 5, 32), /width/);
  assert.throws(() => packAtlas([sprite], 32, 2), /budget/);
});

test('retained quad writer encodes UV, alpha, mirroring and positions without reallocating', () => {
  const vertices = new Float32Array(48);
  const count = writeQuads([{ id: 'test', layer: 0, depth: 0, x: 10, y: 20, width: 30, height: 40,
    region: { x: 8, y: 16, width: 8, height: 16 }, color: [255, 0, 128, 255], flip: true }], 64, 64, vertices);
  assert.equal(count, 48); assert.deepEqual([...vertices.slice(0, 4)], [10, 20, .25, .25]);
  assert.deepEqual([...vertices.slice(8, 12)], [40, 20, .125, .25]);
  assert.deepEqual([...vertices.slice(40, 44)], [40, 60, .125, .5]);
  assert.equal(vertices[7], 1);
});

test('individual pacing, acceleration, arrival braking and run strides stay physically coupled', () => {
  const world = createWorld();
  world.plants = []; // Use a clear dry corridor for precise kinematics.
  const deer = world.deer.slice(0, 2); world.deer = deer;
  deer.forEach((d, i) => Object.assign(d, { x: .5, y: 2.7 + i * .25, target: { x: 2.8, y: 2.7 + i * .25 },
    state: 'walk', heading: 0, speed: 0, pace: i ? 1.3 : .75, tripPace: 1, gait: 0, timer: 30 }));
  for (let i = 0; i < 120; i++) {
    const before = deer.map(d => d.speed); updateWorld(world, 1 / 60);
    deer.forEach((d, j) => assert.ok(Math.abs(d.speed - before[j]!) <= .6 / 60 + 1e-9));
  }
  assert.ok(deer[1]!.x > deer[0]!.x + .08);
  const d = deer[0]!;
  Object.assign(d, { x: .5, target: { x: 1.7, y: d.y }, state: 'run', gait: 0, speed: 0, timer: 30 });
  let peak = 0, slowed = false;
  for (let i = 0; i < 1200 && d.state === 'run'; i++) {
    const x = d.x, phase = d.gait; updateWorld(world, 1 / 60);
    assert.ok(Math.abs(d.gait - phase - (d.x - x) / (DEER_RUN_STRIDE*d.size)) < 1e-9);
    peak = Math.max(peak, d.speed);
    if (d.state === 'run' && d.x > 1.6 && d.speed < peak * .8) slowed = true;
    assert.ok(d.x <= 1.7 + 1e-9);
  }
  assert.ok(peak > .2); assert.ok(slowed); assert.equal(d.state, 'lower');
});

test('run has a suspension phase and head raising has continuous registered endpoints', () => {
  assert.ok(Array.from({ length: 100 }, (_, i) => deerPose('run', i / 100)).some(p => p.feet.every(f => f[2] > .041)));
  assert.deepEqual(deerPose('raise', 0).head, deerPose('graze', 0).head);
  deerPose('raise', 1).head.forEach((v, i) => assert.ok(Math.abs(v - deerPose('look', 0).head[i]!) < 1e-9));
  let z = 0;
  for (let i = 0; i <= 100; i++) { const next = deerPose('raise', i / 100).head[2]; assert.ok(next >= z); assert.ok(next - z < .28); z = next; }
});

test('wind reuses registered leaf colors rather than resampling fine source detail each pose',()=>{
  const width=19,height=23,data=new Uint8Array(width*height*4);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++)data.set([x*11,y*10,(x+y)%2?40:230,255],(y*width+x)*4);
  const w=9,h=11,palette=new Set<string>();
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const i=(Math.floor((y+.5)/h*height)*width+Math.floor((x+.5)/w*width))*4;
    palette.add([...data.subarray(i,i+4)].join(','));
  }
  for(const frame of windFrames({width,height,data},w,h,'tree',0))for(let i=0;i<frame.data.length;i+=4)
    if(frame.data[i+3])assert.ok(palette.has([...frame.data.subarray(i,i+4)].join(',')));
});

test('shelf packing reuses earlier row gaps without overlapping frames or their gutters',()=>{
  const sprite=(id:string,width:number,height:number)=>({id,trim:false,anchor:[0,0] as [number,number],frames:[{width,height,data:new Uint8Array(width*height*4).fill(id.charCodeAt(0))}]});
  const packed=packAtlas([sprite('a',18,10),sprite('b',18,9),sprite('c',8,8)],32,28);
  const a=packed.manifest.sprites.a!.frames[0]!,c=packed.manifest.sprites.c!.frames[0]!;
  assert.equal(c.y,a.y);assert.ok(c.x>=a.x+a.width+2);assert.ok(packed.image.height<=28);
});
