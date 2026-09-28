import sharp from 'sharp';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { MemoryRenderer } from '../src/iso/render';
import { createWorld, HABITATS, updateWorld } from '../src/jungle/world';
import { composeScene, type AtlasManifest } from '../src/jungle/scene';
const manifest: AtlasManifest = JSON.parse(await readFile('public/assets/jungle.json', 'utf8'));
const raw = await sharp('public/assets/jungle.png').ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const renderer = new MemoryRenderer({ width: raw.info.width, height: raw.info.height, data: raw.data });
await mkdir('artifacts', { recursive: true });
const view = { width: 900, height: 600, panX: 0, panY: 0, zoom: 1, grid: false };
for (const habitat of HABITATS) {
  const world = createWorld(2718, habitat);
  for (let i = 0; i < 120; i++) updateWorld(world, 1 / 60);
  const frame = composeScene(world, manifest, view); frame.clear = [233, 237, 226, 255];
  renderer.render(frame);
  await sharp(renderer.pixels.data, { raw: { width: view.width, height: view.height, channels: 4 } }).png().toFile(`artifacts/${habitat}.png`);
  await writeFile(`artifacts/${habitat}.json`, JSON.stringify({ seed: world.seed, time: world.time, deer: world.deer, frame }, null, 2));
}
// Contact strip makes frame order, baseline jitter and loop changes easy to inspect.
const world = createWorld(); const frames: Buffer[] = [];
for (let i = 0; i < 8; i++) {
  const frame = composeScene(world, manifest, { ...view, width: 450, height: 300 }); frame.clear = [233, 237, 226, 255];
  renderer.render(frame); frames.push(Buffer.from(renderer.pixels.data));
  for (let j = 0; j < 30; j++) updateWorld(world, 1 / 60);
}
await sharp({ create: { width: 1800, height: 600, channels: 4, background: '#e9ede2' } })
  .composite(frames.map((input, i) => ({ input, raw: { width: 450, height: 300, channels: 4 }, left: i % 4 * 450, top: Math.floor(i / 4) * 300 })))
  .png().toFile('artifacts/animation-strip.png');
console.log('Headless PNGs, draw lists and animation strip → artifacts/');

// Current streamed demo: actual sloping terrain, agents and different landscape regions.
const { InfiniteWorld } = await import('../src/jungle/infinite');
const { cameraBounds, composeInfinite } = await import('../src/jungle/infinite-scene');
const { TerrainKind } = await import('../src/jungle/terrain');
for (const [name, kind] of [['forest', TerrainKind.Forest], ['dry', TerrainKind.Dry], ['meadow', TerrainKind.Meadow], ['lake', TerrainKind.Shallow]] as const) {
  const world = new InfiniteWorld(2718), position = world.landmark(kind);
  const view = { width: 1000, height: 600, pixelRatio: 1, zoom: 1, grid: false, cameraX: position.x, cameraY: position.y };
  world.ensure(cameraBounds(view));
  for (let i = 0; i < 180; i++) world.update(1 / 60);
  const frame = composeInfinite(world, manifest, view);
  renderer.render(frame);
  await sharp(renderer.pixels.data, { raw: { width: view.width, height: view.height, channels: 4 } }).png().toFile(`artifacts/expedition-${name}.png`);
  await writeFile(`artifacts/expedition-${name}.json`, JSON.stringify({ seed: world.seed, view, stats: world.stats, frame }, null, 2));
}
console.log('Streamed forest, dryland, meadow and lakeshore snapshots → artifacts/expedition-*.png');

const { ECO_KINDS } = await import('../src/jungle/ecology');
for(const kind of ['deer','toucan','orangutan','jaguar',...ECO_KINDS] as const){
 const world=new InfiniteWorld(2718),position=world.wildlifeLandmark(kind);
 const view={width:1000,height:700,pixelRatio:1,zoom:1.35,grid:false,cameraX:position.x,cameraY:position.y};
 world.ensure(cameraBounds(view));for(let i=0;i<480;i++)world.update(1/60);
 if(kind==='whale')for(let i=0;i<3600&&!world.agents.some(a=>a.kind==='whale'&&'altitude' in a&&Number(a.altitude)>-.5);i++)world.update(1/60);
 const frame=composeInfinite(world,manifest,view);renderer.render(frame);
 await sharp(renderer.pixels.data,{raw:{width:view.width,height:view.height,channels:4}}).png().toFile(`artifacts/wildlife-${kind}.png`);
 await writeFile(`artifacts/wildlife-${kind}.json`,JSON.stringify({seed:world.seed,view,stats:world.stats,animals:world.agents.filter(a=>a.speed!==undefined),frame},null,2));
}
console.log('Wildlife habitat scenes → artifacts/wildlife-*.png');

// Same seed and scale: inspect the quiet opening and the mature forest beyond it.
for(const [name,distance] of [['opening',0],['interior',64]] as const){
 const world=new InfiniteWorld(),start=world.landmark(TerrainKind.Forest,world.origin.x+distance,world.origin.y);
 const view={width:1000,height:650,pixelRatio:1,zoom:1,grid:false,cameraX:start.x,cameraY:start.y};
 world.ensure(cameraBounds(view));const frame=composeInfinite(world,manifest,view,1);renderer.render(frame);
 await sharp(renderer.pixels.data,{raw:{width:view.width,height:view.height,channels:4}}).png().toFile(`artifacts/journey-${name}.png`);
 await writeFile(`artifacts/journey-${name}.json`,JSON.stringify({seed:world.seed,origin:world.origin,view,stats:world.stats},null,2));
}
