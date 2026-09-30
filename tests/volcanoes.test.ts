import { volcanicApproaches } from '../src/jungle/volcanic-encounters';
import { riverPaths } from '../src/jungle/rivers';
import { DEFAULT_SETTINGS } from '../src/jungle/settings';
import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../src/config';
import { nearestVolcano, volcanoSite, volcanoesIn, volcanicGround, lavaPoint, lavaDanger, lavaSegments, volcanicClearance, VOLCANO_OUTLETS, VOLCANO_ART_SCALE, LAVA_SEGMENTS } from '../src/jungle/volcanoes';
import { InfiniteWorld } from '../src/jungle/infinite';
import { TerrainChunk, TerrainKind, terrainFields } from '../src/jungle/terrain';
import { DeerAgent, VolcanicWildlifeAgent, jungleAgents } from '../src/jungle/agents';
import type { VolcanoEnvironment } from '../src/jungle/agents/volcanic-wildlife';
import { AgentSystem } from '../src/agents';
import { readFile } from 'node:fs/promises';
import { composeInfinite, spawnOutsideView } from '../src/jungle/infinite-scene';
import type { AtlasManifest } from '../src/jungle/scene';

const seed=2718,v=nearestVolcano(seed),dt=1/60;
const env:VolcanoEnvironment={time:0,sample:()=>({moisture:.5,light:.8,wind:0,elevation:0,water:false}),canMove:()=>true,nearby:()=>[],spawnHidden:()=>true};
function trapped(){
  const p=lavaPoint(v,.7,0),deer=new DeerAgent('volcanic-herd:mother',p.x,p.y,71);
  deer.groupId='volcanic-herd';deer.leaderId=deer.id;deer.territory=[v.x-10,v.y-10,v.x+10,v.y+10];
  return new VolcanicWildlifeAgent(deer,v);
}
function step(a:VolcanicWildlifeAgent,seconds:number,e=env){for(let i=0;i<Math.round(seconds/dt);i++)a.update(dt,e);}

test('volcano sites are rare, varied, widely separated and independent of signed visit order',()=>{
  const sites=[];
  for(let y=-8;y<=8;y++)for(let x=-8;x<=8;x++){const a=volcanoSite(x,y,seed);if(a)sites.push(a);assert.deepEqual(volcanoSite(x,y,seed),a);}
  assert.ok(sites.length>25&&sites.length<95,`sites ${sites.length} / 289`);
  assert.equal(new Set(sites.map(v=>v.form)).size,4);
  for(const a of sites)for(const b of sites)if(a!==b)assert.ok(Math.hypot(a.x-b.x,a.y-b.y)>=CONFIG.world.volcanoes.spacing*.7);
  const bounds={minX:v.x-5,minY:v.y-5,maxX:v.x+5,maxY:v.y+5};
  assert.deepEqual(volcanoesIn(bounds,seed),volcanoesIn(bounds,seed));assert.equal(volcanoesIn(bounds,seed)[0]!.id,v.id);
});

test('volcanic terrain and sparse vegetation share signed borders and keep the cone on land',()=>{
  const negative=nearestVolcano(seed,-400,-400),cx=Math.floor(negative.x/4),cy=Math.floor(negative.y/4);
  const a=TerrainChunk.generate(cx,cy,seed),b=TerrainChunk.generate(cx-1,cy,seed);
  for(let y=0;y<4;y++)assert.deepEqual(a.tile(0,y).heights.filter((_,i)=>i===0||i===2),b.tile(3,y).heights.filter((_,i)=>i===1||i===3));
  for(let y=0;y<=8;y++)assert.deepEqual(terrainFields(cx*4,cy*4+y/2,seed),a.tile(0,Math.min(3,Math.floor(y/2))).fields![y===8?6:(y%2)*3]);
  const p=volcanicGround(negative.x,negative.y,seed);assert.equal(p.core,true);assert.equal(p.scar,1);
  assert.ok(a.tile(Math.floor(negative.x)-cx*4,Math.floor(negative.y)-cy*4).materialAt(negative.x,negative.y)<TerrainKind.Shallow);
});

