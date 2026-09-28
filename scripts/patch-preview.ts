import sharp from 'sharp';
import {readFile,writeFile} from 'node:fs/promises';
import {MemoryRenderer,sortCommands,type DrawCommand} from '../src/iso/render';
import type {AtlasManifest} from '../src/jungle/scene';
import {PATCH_KINDS,patchRoots,isGrove} from '../src/jungle/patches';
import {CONFIG} from '../src/config';
import {project} from '../src/iso/math';
import {TILE} from '../src/jungle/world';
import {InfiniteWorld} from '../src/jungle/infinite';
import {cameraBounds,composeInfinite} from '../src/jungle/infinite-scene';
const atlas:AtlasManifest=JSON.parse(await readFile('public/assets/jungle.json','utf8'));
const pixels=await sharp('public/assets/jungle.png').ensureAlpha().raw().toBuffer({resolveWithObject:true});
const renderer=new MemoryRenderer({width:pixels.info.width,height:pixels.info.height,data:pixels.data});
{
 const commands:DrawCommand[]=[];
 for(const [row,style] of PATCH_KINDS.entries())for(let variant=0;variant<4;variant++){
  const ax=200+variant*390,ay=260+row*285;
  for(let part=0;part<(isGrove(style)?4:1);part++)for(const mask of ['base','leaves']){
   const s=atlas.sprites[`patch-${style}-${variant}-${part}-${mask}`];if(!s)continue;
   const tint=CONFIG.world.patches.foliage[variant%3]!;
   commands.push({id:`${style}:${variant}:${part}:${mask}`,x:ax-s.anchor[0],y:ay-s.anchor[1],width:s.width,height:s.height,region:s.frames[0],color:mask==='leaves'?[...tint,255]:[255,255,255,255],layer:1,depth:part});
  }
  if(isGrove(style))for(const [i,root] of patchRoots(variant).entries()){
   const p=project(root,TILE);commands.push({id:`root${variant}:${i}`,x:ax+p.x-2,y:ay+p.y-2,width:4,height:4,color:[255,80,70,255],layer:2,depth:0});
  }
 }
 renderer.render({width:1560,height:2640,clear:[87,117,64,255],commands:sortCommands(commands)});
 await sharp(renderer.pixels.data,{raw:{width:1560,height:2640,channels:4}}).png().toFile('artifacts/landscape-patches-neutral.png');
}
for(const [name,offset] of [['opening',0],['mature',38]] as const){
 const world=new InfiniteWorld(),view={width:1200,height:800,pixelRatio:1,zoom:1,grid:false,cameraX:world.origin.x+offset,cameraY:world.origin.y};
 world.ensure(cameraBounds(view));renderer.render(composeInfinite(world,atlas,view));
 await sharp(renderer.pixels.data,{raw:{width:1200,height:800,channels:4}}).png().toFile(`artifacts/patch-${name}.png`);
 await writeFile(`artifacts/patch-${name}.json`,JSON.stringify({view,stats:world.stats},null,2));
 if(name==='mature'){
  for(let i=0;i<60;i++)world.update(1/60);
  renderer.render(composeInfinite(world,atlas,view,.5));
  await sharp(renderer.pixels.data,{raw:{width:1200,height:800,channels:4}}).png().toFile('artifacts/patch-mature-wind.png');
 }
}
console.log('Landscape group contact sheets, roots and opening/mature scenes → artifacts/');

// Reproducible stops along a long diagonal journey demonstrate recurring regions.
for(const [name,x,y] of [['flowers',64,-64],['fruit',112,-112],['open',144,-144],['wet',80,-80]] as const){
 const world=new InfiniteWorld(),view={width:1200,height:800,pixelRatio:1,zoom:1,grid:false,cameraX:x,cameraY:y};
 world.ensure(cameraBounds(view));renderer.render(composeInfinite(world,atlas,view));
 await sharp(renderer.pixels.data,{raw:{width:1200,height:800,channels:4}}).png().toFile(`artifacts/region-${name}.png`);
 await writeFile(`artifacts/region-${name}.json`,JSON.stringify({view,stats:world.stats},null,2));
}
