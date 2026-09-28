import test from 'node:test';
import assert from 'node:assert/strict';
import {AgentSystem,type AgentEnvironment} from '../src/agents';
import {ECO_CLASSES,EcologicalAgent,MonkeyAgent,FishAgent,WhaleAgent,CrabAgent,PlantAgent,LandscapePatchAgent,jungleAgents} from '../src/jungle/agents';
import {ECO_KINDS,ECO_SPECS,ecoClips,habitatAllows} from '../src/jungle/ecology';
import {InfiniteWorld} from '../src/jungle/infinite';
import {terrainEnvironment} from '../src/jungle/terrain';
import {groveAt} from '../src/jungle/groves';
import {ecologyMesh} from '../scripts/art/ecology-model';
import {bakeMesh} from '../src/iso/bake/rasterize';
const land:AgentEnvironment={time:0,canMove:()=>true,nearby:()=>[],sample:()=>({moisture:.5,light:.8,wind:1,elevation:0,water:false,depth:0,beach:true}),perches:()=>[{x:0,y:0,height:55},{x:.8,y:.2,height:60},{x:1.1,y:1,height:58}]};
const sea:AgentEnvironment={...land,sample:()=>({...land.sample(0,0),water:true,depth:1,beach:false})};

test('all active ecological species retain complete exact binary continuation',()=>{
 for(const kind of ECO_KINDS){const C=ECO_CLASSES[kind],a=new C(kind,0,0,18),s=new AgentSystem(),e=ECO_SPECS[kind].mode==='water'?sea:land;
  a.timer=0;a.groupId='family';a.leaderId=a.id;a.altitude=kind==='monkey'?55:0;
  for(let i=0;i<500;i++)s.step([a],1/60,e);
  const b=jungleAgents.decode(jungleAgents.encode([a]))[0]!;assert.ok(b instanceof C);
  for(let i=0;i<1200;i++){s.step([a],1/60,e);s.step([b],1/60,e);}
  assert.deepEqual(jungleAgents.encode([a]),jungleAgents.encode([b]),kind);
 }
});

test('monkeys make short supported swings, return to their tree and reject unsupported swings',()=>{
 const a=new MonkeyAgent('m',0,0,7);a.altitude=25;assert.ok(a.trySwing(land));
 let excursion=0;const length=24*a.size;
 for(let i=0;i<360&&a.state==='swing';i++){
  a.update(1/60,land);const dx=a.x-a.routeX,dy=a.y-a.routeY;excursion=Math.max(excursion,Math.hypot(dx,dy));
  const horizontal=(dx-dy)*96,vertical=(dx+dy)*48-(a.altitude-a.routeHeight)+length;
  assert.ok(Math.abs(Math.hypot(horizontal,vertical)-length)<1e-8);
 }
 assert.ok(excursion>.05&&excursion<=.2);assert.equal(a.state,'rest');assert.equal(a.x,0);assert.equal(a.y,0);assert.equal(a.altitude,25);
 assert.ok(a.timer>=25);assert.ok(a.cooldown>50);
 const isolated=new MonkeyAgent('alone',0,0,2);isolated.altitude=25;
 assert.equal(isolated.trySwing({...land,perches:()=>[]}),false);
 isolated.altitude=0;assert.equal(isolated.trySwing(land),false);
});

test('fish schools swim together and never cross a dry shoreline',()=>{
 const env={...sea,sample:(x:number,y:number)=>({...sea.sample(x,y),water:x<2,depth:x<2?1:0})};
 const school=Array.from({length:8},(_,i)=>{const a=new FishAgent(`f${i}`,-.4+i*.08,.1*(i%2),30+i);a.groupId='school';a.leaderId='f0';a.heading=0;a.timer=0;return a;});
 const sys=new AgentSystem();let moving=0;
 for(let t=0;t<2400;t++){sys.step(school,1/60,env);for(const a of school){assert.ok(a.x<2);if(a.speed>.1)moving++;}}
 const leader=school[0]!;assert.ok(moving>1000);assert.ok(school.slice(1).every(a=>Math.hypot(a.x-leader.x,a.y-leader.y)<2));
});

test('whales spend most of a breathing cycle submerged and surface briefly before diving',()=>{
 const a=new WhaleAgent('w',0,0,8);a.timer=0;a.altitude=-12;let visible=0,hidden=0,peak=-12;
 for(let i=0;i<Math.ceil(a.cycleSeconds*60);i++){a.update(1/60,sea);peak=Math.max(peak,a.altitude);if(a.altitude>-4)visible++;if(a.altitude<-10)hidden++;assert.ok(sea.sample(a.x,a.y).water);}
 assert.ok(peak>-.2);assert.ok(hidden>visible*5);assert.ok(visible>100&&visible<500);assert.equal(habitatAllows('whale',{...sea.sample(0,0),depth:.25}),false);
});