test('short filled lava channels retain registered outlets, irregular banks and rounded pools',()=>{
  for(let form=0;form<4;form++){
    const site={...v,form},outlet=VOLCANO_OUTLETS[form]!,start=lavaPoint(site,0),end=lavaPoint(site,1);
    const x=(start.x-v.x)-(start.y-v.y),y=(start.x-v.x)+(start.y-v.y);
    assert.ok(Math.abs(x*96-(outlet.x-52)*VOLCANO_ART_SCALE)<1e-9);
    assert.ok(Math.abs(y*48-(outlet.y-71.5)*VOLCANO_ART_SCALE)<1e-9);
    assert.equal(start.width,outlet.width);assert.ok(end.width<1e-7);
    assert.ok(Math.hypot(end.x-start.x,end.y-start.y)<2.4);
    assert.ok(lavaPoint(site,.77).width>lavaPoint(site,.4).width*1.3);
    const at=lavaPoint(site,.7);assert.ok(lavaDanger(site,at.x,at.y).distance<0);
    assert.deepEqual(lavaPoint(site,.7,0),lavaPoint(site,.7,100));
    const segments=lavaSegments(site,0);assert.equal(segments.length,LAVA_SEGMENTS);
    assert.equal(lavaSegments(site,17),segments,'time must not allocate new geometry');
    for(let i=0;i<segments.length-1;i++)assert.equal(segments[i]!.b,segments[i+1]!.a);
  }
});

test('wildlife turns and escapes hot lava with distance-driven feet',()=>{
  const a=trapped(),start={x:a.x,y:a.y};a.animal.heading=0;
  a.update(dt,env);assert.ok(Math.hypot(a.x-start.x,a.y-start.y)<.01);
  step(a,5);assert.equal(a.phase,'alive');assert.ok(Math.hypot(a.x-start.x,a.y-start.y)>.4);
});

test('trapped wildlife burns, leaves ash, waits for offscreen space and preserves family replacement',()=>{
  const a=trapped(),blocked={...env,canMove:()=>false};step(a,3,blocked);assert.equal(a.phase,'burn');assert.equal(a.speed,undefined);
  const clone=jungleAgents.decode(jungleAgents.encode([a]))[0] as VolcanicWildlifeAgent;
  step(a,4,blocked);step(clone,4,blocked);assert.equal(a.phase,'waiting');assert.ok(a.ashRemaining>0);assert.deepEqual(jungleAgents.encode([a]),jungleAgents.encode([clone]));
  step(a,20,{...env,spawnHidden:()=>false});assert.equal(a.phase,'waiting');
  const home={x:a.x,y:a.y};for(let i=0;i<180&&a.phase==='waiting';i++)a.update(dt,env);assert.equal(a.phase,'alive');assert.equal(a.cycles,1);assert.ok(Math.hypot(a.x-home.x,a.y-home.y)>3);
  assert.equal(a.animal.groupId,'volcanic-herd');assert.equal(a.animal.leaderId,a.id);assert.deepEqual(a.animal.target,home);
  assert.deepEqual(a.animal.previous,a.animal.sample());assert.ok(a.ashRemaining>0);
  const resumed=jungleAgents.decode(jungleAgents.encode([a]))[0] as VolcanicWildlifeAgent;
  step(a,4);step(resumed,4);assert.deepEqual(jungleAgents.encode([a]),jungleAgents.encode([resumed]));
});

test('burning and absent animals are excluded from the pre-update neighbor snapshot',()=>{
  const a=trapped();a.phase='burn';let perceived=-1;
  const probe=new DeerAgent('probe',a.x,a.y,10);probe.update=(_dt,e)=>{perceived=e.nearby(a.x,a.y,2).filter(n=>n.id===a.id).length;};
  new AgentSystem().step([a,probe],dt,env);assert.equal(perceived,0);
});

