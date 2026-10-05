import { BEAR_MOTION } from '../src/jungle/bear-motion';
import sharp from 'sharp';
import { mkdir,readFile,writeFile } from 'node:fs/promises';
import { InfiniteWorld } from '../src/jungle/infinite';
import { cameraBounds,composeInfinite } from '../src/jungle/infinite-scene';
import { MemoryRenderer } from '../src/iso/render';
import { ECO_SPECS,ecoClips } from '../src/jungle/ecology';
import { ecologyMesh } from './art/ecology-model';
import { bakeMesh } from '../src/iso/bake/rasterize';
await mkdir('artifacts',{recursive:true});
const atlas=JSON.parse(await readFile('public/assets/jungle.json','utf8')),raw=await sharp('public/assets/jungle.png').ensureAlpha().raw().toBuffer({resolveWithObject:true});
const renderer=new MemoryRenderer({width:raw.info.width,height:raw.info.height,data:raw.data});
for(const kind of ['tiger','hippo','bison','blackBear'] as const){
 const forms=kind==='bison'||kind==='hippo'?2:1;
 const spec=ECO_SPECS[kind],clips=Object.entries(ecoClips(kind)),panels:sharp.OverlayOptions[]=[];
 const camera={width:112,height:112,anchor:[56,87] as [number,number],scale:kind==='blackBear'?BEAR_MOTION.bakeScale:spec.cameraScale};
 for(let form=0;form<forms;form++)for(const [row,[clip]] of clips.entries())for(let d=0;d<spec.directions;d++){
  const p=bakeMesh(ecologyMesh(kind,clip,.25,form),d/spec.directions*Math.PI*2,camera);
  panels.push({input:Buffer.from(p.data),raw:{width:112,height:112,channels:4},left:d*112,top:(row+form*clips.length)*112});
 }
 await sharp({create:{width:112*spec.directions,height:112*clips.length*forms,channels:4,background:'#dce6ce'}}).composite(panels).png().toFile(`artifacts/${kind}-directions.png`);
 const w=new InfiniteWorld(2718),p=w.wildlifeLandmark(kind),view={width:1200,height:850,pixelRatio:1,zoom:1.4,grid:false,cameraX:p.x,cameraY:p.y};w.ensure(cameraBounds(view));
 for(let i=0;i<180;i++)w.update(1/60);
 renderer.render(composeInfinite(w,atlas,view,.5));
 await sharp(renderer.pixels.data,{raw:{width:view.width,height:view.height,channels:4}}).png().toFile(`artifacts/wildlife-${kind}.png`);
 await writeFile(`artifacts/wildlife-${kind}.json`,JSON.stringify({view,animals:w.agents.filter(a=>a.kind===kind).map(a=>({id:a.id,x:a.x,y:a.y}))},null,2));
 console.log(kind,p);
}
