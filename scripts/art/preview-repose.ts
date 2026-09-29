import sharp from 'sharp';
import { mkdir, readFile } from 'node:fs/promises';
import { bakeMesh } from '../../src/iso/bake/rasterize';
import { deerMesh } from './deer-model';
import { wildlifeMesh } from './wildlife-model';
import { ecologyMesh } from './ecology-model';
import { ECO_SPECS } from '../../src/jungle/ecology';
import { ACCENT_FORMS } from '../../src/jungle/accents';
import { REPOSE_CLIPS } from './repose';

await mkdir('artifacts',{recursive:true});
// Show every registered resting heading plus lowering/shift phases at useful size.
for(const kind of ['deer','zebra','jaguar','blackBear'] as const){
 const overlays:sharp.OverlayOptions[]=[],scale=kind==='deer'?21:kind==='jaguar'?25:ECO_SPECS[kind].cameraScale;
 const camera={width:112,height:112,anchor:[56,87] as [number,number],scale};
 const mesh=(clip:keyof typeof REPOSE_CLIPS,p:number)=>kind==='deer'?deerMesh(clip,p):kind==='jaguar'?wildlifeMesh(kind,clip,p):ecologyMesh(kind,clip,p);
 for(let d=0;d<8;d++)for(const [row,clip] of ['lieDown','lying','shift'].entries()){
  const image=bakeMesh(mesh(clip as keyof typeof REPOSE_CLIPS,row===0?d/7:.3),row===0?Math.PI/4:d/8*Math.PI*2,camera);
  overlays.push({input:Buffer.from(image.data),raw:{width:112,height:112,channels:4},left:d*112,top:row*112});
 }
 await sharp({create:{width:896,height:336,channels:4,background:'#dce6ce'}}).composite(overlays).png().toBuffer().then(b=>sharp(b).resize(1792,672,{kernel:'nearest'}).png().toFile(`artifacts/${kind}-repose.png`));
}
const atlas=JSON.parse(await readFile('public/assets/jungle.json','utf8')),overlays:sharp.OverlayOptions[]=[];
for(const [i,name] of ACCENT_FORMS.entries()){
 const f=atlas.sprites[`accent-${name}`].frames[0];
 const input=await sharp('public/assets/jungle.png').extract({left:f.x,top:f.y,width:f.width,height:f.height}).png().toBuffer();
 overlays.push({input,left:i%4*80+Math.floor((80-f.width)/2),top:Math.floor(i/4)*80+75-f.height});
}
await sharp({create:{width:320,height:320,channels:4,background:'#33472f'}}).composite(overlays).png().toBuffer().then(b=>sharp(b).resize(960,960,{kernel:'nearest'}).png().toFile('artifacts/accent-variety.png'));
console.log('Resting poses and botanical variety → artifacts/');
