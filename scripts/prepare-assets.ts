import sharp from 'sharp';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { hash, unproject } from '../src/iso/math';
import { HABITATS, TILE, WORLD_SIZE, waterAt } from '../src/jungle/world';
import { DEER_CLIPS, DEER_DIRECTIONS, TAU } from '../src/jungle/animation';
import { packAtlas, type BakeSprite } from '../src/iso/bake/atlas';
import { bakeMesh } from '../src/iso/bake/rasterize';
import { meshToObj } from '../src/iso/bake/mesh';
import { deerMesh } from './art/deer-model';
import { wildlifeMesh, WILDLIFE_CLIPS, type WildlifeClip } from './art/wildlife-model';
import type { WildlifeKind } from '../src/jungle/agents/wildlife';
import { ecologyMesh } from './art/ecology-model';
import { ECO_KINDS, ECO_SPECS, ecoClips } from '../src/jungle/ecology';
import { windFrames } from './art/wind';
import { vineFrames } from './art/vines';
import { isolatePlant } from './art/foliage';

const sha = (data: Uint8Array | string) => createHash('sha256').update(data).digest('hex');
const dependencies = ['scripts/art/elephant-model.ts', 'src/jungle/elephant-pose.ts', 'src/agents/startle.ts','src/agents/flight.ts', 'src/jungle/flight.ts', 'src/jungle/botany.ts', 'assets/source/forest-forms.png', 'scripts/art/vines.ts', 'scripts/art/foliage.ts', 'scripts/prepare-assets.ts', 'scripts/art/ecology-model.ts', 'src/jungle/ecology.ts', 'src/jungle/agents/ecological.ts', 'scripts/art/deer-model.ts', 'scripts/art/wildlife-model.ts', 'src/jungle/agents/wildlife.ts', 'src/agents/social.ts', 'assets/source/tree-forms.png', 'scripts/art/wind.ts',
  'src/iso/bake/mesh.ts', 'src/iso/bake/rasterize.ts', 'src/iso/bake/atlas.ts', 'src/iso/math.ts',
  'src/iso/spatial.ts', 'src/jungle/animation.ts', 'src/jungle/world.ts', 'src/jungle/agents/deer.ts', 'src/jungle/agents/fixed.ts', 'src/jungle/agents/index.ts', 'src/agents/core.ts', 'src/agents/motion.ts', 'src/agents/system.ts', 'src/agents/index.ts', 'assets/source/trees.png', 'assets/source/plants.png',
  'package-lock.json'];
