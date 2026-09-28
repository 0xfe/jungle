import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import { deerMesh } from './deer-model';
import { bakeMesh } from '../../src/iso/bake/rasterize';
import { DEER_CLIPS, DEER_DIRECTIONS, TAU, type DeerClip } from '../../src/jungle/animation';
await mkdir('artifacts', { recursive: true });
const camera = { width: 72, height: 72, anchor: [36, 55] as [number, number], scale: 28 };
const clips: DeerClip[] = ['look', 'graze', 'walk', 'turn', 'run', 'raise'];
const composites: sharp.OverlayOptions[] = [];
for (const [row, clip] of clips.entries()) for (let d = 0; d < DEER_DIRECTIONS; d++) {
  const pixels = bakeMesh(deerMesh(clip, .15), d / DEER_DIRECTIONS * TAU, camera);
  composites.push({ input: Buffer.from(pixels.data), raw: { width: 72, height: 72, channels: 4 }, left: d * 72, top: row * 72 });
}
const sheet = await sharp({ create: { width: DEER_DIRECTIONS * 72, height: clips.length * 72, channels: 4, background: '#dce6ce' } }).composite(composites).png().toBuffer();
await sharp(sheet).resize(DEER_DIRECTIONS * 144, clips.length * 144, { kernel: 'nearest' }).png().toFile('artifacts/deer-directions.png');
for (const clip of ['walk', 'run'] as const) {
  const strip: sharp.OverlayOptions[] = [], count = DEER_CLIPS[clip];
  for (let row = 0; row < 4; row++) for (let step = 0; step < count; step++) {
    const pixels = bakeMesh(deerMesh(clip, step / count), [0, Math.PI / 4, Math.PI, Math.PI * 1.5][row]!, camera);
    strip.push({ input: Buffer.from(pixels.data), raw: { width: 72, height: 72, channels: 4 }, left: step * 72, top: row * 72 });
  }
  const image = await sharp({ create: { width: count * 72, height: 288, channels: 4, background: '#dce6ce' } }).composite(strip).png().toBuffer();
  await sharp(image).resize(count * 144, 576, { kernel: 'nearest' }).png().toFile(`artifacts/deer-${clip}-strip.png`);
}
console.log('Direction, walking and running contact sheets → artifacts/');

const {wildlifeMesh,WILDLIFE_CLIPS}=await import('./wildlife-model');
for(const kind of ['toucan','orangutan','jaguar'] as const){
 const clips=kind==='toucan'?['rest','travel'] as const:kind==='orangutan'?['rest','travel','climb'] as const:['rest','travel','chase'] as const;
 const panels:sharp.OverlayOptions[]=[];
 const camera={width:80,height:80,anchor:[40,65] as [number,number],scale:28};
 for(const [row,clip] of clips.entries())for(let d=0;d<16;d++){
  const image=bakeMesh(wildlifeMesh(kind,clip,.2),d/16*TAU,camera);
  panels.push({input:Buffer.from(image.data),raw:{width:80,height:80,channels:4},left:d*80,top:row*80});
 }
 const source=await sharp({create:{width:1280,height:clips.length*80,channels:4,background:'#dce6ce'}}).composite(panels).png().toBuffer();
 await sharp(source).resize(2560,clips.length*160,{kernel:'nearest'}).png().toFile(`artifacts/${kind}-directions.png`);
 for(const clip of clips){const strip:sharp.OverlayOptions[]=[];
  for(let frame=0;frame<WILDLIFE_CLIPS[clip];frame++){const image=bakeMesh(wildlifeMesh(kind,clip,frame/WILDLIFE_CLIPS[clip]),Math.PI/4,camera);strip.push({input:Buffer.from(image.data),raw:{width:80,height:80,channels:4},left:frame*80,top:0});}
  await sharp({create:{width:WILDLIFE_CLIPS[clip]*80,height:80,channels:4,background:'#dce6ce'}}).composite(strip).png().toFile(`artifacts/${kind}-${clip}-strip.png`);
 }
}
console.log('Wildlife directional and action sheets → artifacts/');

const {ecologyMesh}=await import('./ecology-model');
const {ECO_KINDS,ECO_SPECS,ecoClips}=await import('../../src/jungle/ecology');
for(const kind of ECO_KINDS){
 const spec=ECO_SPECS[kind],camera={width:112,height:112,anchor:[56,87] as [number,number],scale:spec.cameraScale},clips=Object.entries(ecoClips(kind));
 const panels:sharp.OverlayOptions[]=[];
 for(const [row,[clip]] of clips.entries())for(let d=0;d<spec.directions;d++){
  const pixels=bakeMesh(ecologyMesh(kind,clip,.25),d/spec.directions*TAU,camera);
  panels.push({input:Buffer.from(pixels.data),raw:{width:112,height:112,channels:4},left:d*112,top:row*112});
 }
 await sharp({create:{width:spec.directions*112,height:clips.length*112,channels:4,background:'#dce6ce'}}).composite(panels).png().toFile(`artifacts/${kind}-directions.png`);
 for(const [clip,count] of clips){const panels:sharp.OverlayOptions[]=[];
  for(let frame=0;frame<count;frame++){const pixels=bakeMesh(ecologyMesh(kind,clip,frame/(clip==='drink'||clip==='spray'?count-1:count)),Math.PI/4,camera);panels.push({input:Buffer.from(pixels.data),raw:{width:112,height:112,channels:4},left:frame*112,top:0});}
  await sharp({create:{width:count*112,height:112,channels:4,background:'#dce6ce'}}).composite(panels).png().toFile(`artifacts/${kind}-${clip}-strip.png`);
 }
}
console.log('Canopy, land, beach and water wildlife sheets → artifacts/');
