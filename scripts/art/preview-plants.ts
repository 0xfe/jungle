import sharp from 'sharp';
import {readFile,mkdir} from 'node:fs/promises';
import {TREE_FORMS,PLANT_FORMS} from '../../src/jungle/botany';
import type {AtlasManifest} from '../../src/jungle/scene';
const atlas:AtlasManifest=JSON.parse(await readFile('public/assets/jungle.json','utf8'));
const overlays:sharp.OverlayOptions[]=[];
for(const [kind,counts,rowOffset] of [['tree',TREE_FORMS,0],['plant',PLANT_FORMS,4]] as const)
 for(let species=0;species<4;species++)for(let form=0;form<counts[species]!;form++){
  const name=`${kind}-${species}${form?`-form-${form}`:''}`,s=atlas.sprites[name]!,r=s.frames[0]!;
  const input=await sharp('public/assets/jungle.png').extract({left:r.x,top:r.y,width:r.width,height:r.height}).resize(Math.round(s.width),Math.round(s.height),{kernel:'nearest'}).png().toBuffer();
  overlays.push({input,left:form*140+Math.round(70-s.anchor[0]),top:(species+rowOffset)*130+Math.round(119-s.anchor[1])});
 }
await mkdir('artifacts',{recursive:true});
await sharp({create:{width:980,height:1040,channels:4,background:'#bcc6a4'}}).composite(overlays).png().toFile('artifacts/plant-forms.png');
console.log('Registered botanical contact sheet → artifacts/plant-forms.png');