test('volcano world checkpoints retain bounded lifecycle state and exact continuation',()=>{
  const w=new InfiniteWorld(seed),bounds={minX:v.x-9,minY:v.y-9,maxX:v.x+9,maxY:v.y+9};w.ensure(bounds);
  assert.ok(w.agents.some(a=>a instanceof VolcanicWildlifeAgent));
  const actor=w.agents.find(a=>a instanceof VolcanicWildlifeAgent) as VolcanicWildlifeAgent;actor.phase='burn';actor.elapsed=1.3;
  for(let i=0;i<30;i++)w.update(dt);
  const restored=InfiniteWorld.restore(w.checkpoint());restored.ensure(bounds);
  for(let i=0;i<180;i++){w.update(dt);restored.update(dt);}
  assert.deepEqual(jungleAgents.encode(w.agents),jungleAgents.encode(restored.agents));
  assert.ok(w.cache.bytes<=w.cache.budget.maxBytes);
  const sleeping=jungleAgents.encode(w.agents);w.ensure({minX:v.x+14,minY:v.y,maxX:v.x+15,maxY:v.y+1});w.ensure(bounds);assert.deepEqual(jungleAgents.encode(w.agents),sleeping);
});

test('volcano composition includes grounded scar, crust, active vent and dramatic burn without new textures',async()=>{
  const atlas:AtlasManifest=JSON.parse(await readFile('public/assets/jungle.json','utf8'));
  for(let i=0;i<4;i++)assert.ok(atlas.sprites[`volcano-${i}`]);assert.ok(atlas.width<=4096&&atlas.height<=4096);
  const w=new InfiniteWorld(seed),view={width:1000,height:750,pixelRatio:1,zoom:1,grid:false,cameraX:v.x,cameraY:v.y+2};
  w.ensure({minX:v.x-9,minY:v.y-9,maxX:v.x+9,maxY:v.y+9});w.time=18-v.phase;
  const a=trapped();a.phase='burn';a.elapsed=a.previousElapsed=2;w.agents.push(a);
  const f=composeInfinite(w,atlas,view),ids=f.commands.map(c=>c.id);
  assert.ok(ids.includes(v.id));
  const bank=f.commands.findIndex(c=>c.id===`${v.id}:lava:30:obsidian`),molten=f.commands.findIndex(c=>c.id===`${v.id}:lava:30:molten`);
  assert.ok(bank>=0&&molten>bank,'molten surface must draw above its opaque crust bank');assert.ok(ids.some(id=>id?.includes(':molten')));assert.ok(ids.some(id=>id?.includes(':obsidian')));assert.ok(ids.some(id=>id?.includes(':smoke')));assert.ok(ids.some(id=>id?.includes(':fire')));
  assert.equal(w.spawnHidden!(view.cameraX,view.cameraY),false);assert.equal(w.spawnHidden!(view.cameraX+100,view.cameraY),true);
});

test('replacement admission tracks zoom changes before another frame is composed',()=>{
  const w=new InfiniteWorld(seed),view={width:1000,height:750,pixelRatio:1,zoom:2.5,grid:false,cameraX:v.x,cameraY:v.y};
  assert.equal(spawnOutsideView(w,view,v.x+5,v.y-5),true);
  view.zoom=.65;
  assert.equal(spawnOutsideView(w,view,v.x+5,v.y-5),false);
});
test('volcanic records reject nested lifecycles, malformed counts and truncation',()=>{
  const bytes=jungleAgents.encode([trapped()]);
  const nested=bytes.slice();nested[15]=63;assert.throws(()=>jungleAgents.decode(nested),/Invalid volcanic/);
  const count=bytes.slice();count[11]=2;assert.throws(()=>jungleAgents.decode(count),/Invalid volcanic/);
  assert.throws(()=>jungleAgents.decode(bytes.subarray(0,bytes.length-1)),/Truncated/);
});

test('volcanic clearings preserve connected river centerlines',()=>{
  let near=0;
  for(const site of volcanoesIn({minX:-500,minY:-500,maxX:500,maxY:500},seed)){
    const paths=riverPaths({minX:site.x-10,minY:site.y-10,maxX:site.x+10,maxY:site.y+10},seed,DEFAULT_SETTINGS);
    for(const path of paths)for(const p of path.points)if(volcanicGround(p.x,p.y,seed).scar>0){
      near++;assert.ok(terrainFields(p.x,p.y,seed)[0]<0,'a volcanic scar must not dam the shared river field');
    }
  }
  assert.ok(near>0,'fixture must exercise river/volcano overlap');
});


