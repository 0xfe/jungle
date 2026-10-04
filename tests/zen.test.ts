import test from 'node:test';
import assert from 'node:assert/strict';
import { InfiniteWorld, faunaPlan } from '../src/jungle/infinite';
import { zenSite, nearestZen, zenPlants, zenLayout, zenPaths, pondRadius } from '../src/jungle/zen-sites';
import { DEFAULT_SETTINGS, normalizeSettings } from '../src/jungle/settings';
import { ARTIFACT_KINDS, ARTIFACT_DEFAULTS } from '../src/jungle/artifacts';
import { TerrainChunk, TerrainKind } from '../src/jungle/terrain';
import { ZenGardenAgent, ZenMonkAgent, KoiAgent, DuckAgent, PelicanAgent } from '../src/jungle/agents/zen';
import { jungleAgents } from '../src/jungle/agents';
import { TapSequence, TouchTaps } from '../src/iso/navigation';
import { jungleSound } from '../src/jungle/sound';
import { Soundscape } from '../src/audio';
import { spacecraftCandidate } from '../src/jungle/space-sites';
import { volcanoSite } from '../src/jungle/volcanoes';
import { spritePieces } from '../scripts/art/sprite-pieces';
import { ZEN_BELLS, ZEN_TEMPLE } from '../src/jungle/zen-layout';
import { bakeZen } from '../scripts/art/zen';

