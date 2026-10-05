import sharp from 'sharp';
import { readFile } from 'node:fs/promises';
import { ECO_SPECS,type EcoKind } from '../src/jungle/ecology';
import { BEAR_COATS } from '../src/jungle/bear-motion';
import { ANIMAL_FORMS,animalForms,animalPrefix } from '../src/jungle/animal-appearance';
import { MemoryRenderer,spriteRegion,type DrawCommand } from '../src/iso/render';
import type { AtlasManifest } from '../src/jungle/scene';
/** Every form reconstructed from delivered pieces; labels make missing variants obvious. */
const atlas:AtlasManifest=JSON.parse(await readFile('public/assets/jungle.json','utf8'));
const raw=await sharp('public/assets/jungle.png').ensureAlpha().raw().toBuffer({resolveWithObject:true});
const renderer=new MemoryRenderer({width:raw.info.width,height:raw.info.height,data:raw.data});
const kinds=[...Object.keys(ANIMAL_FORMS),'koi','duck','pelican'];
for(let page=0;page<4;page++){
 const group=kinds.slice(page*8,page*8+8),panels:sharp.OverlayOptions[]=[];
 for(const [row,kind] of group.entries()){
  const pond=['koi','duck','pelican'].includes(kind);
  for(const form of pond?[0,1,2]:animalForms(kind)){
   const prefix=pond?`zen-${animalPrefix(kind,form)}`:animalPrefix(kind,form),action=kind==='deer'?'look':kind==='whale'?'travel':pond?'swim':'rest';
   const direction=Math.round((ECO_SPECS[kind as EcoKind]?.directions??(pond?8:16))*5/16);
   let name=`${prefix}-${action}-${direction}`;
   if(!atlas.animalClips?.[name]&&!atlas.zenParts?.[name]&&!atlas.sprites[name])name=`${prefix}-${kind==='pelican'?'rest':'travel'}-${direction}`;
   const parts=atlas.animalClips?.[name]?.parts??atlas.zenParts?.[name]??[name];
   if(!atlas.sprites[parts[0]!])throw new Error(`Missing ${name}`);
   let left=0,right=0,top=0,bottom=0;
   for(const part of parts){const s=atlas.sprites[part]!;left=Math.min(left,-s.anchor[0]);right=Math.max(right,s.width-s.anchor[0]);top=Math.min(top,-s.anchor[1]);bottom=Math.max(bottom,s.height-s.anchor[1]);}
   const scale=Math.min(4,190/(right-left),125/(bottom-top));
   const commands:DrawCommand[]=parts.map((part,i)=>{const s=atlas.sprites[part]!;return{id:String(i),layer:1,depth:0,x:110-(left+right)/2*scale-s.anchor[0]*scale,y:135-bottom*scale-s.anchor[1]*scale,width:s.width*scale,height:s.height*scale,region:spriteRegion(s,0),color:[...(kind==='blackBear'?BEAR_COATS[form]!:[255,255,255] as const),255]};});
   renderer.render({width:220,height:165,clear:[220,230,206,255],commands});
   panels.push({input:Buffer.from(renderer.pixels.data),raw:{width:220,height:165,channels:4},left:form*220,top:row*165});
   panels.push({input:Buffer.from(`<svg width="220" height="25"><text x="8" y="19" font-size="15" font-family="sans-serif">${kind} · form ${form+1}</text></svg>`),left:form*220,top:row*165+140});
  }
 }
 await sharp({create:{width:660,height:group.length*165,channels:4,background:'#dce6ce'}}).composite(panels).png().toFile(`artifacts/animal-variety-${page+1}.png`);
}
console.log('31 species in four packed-atlas variety sheets');
