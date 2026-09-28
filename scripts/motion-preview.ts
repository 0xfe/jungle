import sharp from 'sharp';
import {readFile,writeFile} from 'node:fs/promises';
import {InfiniteWorld} from '../src/jungle/infinite';
import {MonkeyAgent,PlantAgent} from '../src/jungle/agents';
import {composeInfinite,cameraBounds} from '../src/jungle/infinite-scene';
import {MemoryRenderer} from '../src/iso/render';
import type {AgentEnvironment} from '../src/agents';
const atlas=JSON.parse(await readFile('public/assets/jungle.json','utf8'));
const raw=await sharp('public/assets/jungle.png').ensureAlpha().raw().toBuffer({resolveWithObject:true});
const renderer=new MemoryRenderer({width:raw.info.width,height:raw.info.height,data:raw.data});
const world=new InfiniteWorld(),p=world.wildlifeLandmark('monkey');
const view={width:600,height:500,pixelRatio:1,zoom:3,grid:false,cameraX:p.x,cameraY:p.y};world.ensure(cameraBounds(view));
const a=world.agents.find(a=>a instanceof MonkeyAgent) as MonkeyAgent;
const trees=world.agents.filter((a):a is PlantAgent=>a instanceof PlantAgent&&a.kind==='tree');
const tree=trees.filter(t=>t.x>a.territory[0]+.4&&t.x<a.territory[2]-.5&&t.y>a.territory[1]+.4&&t.y<a.territory[3]-.4).sort((x,y)=>Math.hypot(x.x-a.x,x.y-a.y)-Math.hypot(y.x-a.x,y.y-a.y))[0]!;
a.x=tree.x+.17;a.y=tree.y;a.altitude=Math.max(12,tree.scale*60-a.gripHeight-24*a.size);a.cooldown=0;
const env:AgentEnvironment={time:0,canMove:(x,y)=>world.canMove(x,y),nearby:()=>[],sample:(x,y)=>({moisture:.7,water:false,wind:1,light:1,elevation:world.heightAt(x,y)}),perches:()=>[{x:a.x,y:a.y,height:tree.scale*60}]};
if(!a.trySwing(env))throw new Error('Preview needs a supported swing');a.previous=a.sample();
view.cameraX=a.x-.6;view.cameraY=a.y-.6;
const panels:sharp.OverlayOptions[]=[];
for(let i=0;i<6;i++){
 const frame=composeInfinite(world,atlas,view,1);renderer.render(frame);
 panels.push({input:Buffer.from(renderer.pixels.data),raw:{width:600,height:500,channels:4},left:i%3*600,top:Math.floor(i/3)*500});
 if(i===1){await sharp(renderer.pixels.data,{raw:{width:600,height:500,channels:4}}).png().toFile('artifacts/monkey-supported-swing.png');await writeFile('artifacts/monkey-supported-swing.json',JSON.stringify({view,monkey:a.sample(),frame},null,2));}
 for(let step=0;step<Math.round(a.routeDuration*60/6);step++)world.update(1/60);
}
await sharp({create:{width:1800,height:1000,channels:4,background:'#536b40'}}).composite(panels).png().toFile('artifacts/monkey-swing-sequence.png');
console.log('Supported swing fixture → artifacts/monkey-supported-swing.png and monkey-swing-sequence.png');