test('shore crabs stay on beach habitat rather than entering open water or inland forest',()=>{
 const env={...land,sample:(x:number,y:number)=>({...land.sample(x,y),beach:Math.abs(y)<.6,water:y<-.6})};
 const a=new CrabAgent('c',0,0,81);a.timer=0;
 for(let i=0;i<1800;i++){a.update(1/60,env);assert.ok(Math.abs(a.y)<.6);}
 assert.ok(Math.hypot(a.x,a.y)>.1);
});

test('ecology generation visits all species and habitat landmarks do not inflate world counters',()=>{
 const w=new InfiniteWorld(2718);const seen=new Set<string>();
 for(const kind of ECO_KINDS){const generated=w.generated,explored=w.explored.estimate;const point=w.wildlifeLandmark(kind);
  assert.equal(w.generated,generated);assert.equal(w.explored.estimate,explored);
  w.ensure({minX:point.x-3,minY:point.y-3,maxX:point.x+3,maxY:point.y+3});
  assert.ok(w.agents.some(a=>a.kind===kind),`landmark missing ${kind}`);
  for(const a of w.agents)if(a instanceof EcologicalAgent){seen.add(a.kind);assert.ok(habitatAllows(a.kind,terrainEnvironment(a.x,a.y,w.seed)),`${a.kind} initial habitat`);}
 }
 assert.equal(seen.size,ECO_KINDS.length);
});

test('tree stands are mostly upright, locally consistent and have small porous root beds',()=>{
 let upright=0,same=0,total=0;
 for(let y=-30;y<30;y++)for(let x=-30;x<30;x++){const a=groveAt(x,y,2718),b=groveAt(x+.3,y+.3,2718);upright+=Number(a.morphology!==2);same+=Number(a.species===b.species);total++;}
 assert.ok(upright/total>.85);assert.ok(same/total>.85);
 const w=new InfiniteWorld();w.ensure({minX:-8,minY:-8,maxX:8,maxY:8});const trees=w.agents.reduce((n,a)=>n+(a instanceof LandscapePatchAgent?a.supports.length:0),0);
 assert.ok(w.groundCover.length>0&&w.groundCover.length<trees);assert.ok(w.groundCover.every(c=>c.radius<.25&&c.opacity<.4));
});

test('new articulated models have transparent margins in every heading and action',()=>{
 for(const kind of ECO_KINDS){const spec=ECO_SPECS[kind],camera={width:112,height:112,anchor:[56,87] as [number,number],scale:spec.cameraScale};
  for(const clip of Object.keys(ecoClips(kind)))for(let d=0;d<spec.directions;d++)for(const p of [0,.25,.5,.75]){
   const image=bakeMesh(ecologyMesh(kind,clip,p),d/spec.directions*Math.PI*2,camera);
   for(let i=0;i<112;i++)assert.equal(image.data[i*4+3]!+image.data[(111*112+i)*4+3]!+image.data[i*112*4+3]!+image.data[(i*112+111)*4+3]!,0,`${kind}/${clip}/${d}`);
  }
 }
});

test('marine presentation hides submerged whales, draws a surfaced blow and keeps fish below glints',async()=>{
 const {readFile}=await import('node:fs/promises');
 const {composeInfinite,cameraBounds}=await import('../src/jungle/infinite-scene');
 const atlas=JSON.parse(await readFile('public/assets/jungle.json','utf8'));
 const w=new InfiniteWorld(2718),p=w.wildlifeLandmark('whale');
 const view={width:1000,height:700,pixelRatio:1,zoom:1.35,grid:false,cameraX:p.x,cameraY:p.y};w.ensure(cameraBounds(view));
 const whale=w.agents.find(a=>a.kind==='whale') as WhaleAgent;
 whale.state='travel';whale.altitude=-12;Object.assign(whale.previous,whale.sample());
 let frame=composeInfinite(w,atlas,view);assert.equal(frame.commands.find(c=>c.id===whale.id)?.color[3]??0,0);
 whale.state='surface';whale.altitude=0;whale.breathClock=whale.cycleSeconds*.915;whale.previousBreath=whale.breathClock;Object.assign(whale.previous,whale.sample());
 frame=composeInfinite(w,atlas,view);assert.equal(frame.commands.find(c=>c.id===whale.id)?.color[3],255);
 assert.equal(frame.commands.filter(c=>c.id.startsWith(`${whale.id}-blow-`)).length,7);
 // Fish now require substantial water and need not share a particular whale's territory.
 const fp=w.wildlifeLandmark('fish');view.cameraX=fp.x;view.cameraY=fp.y;w.ensure(cameraBounds(view));
 const fish=w.agents.filter(a=>a.kind==='fish');assert.ok(fish.length>0);
 frame=composeInfinite(w,atlas,view);assert.ok(frame.commands.some(c=>fish.some(f=>f.id===c.id)&&c.layer<1));
});