const worldAt=()=>{const w=new InfiniteWorld(2718),s=w.zenLandmark()!;assert.ok(s);w.ensure({minX:s.x-8,minY:s.y-8,maxX:s.x+8,maxY:s.y+8});return {w,s};};
test('sanctuaries are rare, varied, deterministic and level with a real nearby pond',()=>{
 const sites=[];for(let y=-8;y<8;y++)for(let x=-8;x<8;x++){const a=zenSite(x,y,2718);assert.deepEqual(a,zenSite(x,y,2718));if(a)sites.push(a);}
 assert.ok(sites.length>25&&sites.length<120);assert.equal(new Set(sites.map(s=>s.form)).size,3);
 for(const a of sites)for(const b of sites)if(a!==b)assert.ok(Math.hypot(a.x-b.x,a.y-b.y)>45);
 const {w,s}=worldAt();const heights=[];
 for(let y=-1;y<=2;y+=.25)for(let x=-2;x<=.3;x+=.25){assert.ok(w.tileAt(s.x+x,s.y+y)!.materialAt(s.x+x,s.y+y)<TerrainKind.Shallow);heights.push(w.heightAt(s.x+x,s.y+y));}
 assert.ok(Math.max(...heights)-Math.min(...heights)<.1);
 assert.ok(w.tileAt(s.pondX,s.pondY)!.materialAt(s.pondX,s.pondY)>=TerrainKind.Shallow);
 const cx=Math.floor(s.x/4),cy=Math.floor(s.y/4),a=TerrainChunk.generate(cx,cy,2718),b=TerrainChunk.generate(cx+1,cy,2718);
 for(let y=0;y<4;y++)assert.equal(a.tile(3,y).heights[1],b.tile(0,y).heights[0]);
 for(const p of zenPlants(s,w.settings))if(p.kind==='lotus')assert.ok(w.tileAt(p.x,p.y)!.materialAt(p.x,p.y)>=TerrainKind.Shallow);
});
test('all generation controls can disable their kind and survive checkpoint normalization',()=>{
 const disabled=normalizeSettings(Object.fromEntries(ARTIFACT_KINDS.map(k=>[`chance_${k}`,0])));
 assert.equal(nearestZen(2718,0,0,disabled),undefined);
 for(let i=-20;i<20;i++){assert.equal(volcanoSite(i,-i,2718,0),undefined);assert.equal(spacecraftCandidate(i,0,2718,2.5,disabled),undefined);const plan=faunaPlan(i,-i,2718,2.5,1,disabled);for(const [k,v] of Object.entries(plan))if(k!=='random')assert.equal(v,false,k);}
 const w=new InfiniteWorld(42,'rainforest',undefined,disabled);w.ensure({minX:-4,minY:-4,maxX:4,maxY:4});assert.equal(w.agents.length,0);
 assert.deepEqual(InfiniteWorld.restore(w.checkpoint()).settings,disabled);
 assert.equal(normalizeSettings({chance_pagoda:Infinity}).chance_pagoda,1);assert.equal(normalizeSettings({chance_koi:99}).chance_koi,3);
});
test('resident routines stay in habitat, visit all monk activities and resume exactly',()=>{
 const {w,s}=worldAt(),a=w.agents.find((a):a is ZenGardenAgent=>a instanceof ZenGardenAgent)!;assert.ok(a);
 const env={time:0,canMove:(x:number,y:number)=>w.canMove(x,y),sample:(x:number,y:number)=>({water:w.tileAt(x,y)!.materialAt(x,y)>=TerrainKind.Shallow,elevation:w.heightAt(x,y),light:1,wind:1,moisture:.5}),nearby:()=>[]};
 const seen=new Set<number>();
 for(let i=0;i<220*60;i++){a.update(1/60,env);for(const c of a.residents){if(c instanceof ZenMonkAgent)seen.add(c.state);else assert.ok(env.sample(c.x,c.y).water,`${c.kind} left pond`);}}
 for(const state of [0,1,2,3,4,5])assert.ok(seen.has(state),`monk state ${state}`);
 const b=jungleAgents.decode(jungleAgents.encode([a]))[0] as ZenGardenAgent;
 for(let i=0;i<600;i++){a.update(1/60,env);b.update(1/60,env);}assert.deepEqual(jungleAgents.encode([a]),jungleAgents.encode([b]));
 for(const c of a.residents)assert.deepEqual(jungleAgents.encode([c]),jungleAgents.encode(jungleAgents.decode(jungleAgents.encode([c]))));
 const bytes=jungleAgents.encode([a]);assert.throws(()=>jungleAgents.decode(bytes.subarray(0,bytes.length-2)),/Truncated/);
});
test('monks work independently at distinct beds while a separate procession circles real trees',()=>{
 const {w,s}=worldAt(),owner=w.agents.find((a):a is ZenGardenAgent=>a instanceof ZenGardenAgent)!;
 const monks=owner.residents.filter((a):a is ZenMonkAgent=>a instanceof ZenMonkAgent);
 const independent=monks.filter(a=>!a.role),group=monks.filter(a=>a.role);
 assert.equal(independent.length,6);assert.equal(group.length,3);
 assert.equal(new Set(independent.map(a=>`${a.flowerX},${a.flowerY}`)).size,independent.length);
 const plants=zenPlants(s,w.settings),grove=zenLayout(s).grove;
 assert.ok(plants.filter(p=>p.kind==='tree'&&Math.hypot(p.x-grove.x,p.y-grove.y)<.7).length>=3);
 const env={time:0,canMove:(x:number,y:number)=>w.canMove(x,y),sample:(x:number,y:number)=>({water:w.tileAt(x,y)!.materialAt(x,y)>=TerrainKind.Shallow,elevation:w.heightAt(x,y),light:1,wind:1,moisture:.5}),nearby:()=>[]};
 let mixed=false,concurrentWatering=false,processionWithWorkers=false,returned=false;
 for(let tick=0;tick<600*60;tick++){
  owner.update(1/60,env);
  if(tick%30)continue;
  const workers=independent.filter(a=>a.visibility>.9);
  mixed ||= new Set(workers.map(a=>a.state)).size>=3;
  concurrentWatering ||= workers.filter(a=>a.state===3).length>=2;
  processionWithWorkers ||= group.every(a=>a.state===4)&&workers.some(a=>a.state===2||a.state===3);
  returned ||= tick>3000&&independent.some(a=>a.state===0&&a.visits>0&&a.visibility<.1);
  assert.ok(independent.every(a=>a.state!==4));assert.ok(group.every(a=>a.state!==2&&a.state!==3));
  for(const a of independent.filter(a=>a.state===3))assert.ok(Math.hypot(a.x-a.flowerX,a.y-a.flowerY)<.05);
  for(const a of group.filter(a=>a.state===4))assert.ok(Math.hypot(a.x-grove.x,a.y-grove.y)>.7);
 }
 assert.ok(mixed,'simultaneous independent tasks');assert.ok(concurrentWatering,'different beds watered concurrently');
 assert.ok(processionWithWorkers,'procession is separate from working monks');assert.ok(returned,'residents return indoors');
});
test('sanctuary planting is grassy, dense and connected by aligned, consistent-width entrance and pond paths',()=>{
 const {w,s}=worldAt(),plants=zenPlants(s,w.settings),paths=zenPaths(s),layout=zenLayout(s);
 assert.ok(plants.filter(p=>p.kind==='grass').length>180);
 assert.ok(plants.filter(p=>p.kind==='tree').length>16);
 assert.ok(plants.filter(p=>p.kind==='shrub').length>25);
 assert.ok(plants.filter(p=>p.kind==='flower').length>20);
 assert.ok(plants.filter(p=>p.kind==='stone').length>10);
 assert.ok(Math.hypot(paths[0]!.x-layout.steps.x,paths[0]!.y-layout.steps.y)<.08);
 for(const branch of [0,1]){
  const route=paths.filter(p=>p.branch===branch);
  assert.ok(Math.max(...route.map(p=>p.radius))/Math.min(...route.map(p=>p.radius))<1.05);
  for(let i=1;i<route.length;i++)assert.ok(Math.hypot(route[i]!.x-route[i-1]!.x,route[i]!.y-route[i-1]!.y)<route[i]!.radius+route[i-1]!.radius);
 }
 const end=paths.at(-1)!;assert.deepEqual({x:end.x,y:end.y},layout.dockEntry);
 assert.ok(pondRadius(s,layout.dock.x,layout.dock.y)<1);
 assert.ok(plants.some(p=>p.kind==='dock'));
 const hedges=plants.filter(p=>p.kind==='hedge');assert.ok(hedges.length>15);
 assert.ok(new Set(hedges.map(p=>p.variant)).size>=4);
 assert.ok(hedges.every(p=>Math.hypot(p.x-layout.steps.x,p.y-layout.steps.y)>=.65));
 const strips=plants.filter(p=>p.kind==='path');
 for(const p of strips)assert.ok(p.corners&&Math.abs(Math.hypot(p.corners[0].x-p.corners[1].x,p.corners[0].y-p.corners[1].y)-p.scale*2)<1e-9);
 const bare=zenPlants(s,normalizeSettings({chance_grass:0,chance_bush:0,chance_zenFlowers:0,chance_mud:0}));
 assert.ok(bare.every(p=>!['grass','edgegrass','shrub','hedge','flower','path','stone'].includes(p.kind)));
});
test('cached sanctuary clocks and inhabitants sleep and resume without duplicate owners',()=>{
 const {w,s}=worldAt(),a=w.agents.find((a):a is ZenGardenAgent=>a instanceof ZenGardenAgent)!;
 for(let i=0;i<60;i++)w.update(1/60);const saved=jungleAgents.encode([a]);
 w.ensure({minX:s.x+32,minY:s.y,maxX:s.x+36,maxY:s.y+4});w.update(1/60);
 w.ensure({minX:s.x-4,minY:s.y-4,maxX:s.x+4,maxY:s.y+4});
 const owners=w.agents.filter(a=>a.id===s.id);assert.equal(owners.length,1);assert.deepEqual(jungleAgents.encode(owners),saved);
 const r=InfiniteWorld.restore(w.checkpoint());r.ensure({minX:s.x-4,minY:s.y-4,maxX:s.x+4,maxY:s.y+4});
 for(let i=0;i<30;i++){w.update(1/60);r.update(1/60);}assert.deepEqual(jungleAgents.encode(w.agents),jungleAgents.encode(r.agents));
});
test('pelican bill dips trigger koi reactions through immutable perception',()=>{
 const k=new KoiAgent('k',0,0,1),env={time:0,sample:()=>({water:true,elevation:0,wind:1,light:1,moisture:.5}),canMove:()=>false,nearby:()=>[{id:'p',kind:'pelican',x:.1,y:0,speed:0,alarm:1}]};
 k.update(1/60,env);assert.equal(k.state,1);assert.ok(k.timer>1);
});
test('five short taps reveal only at five; drags, long gaps and distant taps cancel',()=>{
 const taps=new TouchTaps(),secret=new TapSequence();
 for(let i=0;i<5;i++){taps.begin(1,{x:20,y:20},i*200);assert.ok(taps.end(1,i*200+30));assert.equal(secret.accept(i*200+30,{x:20,y:20}),i===4);}
 secret.accept(1000,{x:20,y:20});secret.clear();for(let i=0;i<4;i++)assert.equal(secret.accept(1200+i*100,{x:20,y:20}),false);
 assert.equal(secret.accept(2400,{x:20,y:20}),false);assert.equal(secret.accept(2500,{x:80,y:80}),false);
 taps.begin(2,{x:20,y:20},3000);taps.move(2,{x:40,y:20});assert.equal(taps.end(2,3040),0);
});
test('sanctuary music attenuates with distance and respects environment mute and pause',()=>{
 const {w,s}=worldAt(),near=jungleSound(w,s.x,s.y),far=jungleSound(w,s.x+15,s.y+15),m=new Soundscape();
 assert.ok(m.update(near,.1).beds.zen>0);assert.equal(m.update(far,.1).beds.zen,0);assert.equal(m.update(near,.1,undefined,false).beds.zen,0);
 assert.equal(m.update(near,.1,{master:1,wildlife:1,ambience:0}).beds.zen,0);
});
test('pagoda hanging ornaments have registered, nonempty looping poses',async()=>{
 const sprites=await bakeZen(),bells=sprites.filter(s=>s.id.startsWith('zen-bell-'));
 assert.equal(bells.length,ZEN_BELLS.length);
 for(const bell of bells){
  assert.equal(bell.frames.length,32);
  assert.ok(bell.frames.every(f=>f.data.some((n,i)=>i%4===3&&n>0)));
  assert.ok(bell.frames.some(f=>!Buffer.from(f.data).equals(Buffer.from(bell.frames[0]!.data))),bell.id);
 }
 const temple=sprites.find(s=>s.id==='zen-pagoda-0')!;
 assert.ok(temple.frames[0]!.width>150,'broad foundation retained at bake resolution');
 assert.equal(ZEN_TEMPLE.size,2.1);
});
test('registered sanctuary pieces reconstruct every original baked pose exactly',async()=>{
 for(const s of await bakeZen()){
  const parts=spritePieces(s,s.id.startsWith('zen-pagoda-')?4:2),first=s.frames[0]!;
  for(let f=0;f<s.frames.length;f++){
   const data=new Uint8Array(first.data.length);
   for(const part of parts){const x=s.anchor[0]-part.anchor[0],y=s.anchor[1]-part.anchor[1],frame=part.frames[f%part.frames.length]!;
    for(let row=0;row<frame.height;row++)data.set(frame.data.subarray(row*frame.width*4,(row+1)*frame.width*4),((y+row)*first.width+x)*4);
   }assert.deepEqual(data,s.frames[f]!.data,s.id);
  }
 }
});

