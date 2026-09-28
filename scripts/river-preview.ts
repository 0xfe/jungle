import sharp from 'sharp';
import { readFile, writeFile } from 'node:fs/promises';
import { InfiniteWorld } from '../src/jungle/infinite';
import { cameraBounds, composeInfinite } from '../src/jungle/infinite-scene';
import { MemoryRenderer } from '../src/iso/render';
import type { AtlasManifest } from '../src/jungle/scene';
const atlas:AtlasManifest=JSON.parse(await readFile('public/assets/jungle.json','utf8'));
const pixels=await sharp('public/assets/jungle.png').raw().ensureAlpha().toBuffer({resolveWithObject:true});
const renderer=new MemoryRenderer({width:pixels.info.width,height:pixels.info.height,data:pixels.data});
const world=new InfiniteWorld(2718),p=world.riverLandmark();
const view={width:1100,height:750,pixelRatio:1,zoom:1.25,grid:false,cameraX:p.x,cameraY:p.y};
world.ensure(cameraBounds(view));
for(let shot=0;shot<2;shot++){
  const frame=composeInfinite(world,atlas,view,1);renderer.render(frame);
  await sharp(renderer.pixels.data,{raw:{width:view.width,height:view.height,channels:4}}).png().toFile(`artifacts/river-${shot}.png`);
  await writeFile(`artifacts/river-${shot}.json`,JSON.stringify({view,time:world.time,paths:world.rivers,frame},null,2));
  for(let i=0;i<180;i++)world.update(1/60);
}
console.log('Connected stream and downstream drift → artifacts/river-{0,1}.png');