test('ordinary wildlife rejects lava and ash during normal travel, while safe outer ground stays usable',()=>{
  const a=trapped(),point=lavaPoint(v,.8);
  a.animal.x=v.x+4;a.animal.y=v.y+2;
  let checked=false;
  a.animal.update=(_dt,e)=>{
    assert.equal(e.canMove(point.x,point.y),false);
    assert.equal(e.canMove(v.x+1,v.y+1),false);
    assert.equal(e.canMove(v.x+4,v.y+2),true);checked=true;
  };
  a.update(dt,env);assert.ok(checked);
});

test('failed replacement and escape searches have bounded retry work and exact continuation',()=>{
  const a=trapped();let probes=0;
  step(a,2,{...env,canMove:()=>{probes++;return false;}});
  assert.ok(probes<150,`blocked escape made ${probes} probes`);
  a.phase='waiting';a.elapsed=20;probes=0;
  step(a,5,{...env,spawnHidden:()=>{probes++;return false;}});
  assert.ok(probes<=96,`invisible spawn search made ${probes} probes`);
  assert.ok(probes>=32);
  const clone=jungleAgents.decode(jungleAgents.encode([a]))[0] as VolcanicWildlifeAgent;
  step(a,4);step(clone,4);assert.deepEqual(jungleAgents.encode([a]),jungleAgents.encode([clone]));
});

test('seeded ground wildlife starts outside volcanic exclusion zones',()=>{
  const w=new InfiniteWorld(seed);w.ensure({minX:v.x-7,minY:v.y-7,maxX:v.x+7,maxY:v.y+7});
  const population=w.agents.filter(a=>a instanceof VolcanicWildlifeAgent&&a.altitude<8);
  assert.ok(population.length>10);
  for(const a of population)assert.ok(volcanicClearance(v,a.x,a.y)>=.25,`${a.id} spawned in ash/lava`);
});


test('a normal travelling animal brakes before entering the hot bank',()=>{
  const a=trapped(),p=lavaPoint(v,.8);
  a.animal.x=p.x-p.normalX*1.5;a.animal.y=p.y-p.normalY*1.5;
  assert.ok(volcanicClearance(v,a.x,a.y)>.12);
  a.animal.heading=Math.atan2(p.y-a.y,p.x-a.x);a.animal.target={x:p.x,y:p.y};
  const deer=a.animal as DeerAgent;deer.state='walk';deer.timer=100;deer.senseTimer=100;
  for(let i=0;i<600;i++){
    a.update(dt,env);assert.ok(volcanicClearance(v,a.x,a.y)>=.119);assert.equal(a.phase,'alive');
  }
});

test('higher resolution mountains retain logical size and register fire only to molten source pixels',async()=>{
  const {default:sharp}=await import('sharp');
  const atlas:AtlasManifest=JSON.parse(await readFile('public/assets/jungle.json','utf8'));
  const raw=await sharp('public/assets/jungle.png').ensureAlpha().raw().toBuffer();
  assert.ok(atlas.width*atlas.height*4<=64*1048576);
  for(let form=0;form<4;form++){
    const s=atlas.sprites[`volcano-${form}`]!,f=s.frames[0]!,art=atlas.volcanoLava![form]!;
    assert.ok(f.width>=280&&f.height>=150,'rebake from source at three times the old resolution');
    assert.ok(s.width>465&&s.width<480,'keep the same world footprint');
    assert.ok(art.trails.length>=30&&art.trails.length<=72);assert.ok(art.glow.length<=160);
    const originX=52-s.anchor[0]/VOLCANO_ART_SCALE,originY=71.5-s.anchor[1]/VOLCANO_ART_SCALE;
    for(const trail of art.trails){
      assert.ok(trail.length>=7&&trail.length<=19);
      for(let i=1;i<trail.length;i++)assert.ok(trail[i]!.y>trail[i-1]!.y,'fire moves down the slope');
    }
    for(const p of [...art.glow,...art.trails.flat()]){
      const x=f.x+Math.floor((p.x-originX)*3+1e-6),y=f.y+Math.floor((p.y-originY)*3+1e-6),i=(y*atlas.width+x)*4;
      assert.ok(raw[i]!>235&&raw[i+1]!>60&&raw[i+2]!<85&&raw[i+3]!>220,'effects must be registered to incandescent art');
    }
  }
});

