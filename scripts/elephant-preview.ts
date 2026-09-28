import sharp from 'sharp';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {ElephantAgent,DeerAgent,PlantAgent} from '../src/jungle/agents';
import {InfiniteWorld} from '../src/jungle/infinite';
import {cameraBounds,composeInfinite} from '../src/jungle/infinite-scene';
import {MemoryRenderer} from '../src/iso/render';
import {drinkingSpot} from '../src/jungle/water-sites';
import type {AgentEnvironment} from '../src/agents';
await mkdir('artifacts',{recursive:true});
const atlas=JSON.parse(await readFile('public/assets/jungle.json','utf8'));
const raw=await sharp('public/assets/jungle.png').ensureAlpha().raw().toBuffer({resolveWithObject:true});
const renderer=new MemoryRenderer({width:raw.info.width,height:raw.info.height,data:raw.data});
const world=new InfiniteWorld(),location=world.wildlifeLandmark('elephant');
const view={width:620,height:480,pixelRatio:1,zoom:3,grid:false,cameraX:location.x,cameraY:location.y};world.ensure(cameraBounds(view));
const env:AgentEnvironment={time:0,nearby:()=>[],canMove:(x,y)=>world.canMove(x,y),sample:(x,y)=>({water:(world.tileAt(x,y)?.materialAt(x,y)??0)>=4,elevation:world.heightAt(x,y),moisture:.6,light:.8,wind:1})};
const a=world.agents.find(a=>a instanceof ElephantAgent) as ElephantAgent;
a.size=1;
const stand=(x:number,y:number)=>[[0,0],[.23,0],[-.23,0],[0,.23],[0,-.23]].every(([dx,dy])=>world.canMove(x+dx!,y+dy!));
const spot=drinkingSpot(a,1,env,stand,()=>true);if(!spot)throw new Error('No drinking spot for preview');
a.x=spot.x;a.y=spot.y;a.heading=spot.heading;a.waterKnown=true;a.waterX=spot.waterX;a.waterY=spot.waterY;
const neighbor=new DeerAgent('preview-deer',a.x,a.y,3);
const dry=Array.from({length:16},(_,i)=>{const t=i*Math.PI/8;return{x:a.x+Math.cos(t)*.9,y:a.y+Math.sin(t)*.9};}).find(p=>stand(p.x,p.y));
if(!dry)throw new Error('No neighboring dry spot');neighbor.x=dry.x;neighbor.y=dry.y;neighbor.state='look';neighbor.heading=spot.heading;neighbor.previous=neighbor.sample();
// A deliberately cleared review fixture makes the trunk/nozzle visible.
world.agents=world.agents.filter(x=>x.speed===undefined&&!(x instanceof PlantAgent));world.agents.push(a,neighbor);
view.cameraX=a.x-.15;view.cameraY=a.y-.15;
const panels:sharp.OverlayOptions[]=[];
for(let i=0;i<6;i++){
 a.state=i<3?'drink':'spray';a.gait=[.08,.32,.70,.34,.58,.80][i]!;a.loaded=true;
 a.heading=i<3?spot.heading:Math.atan2(neighbor.y-a.y,neighbor.x-a.x);a.sprayX=neighbor.x;a.sprayY=neighbor.y;a.previous=a.sample();
 const frame=composeInfinite(world,atlas,view,1);renderer.render(frame);
 const pixels=Buffer.from(renderer.pixels.data);panels.push({input:pixels,raw:{width:view.width,height:view.height,channels:4},left:i%3*view.width,top:Math.floor(i/3)*view.height});
 if(i===1||i===4){const name=i===1?'drink':'spray';await sharp(pixels,{raw:{width:view.width,height:view.height,channels:4}}).png().toFile(`artifacts/elephant-${name}.png`);await writeFile(`artifacts/elephant-${name}.json`,JSON.stringify({view,elephant:a.sample(),frame},null,2));}
}
await sharp({create:{width:view.width*3,height:view.height*2,channels:4,background:'#526e3d'}}).composite(panels).png().toFile('artifacts/elephant-water-sequence.png');
console.log('Staged drinking/spraying fixture → artifacts/elephant-water-sequence.png');
