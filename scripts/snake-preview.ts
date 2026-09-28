import sharp from 'sharp';
import { mkdir,readFile,writeFile } from 'node:fs/promises';
import { BoaAgent,SmallSnakeAgent,createPlant } from '../src/jungle/agents';
import { InfiniteWorld } from '../src/jungle/infinite';
import { composeInfinite,cameraBounds } from '../src/jungle/infinite-scene';
import { SNAKE_MODEL_TO_TILE,SNAKE_SUPPORT_OFFSET } from '../src/jungle/snake-pose';
import { MemoryRenderer } from '../src/iso/render';
import type { AtlasManifest } from '../src/jungle/scene';

// A staged, unobstructed fixture for inspecting trunk occlusion and individual body sizes.
const atlas:AtlasManifest=JSON.parse(await readFile('public/assets/jungle.json','utf8'));
const raw=await sharp('public/assets/jungle.png').ensureAlpha().raw().toBuffer({resolveWithObject:true});
const renderer=new MemoryRenderer({width:raw.info.width,height:raw.info.height,data:raw.data});
const world=new InfiniteWorld(2718,'rainforest',undefined,{water:0,plants:0,animals:0});
const view={width:380,height:320,pixelRatio:1,zoom:2.5,grid:false,cameraX:1,cameraY:1};
world.ensure(cameraBounds(view));
const tree=createPlant(2,'support',1,1,0,.95),boa=new BoaAgent('boa',1,1,7);
boa.size=1;boa.hasSupport=true;boa.supportX=1;boa.supportY=1;boa.supportHeading=Math.PI/4;boa.heading=Math.PI/4;
boa.x=1+Math.cos(boa.heading)*SNAKE_MODEL_TO_TILE*SNAKE_SUPPORT_OFFSET;boa.y=1+Math.sin(boa.heading)*SNAKE_MODEL_TO_TILE*SNAKE_SUPPORT_OFFSET;
const small=Array.from({length:3},(_,i)=>new SmallSnakeAgent(`small-${i}`,1.6+i*.18,1.1,50+i));
world.agents=[tree,boa,...small];world.groundCover=[];
const panels:sharp.OverlayOptions[]=[];
await mkdir('artifacts',{recursive:true});
for(let i=0;i<5;i++){
  boa.state=i===4?'coil':'wrap';boa.gait=i/4;Object.assign(boa.previous,boa.sample());
  const frame=composeInfinite(world,atlas,view);renderer.render(frame);
  const pixels=Buffer.from(renderer.pixels.data);panels.push({input:pixels,raw:{width:view.width,height:view.height,channels:4},left:i*view.width,top:0});
  if(i===4){
    await sharp(pixels,{raw:{width:view.width,height:view.height,channels:4}}).png().toFile('artifacts/boa-tree-coil.png');
    await writeFile('artifacts/boa-tree-coil.json',JSON.stringify(frame,null,2));
  }
}
await sharp({create:{width:view.width*5,height:view.height,channels:4,background:'#638440'}}).composite(panels).png().toFile('artifacts/snake-wrap-sequence.png');
console.log('Staged snake/tree registration sequence → artifacts/snake-wrap-sequence.png');