test('ground and slope lava pixels travel, emit smoke and freeze with presentation time',async()=>{
  const atlas:AtlasManifest=JSON.parse(await readFile('public/assets/jungle.json','utf8'));
  const world=new InfiniteWorld(seed),view={width:1200,height:850,pixelRatio:1,zoom:1,grid:false,cameraX:v.x,cameraY:v.y-.75};
  world.ensure({minX:v.x-8,minY:v.y-8,maxX:v.x+8,maxY:v.y+8});
  const saved=jungleAgents.encode(world.agents);
  const effects=(time:number)=>{world.time=world.previousTime=time;return composeInfinite(world,atlas,view).commands.filter(c=>c.id.startsWith(v.id)&&/:(flow|slope)/.test(c.id));};
  const first=effects(1),second=effects(1.4);
  for(const type of [':flow:',':slope-flow:',':flow-smoke:',':slope-smoke:']){
    const before=first.filter(c=>c.id.includes(type)),after=new Map(second.map(c=>[c.id,c]));
    assert.ok(before.length>5,`${type} must be visibly populated`);
    assert.ok(before.some(c=>{const d=after.get(c.id);return d&&Math.hypot(d.x-c.x,d.y-c.y)>1;}),`${type} must actually move`);
  }
  assert.ok(new Set(first.filter(c=>c.id.includes(':flow:')).map(c=>c.color.slice(0,3).join(','))).size>=4);
  assert.deepEqual(effects(1.4),second,'pause holds the exact visible flow');
  assert.deepEqual(jungleAgents.encode(world.agents),saved,'presentation never consumes simulation RNG/state');
});


test('volcanic nominations are bounded, order-independent and respect blocked paths',()=>{
  const walkers=Array.from({length:8},(_,i)=>{
    const p=lavaPoint(v,.82),deer=new DeerAgent(`visitor:${i}`,p.x+1+i*.1,p.y+.8,100+i);
    return new VolcanicWildlifeAgent(deer,v);
  });
  const time=20,context={...env,time};
  const nominations=volcanicApproaches(walkers,time-.1,context)!;
  assert.equal(nominations.size,1);
  assert.deepEqual(volcanicApproaches([...walkers].reverse(),time-.1,context),nominations);
  assert.equal(volcanicApproaches(walkers,time+.1,{...context,time:time+.2}),undefined,'no 60 Hz searches');
  assert.equal(volcanicApproaches(walkers,time-.1,{...context,canMove:()=>false})!.size,0);
  const selected=walkers.find(a=>nominations.has(a.id))!;
  const selectedEnv:VolcanoEnvironment={...context,approaches:nominations};
  selected.update(dt,selectedEnv);
  assert.ok(selected.approachRemaining>0);
  assert.equal(volcanicApproaches(walkers,time+.9,{...context,time:time+1})!.size,0,'only one excursion per opportunity');
  const clone=jungleAgents.decode(jungleAgents.encode([selected]))[0] as VolcanicWildlifeAgent;
  step(selected,8);step(clone,8);assert.deepEqual(jungleAgents.encode([selected]),jungleAgents.encode([clone]));
});

test('a populated volcano produces roughly one real lava ignition every 10–20 seconds',()=>{
  const w=new InfiniteWorld(seed);w.ensure({minX:v.x-8,minY:v.y-8,maxX:v.x+8,maxY:v.y+8});w.spawnHidden=()=>true;
  const wildlife=w.agents.filter(a=>a instanceof VolcanicWildlifeAgent),times:number[]=[];
  for(let tick=0;tick<7200;tick++){
    const before=wildlife.map(a=>({phase:a.phase,x:a.x,y:a.y,approach:a.approachRemaining}));w.update(dt);
    for(const [i,a] of wildlife.entries()){
      if(before[i]!.phase==='alive'&&before[i]!.approach>0)assert.ok(Math.hypot(a.x-before[i]!.x,a.y-before[i]!.y)<.05,'walkers must not teleport');
      if(a.phase==='burn'&&before[i]!.phase!=='burn'){
        times.push(w.time);assert.ok(lavaDanger(v,a.x,a.y).distance<0,'only actual molten contact ignites');
      }
    }
  }
  assert.ok(times.length>=6&&times.length<=10,`ignitions in 120 seconds: ${times}`);
  const mean=(times.at(-1)!-times[0]!)/(times.length-1);
  assert.ok(mean>=10&&mean<=20,`mean interval ${mean}`);
});