const sources: Record<string, string> = {};
for (const file of dependencies) sources[file] = sha(await readFile(file));
const fingerprint = sha(JSON.stringify(sources));
// A cache hit validates the artifacts as well as the input hashes. No stale/missing output success.
try {
  const cache = JSON.parse(await readFile('assets/derived.json', 'utf8'));
  if (!process.argv.includes('--force') && cache.fingerprint === fingerprint &&
      cache.atlas === sha(await readFile('public/assets/jungle.png')) &&
      cache.manifest === sha(await readFile('public/assets/jungle.json')) &&
      cache.model === sha(await readFile('assets/models/deer.obj')) &&
      (await Promise.all(['toucan','orangutan','jaguar',...ECO_KINDS].map(async kind => cache.models?.[kind] === sha(await readFile(`assets/models/${kind}.obj`))))).every(Boolean)) {
    console.log('Assets unchanged; verified atlas/model hashes, skipping bake.'); process.exit(0);
  }
} catch { /* First build, changed dependencies or missing generated outputs: rebuild. */ }
const started = performance.now();
const inputs: BakeSprite[] = [];
for (const spec of [
  { file: 'trees', prefix: 'tree' as const, w: 128, h: 96, anchor: [64, 93] as [number, number] },
  { file: 'plants', prefix: 'plant' as const, w: 96, h: 64, anchor: [48, 58] as [number, number] },
]) {
  const decoded = await sharp(await readFile(`assets/source/${spec.file}.png`)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: sw, height: sh } = decoded.info;
  if (sw % 4 || sh % 4) throw new Error(`${spec.file}: expected a 4 × 4 source grid`);
  let removed = 0;
  for (let i = 0; i < decoded.data.length; i += 4) {
    const r = decoded.data[i]!, g = decoded.data[i + 1]!, b = decoded.data[i + 2]!;
    if (r > 60 && b > 60 && r > g * 1.6 && b > g * 1.6 && b > r * .7 && r > b * .7) {
      decoded.data.fill(0, i, i + 4); removed++;
    }
  }
  if (removed < sw * sh * .15) throw new Error(`${spec.file}: missing reviewed magenta background`);
  for (let row = 0; row < 4; row++) {
    // One registered source pose gives a continuous loop without generated silhouette jitter.
    const source = await sharp(decoded.data, { raw: { width: sw, height: sh, channels: 4 } })
      .extract({ left: 0, top: row * sh / 4, width: sw / 4, height: sh / 4 }).raw().toBuffer();
    inputs.push({ id: `${spec.prefix}-${row}`, anchor: spec.anchor,
      frames: windFrames({ width: sw / 4, height: sh / 4, data: source }, spec.w, spec.h, spec.prefix, row) });
  }
}
// The generated source has real alpha. Normalize each reviewed cell by its opaque bounds.
const forms = await sharp('assets/source/tree-forms.png').ensureAlpha().raw().toBuffer({resolveWithObject:true});
for(let i=0;i<forms.data.length;i+=4)if(forms.data[i]!>180&&forms.data[i+2]!>180&&forms.data[i+1]!<90)forms.data.fill(0,i,i+4);
for(let row=0;row<4;row++)for(let column=0;column<2;column++){
 const left=Math.round(column*forms.info.width/3),top=Math.round(row*forms.info.height/4),right=Math.round((column+1)*forms.info.width/3),bottom=Math.round((row+1)*forms.info.height/4);
 const raw=await sharp(forms.data,{raw:{width:forms.info.width,height:forms.info.height,channels:4}}).extract({left,top,width:right-left,height:bottom-top}).raw().toBuffer();
 const clean=isolatePlant({width:right-left,height:bottom-top,data:raw});
 const cell=await sharp(clean.data,{raw:{width:clean.width,height:clean.height,channels:4}}).png().toBuffer();
 const normalized=await sharp(cell).trim({threshold:15}).resize(96,90,{fit:'contain',position:'bottom',background:{r:0,g:0,b:0,alpha:0},kernel:'nearest'}).raw().toBuffer();
 for(let i=0;i<normalized.length;i+=4)if(normalized[i]!>180&&normalized[i+2]!>180&&normalized[i+1]!<90)normalized.fill(0,i,i+4);
 inputs.push({id:`tree-${row}-form-${column+1}`,anchor:[48,88],frames:windFrames({width:96,height:90,data:normalized},96,90,'tree',row)});
}
// New structural forms share the same 32-pose wind contract. Logical size is
// independent of packed texel resolution; small plants do not need tree-sized cells.
const forest=await sharp('assets/source/forest-forms.png').ensureAlpha().raw().toBuffer({resolveWithObject:true});
const formIDs=[
 'tree-0-form-3','tree-0-form-4','tree-0-form-5','tree-0-form-6',
 'tree-1-form-3','tree-1-form-4','tree-2-form-3','tree-2-form-4',
 'tree-3-form-3','tree-3-form-4','plant-1-form-1','plant-1-form-2',
 'plant-0-form-1','plant-0-form-2','plant-2-form-1','plant-2-form-2',
];
for(let i=0;i<formIDs.length;i++){
 const id=formIDs[i]!,tree=id.startsWith('tree'),variant=Number(id.split('-')[1]),row=i>>2,col=i%4;
 // Reviewed row gutters: generation retained unequal row heights after layout correction.
 const rows=[0,.30,.578,.827,1];
 const left=Math.round(col*forest.info.width/4),right=Math.round((col+1)*forest.info.width/4),top=Math.round(rows[row]!*forest.info.height),bottom=Math.round(rows[row+1]!*forest.info.height);
 const raw=await sharp(forest.data,{raw:{width:forest.info.width,height:forest.info.height,channels:4}}).extract({left,top,width:right-left,height:bottom-top}).raw().toBuffer();
 const clean=isolatePlant({width:right-left,height:bottom-top,data:raw});
 const cell=await sharp(clean.data,{raw:{width:clean.width,height:clean.height,channels:4}}).png().toBuffer();
 const width=tree?72:56,height=tree?88:44;
 const body=await sharp(cell).trim({threshold:15}).resize(width-8,height-8,{fit:'contain',position:'bottom',background:{r:0,g:0,b:0,alpha:0},kernel:'nearest'}).extend({top:4,bottom:4,left:4,right:4,background:{r:0,g:0,b:0,alpha:0}}).raw().toBuffer();
 inputs.push({id,anchor:[width/2,height-5],frames:windFrames({width,height,data:body},width,height,tree?'tree':'plant',variant)});
}
for(let v=0;v<4;v++)inputs.push({id:`vine-${v}`,anchor:[16,86],frames:vineFrames(v)});
const camera = { width: 72, height: 72, anchor: [36, 55] as [number, number], scale: 28 };
for (const [clip, count] of Object.entries(DEER_CLIPS) as [keyof typeof DEER_CLIPS, number][]) {
  // Reuse posed geometry across directions: only the view changes.
  const poses = Array.from({ length: count }, (_, frame) => deerMesh(clip, frame / (clip === 'raise' ? count - 1 : count)));
  for (let direction = 0; direction < DEER_DIRECTIONS; direction++) inputs.push({
    id: `deer-${clip}-${direction}`, anchor: camera.anchor,
    frames: poses.map(mesh => bakeMesh(mesh, direction / DEER_DIRECTIONS * TAU, camera)),
  });
}
const wildlifeCamera={width:80,height:80,anchor:[40,65] as [number,number],scale:28};
for(const kind of ['toucan','orangutan','jaguar'] as WildlifeKind[]){
 const clips:WildlifeClip[]=kind==='orangutan'?['rest','travel','climb']:kind==='jaguar'?['rest','travel','chase']:['rest','travel'];
 for(const clip of clips){const count=WILDLIFE_CLIPS[clip],poses=Array.from({length:count},(_,i)=>wildlifeMesh(kind,clip,i/count));
  for(let direction=0;direction<16;direction++)inputs.push({id:`${kind}-${clip}-${direction}`,anchor:wildlifeCamera.anchor,frames:poses.map(mesh=>bakeMesh(mesh,direction/16*TAU,wildlifeCamera))});
 }
}
for(const kind of ECO_KINDS){
 const spec=ECO_SPECS[kind],camera={width:112,height:112,anchor:[56,87] as [number,number],scale:spec.cameraScale};
 for(const [clip,count] of Object.entries(ecoClips(kind))){
  const poses=Array.from({length:count},(_,i)=>ecologyMesh(kind,clip,i/(clip==='drink'||clip==='spray'?count-1:count)));
  for(let d=0;d<spec.directions;d++)inputs.push({id:`${kind}-${clip}-${d}`,anchor:camera.anchor,frames:poses.map(mesh=>bakeMesh(mesh,d/spec.directions*TAU,camera))});
 }
}
// Small porous root-bed textures: localized soil flecks and recognizable leaves, not broad mud disks.
for(let variant=0;variant<4;variant++){
 const width=64,height=64,data=new Uint8Array(width*height*4);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const u=(x-32)/25,v=(y-32)/25,d=u*u+v*v,grain=hash(x,y,variant+734);
  const lobe=.75+Math.sin(Math.atan2(v,u)*5+variant)*.22;
  if(d<lobe&&grain<.55){const alpha=Math.round(Math.max(0,1-d/lobe)*(20+grain*50));data.set([96,79,48,alpha],(y*width+x)*4);}
 }
 for(let i=0;i<16;i++){
  const angle=hash(i,1,variant+22)*TAU,r=Math.sqrt(hash(i,2,variant+78))*24,cx=Math.round(32+Math.cos(angle)*r),cy=Math.round(32+Math.sin(angle)*r);
  const tint=i%3===0?[152,116,52,190]:i%3===1?[116,94,43,175]:[123,122,61,155];
  for(let dy=-1;dy<=1;dy++)for(let dx=-2;dx<=2;dx++)if(Math.abs(dx)+Math.abs(dy)<3){const x=cx+dx,y=cy+dy+(i%2?Math.sign(dx):0);if(x>0&&x<63&&y>0&&y<63)data.set(tint,(y*width+x)*4);}
 }
 inputs.push({id:`litter-${variant}`,anchor:[32,32],frames:[{width,height,data}]});
}
function rgb(hex: string): number[] { const n = parseInt(hex, 16); return [n >> 16 & 255, n >> 8 & 255, n & 255, 255]; }
const palettes = [
  ['587c38', '62863d', '6c9143', '789948', '527334'],
  ['71823c', '859345', '8b9a4c', '9ca554', '667937'],
  ['416f46', '4b7d4d', '578553', '638e56', '3a6840'],
];
for (const [biome, habitat] of HABITATS.entries()) {
  for (let ty = 0; ty < WORLD_SIZE.height; ty++) for (let tx = 0; tx < WORLD_SIZE.width; tx++) {
    const w = 192, h = 116, data = Buffer.alloc(w * h * 4);
    for (let py = 0; py < h; py++) for (let px = 0; px < w; px++) {
      const local = unproject({ x: px + .5 - w / 2, y: py + .5 }, TILE);
      const inside = local.x >= 0 && local.x < 1 && local.y >= 0 && local.y < 1;
      let rgba: number[] | undefined;
      const n = hash(Math.floor(px / 2) + tx * 97, Math.floor(py / 2) + ty * 47, 21);
      if (inside) {
        const x = tx + local.x, y = ty + local.y, water = waterAt(x, y, habitat);
        if (water > 0) rgba = rgb(water < .2 ? '68a89a' : water < .45 ? '398e85' : n > .8 ? '3c9e97' : '307f7f');
        else if (water > -.24) rgba = rgb(n > .5 ? 'a5a365' : '83985a');
        else {
          rgba = rgb(palettes[biome]![Math.floor(n * 5)]!);
          // Small earth patches and scattered light grass, never tile-wide noise seams.
          const grain = hash(Math.floor(x * 90), Math.floor(y * 90), 51);
          if (grain > .965) rgba = rgb('a9ad64');
          if (grain < .025) rgba = rgb('778348');
        }
        if ((tx === 0 && local.x < .016) || (ty === 0 && local.y < .016)) rgba = rgb('91ab58');
      } else {
        // Only external south/east faces have exposed soil; internal tile faces never occlude.
        for (let z = 1; z <= 15; z++) {
          const p = unproject({ x: px + .5 - w / 2, y: py + .5 - z }, TILE);
          if (p.x >= 0 && p.x < 1 && p.y >= 0 && p.y < 1 && ((tx === WORLD_SIZE.width - 1 && local.x >= 1) || (ty === WORLD_SIZE.height - 1 && local.y >= 1))) {
            rgba = rgb(z < 4 ? (px < 96 ? '456735' : '395a32') : px < 96 ? (n > .75 ? '665139' : '544333') : (n > .8 ? '4a4031' : '3d382d'));
            break;
          }
        }
      }
      if (rgba) data.set(rgba, (py * w + px) * 4);
    }
    inputs.push({ id: `ground-${biome}-${tx}-${ty}`, anchor: [96, 0], trim: false, frames: [{ width: w, height: h, data }] });
  }
}
// Reusable opaque surface textures, mapped onto sloping terrain quads at runtime.
const terrainColors = [
  ['527338', '638440', '719348'], ['7b9247', '899e53', '96a95a'], ['aa985e', 'b8a76d', 'c4b67b'],
  ['788172', '8c9281', '9aa08d'], ['4caaa0', '64b7a7', '77c1ae'], ['287c85', '308990', '38969a'],
];
for (let material = 0; material < terrainColors.length; material++) for (let variant = 0; variant < 4; variant++) {
  const size = 64, data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const grain = hash(x >> 1, y >> 1, material * 177 + variant * 83 + 119);
    data.set(rgb(terrainColors[material]![Math.floor(grain * 3)]!), (y * size + x) * 4);
  }
  inputs.push({ id: `terrain-${material}-${variant}`, anchor: [0, 0], trim: false, frames: [{ width: size, height: size, data }] });
}
for (const [id, width, height, anchor] of [
  ['shadow', 64, 24, [32, 12]], ['island-shadow', 400, 190, [200, 75]],
] as const) {
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const d = ((x - width / 2) / (width / 2)) ** 2 + ((y - height / 2) / (height / 2)) ** 2;
    if (d < 1) data.set([7, 24, 18, Math.round((1 - d) ** 2 * (id === 'shadow' ? 200 : 90))], (y * width + x) * 4);
  }
  inputs.push({ id, anchor: [...anchor], frames: [{ width, height, data }] });
}
const { image, manifest } = packAtlas(inputs, 4096, 4096);
// The broad, soft legacy-island shadow needs fewer texels, with the same logical bounds.
const islandShadow=manifest.sprites['island-shadow']!;islandShadow.width*=2;islandShadow.height*=2;islandShadow.anchor=[islandShadow.anchor[0]*2,islandShadow.anchor[1]*2];
// Preserve world-space source sizing while economizing texels, not animation cadence.
for(const id of [...formIDs,...Array.from({length:8},(_,i)=>`tree-${i>>1}-form-${i%2+1}`)]){
 const sprite=manifest.sprites[id]!,factor=formIDs.includes(id)?1.3:116/96;
 sprite.width*=factor;sprite.height*=factor;sprite.anchor=[sprite.anchor[0]*factor,sprite.anchor[1]*factor];
}
await mkdir('public/assets', { recursive: true }); await mkdir('assets/models', { recursive: true });
for(const kind of ['toucan','orangutan','jaguar'] as WildlifeKind[])await writeFile(`assets/models/${kind}.obj`,meshToObj(wildlifeMesh(kind,'rest',0)).replaceAll('deer',kind));
for(const kind of ECO_KINDS)await writeFile(`assets/models/${kind}.obj`,meshToObj(ecologyMesh(kind,'rest',0)).replaceAll('deer',kind));
const model = meshToObj(deerMesh('look', 0));
await writeFile('assets/models/deer.obj', model);
await sharp(image.data, { raw: { width: image.width, height: image.height, channels: 4 } }).png().toFile('public/assets/jungle.png');
const json = JSON.stringify(manifest, null, 2) + '\n';
await writeFile('public/assets/jungle.json', json);
const png = await readFile('public/assets/jungle.png');
const models:Record<string,string>={};for(const kind of ['toucan','orangutan','jaguar',...ECO_KINDS])models[kind]=sha(await readFile(`assets/models/${kind}.obj`));
await writeFile('assets/derived.json', JSON.stringify({ pipeline: 6, fingerprint, sources, atlas: sha(png), manifest: sha(json), model: sha(model), models,
  stats: { ...manifest.stats, pngBytes: png.length, width: image.width, height: image.height } }, null, 2) + '\n');
console.log(`Baked ${manifest.stats.frames} frames (${manifest.stats.uniqueFrames} unique) → ${image.width} × ${image.height}; ${(image.data.length / 1048576).toFixed(2)} MiB RGBA, ${(png.length / 1024).toFixed(0)} KiB PNG; ${((performance.now() - started) / 1000).toFixed(2)}s.`);
