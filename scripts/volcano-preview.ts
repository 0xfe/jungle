import sharp from 'sharp';
import { readFile, mkdir } from 'node:fs/promises';
import { InfiniteWorld } from '../src/jungle/infinite';
import { volcanoesIn, lavaPoint } from '../src/jungle/volcanoes';
import { composeInfinite, cameraBounds } from '../src/jungle/infinite-scene';
import { VolcanicWildlifeAgent } from '../src/jungle/agents';
import { MemoryRenderer } from '../src/iso/render';
import type { AtlasManifest } from '../src/jungle/scene';

/** Real seeded sites show footprint, rooted mouths, lava and wildlife in the production composer. */
const atlas:AtlasManifest=JSON.parse(await readFile('public/assets/jungle.json','utf8'));
const raw=await sharp('public/assets/jungle.png').ensureAlpha().raw().toBuffer({resolveWithObject:true});
const renderer=new MemoryRenderer({width:raw.info.width,height:raw.info.height,data:raw.data});
await mkdir('artifacts',{recursive:true});
const sites=volcanoesIn({minX:-900,minY:-900,maxX:900,maxY:900},2718);
for(let form=0;form<4;form++){
  const v=sites.find(v=>v.form===form);if(!v)throw new Error(`Missing volcano preview form ${form}`);
  const world=new InfiniteWorld(2718),view={width:1200,height:850,pixelRatio:1,zoom:1,grid:false,cameraX:v.x,cameraY:v.y-.75};
  world.ensure(cameraBounds(view));world.time=world.previousTime=120-v.phase;
  for(const variant of ['landscape','burn'] as const){
    if(variant==='burn'){
      const a=(world.agents.find(a=>a instanceof VolcanicWildlifeAgent&&a.animal.kind==='deer')??world.agents.find(a=>a instanceof VolcanicWildlifeAgent)) as VolcanicWildlifeAgent|undefined;
      if(a){const p=lavaPoint(v,.7,world.time);a.animal.x=p.x;a.animal.y=p.y;a.animal.previous=a.animal.sample();a.phase='burn';a.elapsed=a.previousElapsed=2.5;a.ashX=p.x+.6;a.ashY=p.y+.4;a.ashRemaining=30;}
    }
    const frame=composeInfinite(world,atlas,view);renderer.render(frame);
    await sharp(renderer.pixels.data,{raw:{width:view.width,height:view.height,channels:4}}).png().toFile(`artifacts/volcano-${form}-${variant}.png`);
  }
}
console.log('Four volcano forms, active lava and cartoon burn fixtures → artifacts/volcano-*.png');