test('monks follow the stair rise in both directions and fade only inside the doorway',()=>{
 const {w,s}=worldAt(),owner=ZenGardenAgent.create(s,w.settings),a=owner.residents.find(c=>c instanceof ZenMonkAgent) as ZenMonkAgent,layout=zenLayout(s);
 const env={time:0,sample:()=>({water:false,elevation:0,light:1,wind:1,moisture:.5}),canMove:()=>true,nearby:()=>[]};
 a.timer=0;let climbed=false,descended=false,fadedIn=false,fadedOut=false;let saved=false;
 for(let i=0;i<300*60;i++){
  a.update(1/60,env);
  if(a.state===5&&a.lift>a.previousLift+.001)climbed=true;
  if(a.state===1&&a.lift<a.previousLift-.001)descended=true;
  if(a.visibility>.01&&a.visibility<.99){
   assert.ok(Math.hypot(a.x-layout.door.x,a.y-layout.door.y)<.17);
   fadedIn ||= a.state===1;fadedOut ||= a.state===5;
  }
  if(!saved&&a.lift>1&&a.lift<18){
   saved=true;const b=jungleAgents.decode(jungleAgents.encode([a]))[0] as ZenMonkAgent;
   a.update(1/60,env);b.update(1/60,env);assert.deepEqual(jungleAgents.encode([a]),jungleAgents.encode([b]));
  }
 }
 assert.ok(climbed&&descended&&fadedIn&&fadedOut&&saved);
 assert.equal(zenPlants(s,w.settings).find(p=>p.kind==='dock')!.scale,1);
 assert.ok(Math.abs(layout.dockEntry.y-layout.dock.y-.4)<1e-10);
});
