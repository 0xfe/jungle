import sharp from 'sharp';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { InfiniteWorld } from '../src/jungle/infinite';
import { SPACE_CLASSES, type SpaceEnvironment } from '../src/jungle/agents/spacecraft';
import { SPACE_KINDS } from '../src/jungle/ecology';
import { composeInfinite } from '../src/jungle/infinite-scene';
import { MemoryRenderer } from '../src/iso/render';

await mkdir('artifacts',{recursive:true});
const atlas=JSON.parse(await readFile('public/assets/jungle.json','utf8'));
const raw=await sharp('public/assets/jungle.png').ensureAlpha().raw().toBuffer({resolveWithObject:true});
const renderer=new MemoryRenderer({width:raw.info.width,height:raw.info.height,data:raw.data});
const panels:sharp.OverlayOptions[]=[],records=[];
const stages=['approach','unload','explore','board','depart'];
const width=400,height=340;
for(const [row,kind] of SPACE_KINDS.entries()){
  const world=new InfiniteWorld(2718,'rainforest',undefined,{plants:0,water:0,animals:0,hills:0});
  world.ensure({minX:-4,minY:-4,maxX:8,maxY:8});
  const ship=new SPACE_CLASSES[kind](`preview-${kind}`,2,2,31+row);ship.timer=0;world.agents.push(ship);
  const env:SpaceEnvironment={time:0,sample:()=>({water:false,elevation:0,light:1,wind:1,moisture:.5}),canMove:()=>true,canLand:()=>true,nearby:()=>[]};
  let column=0;
  for(let tick=0;tick<60*100&&column<stages.length;tick++){
    ship.update(1/60,env);world.previousTime=world.time;world.time+=1/60;
    if(ship.state!==stages[column]||ship.elapsed<(column===0?4.8:column===1?4:column===2?6:column===3?1:.8))continue;
    const ground=world.heightAt(ship.x,ship.y)/96;
    const view={width,height,pixelRatio:1,zoom:1.7,grid:false,
      cameraX:ship.x+Math.cos(ship.heading)*.35-ground,cameraY:ship.y+Math.sin(ship.heading)*.35-ground};
    const frame=composeInfinite(world,atlas,view,.5);renderer.render(frame);
    const pixels=Buffer.from(renderer.pixels.data);
    panels.push({input:pixels,raw:{width,height,channels:4},left:column*width,top:row*height});
    if(column===2)await sharp(pixels,{raw:{width,height,channels:4}}).png().toFile(`artifacts/spacecraft-${kind}.png`);
    records.push({kind,state:ship.state,elapsed:ship.elapsed,crew:ship.crew.map(a=>({id:a.id,state:a.state,...a.sample()}))});column++;
  }
  if(column!==stages.length)throw new Error(`Incomplete spacecraft preview: ${kind}`);
}
await sharp({create:{width:width*stages.length,height:height*3,channels:4,background:'#314a39'}}).composite(panels).png().toFile('artifacts/spacecraft-sequence.png');
await writeFile('artifacts/spacecraft-sequence.json',JSON.stringify({stages,rows:SPACE_KINDS,records},null,2)+'\n');
// Every heading, as actually packed. The row pair shows an open ship and its scanner pose.
const contacts:sharp.OverlayOptions[]=[];
const contactRenderer=new MemoryRenderer({width:raw.info.width,height:raw.info.height,data:raw.data});
for(const [row,kind] of SPACE_KINDS.entries())for(let d=0;d<8;d++)for(const alien of [false,true]){
  const names=alien?[`alien-${['sprout','ember','reed'][row]}-inspect-${d}`]:[`ship-${kind}-${d}`,`ship-${kind}-hatch-${d}`];
  const factor=alien?3.1:1.4;
  const commands=names.map((name,i)=>{const s=atlas.sprites[name];return{id:String(i),x:75-s.anchor[0]*factor,y:90-s.anchor[1]*factor,
    width:s.width*factor,height:s.height*factor,region:s.frames[alien?1:0],color:[255,255,255,255] as [number,number,number,number],layer:2,depth:0};});
  contactRenderer.render({width:150,height:110,clear:[53,72,62,255],commands});
  contacts.push({input:Buffer.from(contactRenderer.pixels.data),raw:{width:150,height:110,channels:4},left:d*150,top:row*220+(alien?110:0)});
}
await sharp({create:{width:1200,height:660,channels:4,background:'#35483e'}}).composite(contacts).png().toFile('artifacts/spacecraft-directions.png');
console.log('Spacecraft/crew contact sheets and five-stage sequences → artifacts/spacecraft-*.png');
