import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { MemoryRenderer } from '../src/iso/render';
import { createWorld, updateWorld, HABITATS } from '../src/jungle/world';
import { composeScene, type AtlasManifest } from '../src/jungle/scene';

const manifest: AtlasManifest = JSON.parse(await readFile('public/assets/jungle.json', 'utf8'));
const raw = await sharp('public/assets/jungle.png').ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const atlas = { width: raw.info.width, height: raw.info.height, data: raw.data };
const view = { width: 720, height: 480, panX: 0, panY: 0, zoom: 1, grid: false };
const digest = (data: Uint8Array) => createHash('sha256').update(data).digest('hex');

test('atlas frames are disjoint, in bounds and transparent; keyed sources have no magenta leaks', () => {
  // Registered ship pieces can be solid interior pixels, or empty in individual
  // poses. Their complete silhouettes are reconstructed in spacecraft.test.ts.
  const spacecraftParts=new Set([...Object.values(manifest.spacecraftParts??{}),...Object.values(manifest.zenParts??{})].flat());
  for(const name of spacecraftParts)assert.ok(manifest.sprites[name],`missing spacecraft part ${name}`);
  const occupied = new Set<number>();
  const shared = new Set<string>();
  for (const [name, sprite] of Object.entries(manifest.sprites)) {
    assert.ok(sprite.frames.length > 0);
    for (const frame of sprite.frames) {
      const key = JSON.stringify(frame); if (shared.has(key)) continue; shared.add(key);
      assert.ok(frame.x >= 0 && frame.y >= 0 && frame.x + frame.width <= atlas.width && frame.y + frame.height <= atlas.height);
      let transparent = 0, opaque = 0;
      for (let y = frame.y; y < frame.y + frame.height; y++) for (let x = frame.x; x < frame.x + frame.width; x++) {
        const p = y * atlas.width + x, i = p * 4;
        assert.ok(!occupied.has(p), `${name}: overlapping frame`); occupied.add(p);
        if (atlas.data[i + 3] === 0) transparent++; else opaque++;
        // Only the original tree/plant sources use a magenta key. The new
        // alpha-authored flowers deliberately include vivid pink/purple petals.
        if (/^(tree|plant)-/.test(name))assert.ok(!(atlas.data[i]! > 180 && atlas.data[i + 2]! > 180 && atlas.data[i + 1]! < 90 && atlas.data[i + 3]! > 0), `${name}: chroma key leaked`);
      }
      assert.ok(spacecraftParts.has(name)||((transparent > 0 || name.startsWith('terrain-') || name.startsWith('ground-blend-') || name==='volcano-molten' || name==='volcano-crust') && opaque > 0), `${name}: expected isolated artwork`);
    }
  }
});
test('all animations contain distinct frame pixels', () => {
  for (const [name, sprite] of Object.entries(manifest.sprites)) {
    if (sprite.frames.length < 2) continue;
    const hashes = sprite.frames.map(f => {
      const data: number[] = [];
      for (let y = f.y; y < f.y + f.height; y++) data.push(...atlas.data.subarray((y * atlas.width + f.x) * 4, (y * atlas.width + f.x + f.width) * 4));
      return digest(new Uint8Array(data));
    });
    assert.ok(new Set(hashes).size > 1, `${name}: all poses are identical`);
  }
});
test('the shared atlas keeps a transparent gutter around every unique packed frame',()=>{
  const seen=new Set<string>();
  for(const sprite of Object.values(manifest.sprites))for(const f of sprite.frames){
    const key=`${f.x},${f.y}`;if(seen.has(key))continue;seen.add(key);
    let alpha=0;
    for(let x=f.x-1;x<=f.x+f.width;x++)for(const y of [f.y-1,f.y+f.height])alpha+=atlas.data[(y*atlas.width+x)*4+3]!;
    for(let y=f.y;y<f.y+f.height;y++)for(const x of [f.x-1,f.x+f.width])alpha+=atlas.data[(y*atlas.width+x)*4+3]!;
    assert.equal(alpha,0,`gutter at ${key}`);
  }
});
test('headless scene has sixteen ground tiles, depth sorted animals, and animated output', () => {
  const world = createWorld(), renderer = new MemoryRenderer(atlas);
  const frame = composeScene(world, manifest, view);
  assert.equal(frame.commands.filter(c => c.id.startsWith('tile-')).length, 16);
  assert.equal(frame.commands.filter(c => /^deer-\d$/.test(c.id)).length, 8);
  const objects = frame.commands.filter(c => c.layer === 2);
  for (let i = 1; i < objects.length; i++) assert.ok(objects[i]!.depth >= objects[i - 1]!.depth);
  renderer.render(frame); const initial = digest(renderer.pixels.data);
  renderer.render(composeScene(createWorld(), manifest, view)); assert.equal(digest(renderer.pixels.data), initial);
  for (let i = 0; i < 60; i++) updateWorld(world, 1 / 60);
  renderer.render(composeScene(world, manifest, view)); assert.notEqual(digest(renderer.pixels.data), initial);
});
test('each habitat renders actual colored pixels and stays centered at initial zoom', () => {
  const renderer = new MemoryRenderer(atlas), hashes = new Set<string>();
  for (const habitat of HABITATS) {
    const frame = composeScene(createWorld(2718, habitat), manifest, view);
    renderer.render(frame); hashes.add(digest(renderer.pixels.data));
    let count = 0; let minX = view.width, maxX = 0;
    for (let y = 0; y < view.height; y++) for (let x = 0; x < view.width; x++) {
      if (renderer.pixels.data[(y * view.width + x) * 4 + 3]! > 180) { count++; minX = Math.min(x, minX); maxX = Math.max(x, maxX); }
    }
    assert.ok(count > 30000 && count < view.width * view.height * .6);
    assert.ok(Math.abs((minX + maxX) / 2 - view.width / 2) < 10);
    assert.ok(minX > 0 && maxX < view.width - 1);
  }
  assert.equal(hashes.size, 3);
});
test('offscreen content is culled and a missing sprite fails loudly', () => {
  const frame = composeScene(createWorld(), manifest, { ...view, panX: 20000 });
  assert.equal(frame.commands.length, 0);
  assert.throws(() => composeScene(createWorld(), { ...manifest, sprites: {} }, view), /Unknown sprite/);
});

test('alpha-authored flowering artwork preserves vivid petals instead of treating them as chroma key',()=>{
 let petals=0;
 for(const [name,sprite] of Object.entries(manifest.sprites))if(/^patch-(bloom|flowers)-.*-base$/.test(name)){
  const f=sprite.frames[0]!;
  for(let y=f.y;y<f.y+f.height;y++)for(let x=f.x;x<f.x+f.width;x++){
   const i=(y*atlas.width+x)*4;if(atlas.data[i]!>130&&atlas.data[i+2]!>120&&atlas.data[i]!>atlas.data[i+1]!*1.4&&atlas.data[i+2]!>atlas.data[i+1]!*1.2&&atlas.data[i+3]!>100)petals++;
  }
 }
 assert.ok(petals>30,'retain the reviewed saturated pink/purple flowers');
});
