import { riverPaths } from '../src/jungle/rivers';
import { DEFAULT_SETTINGS } from '../src/jungle/settings';
import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../src/config';
import { nearestVolcano, volcanoSite, volcanoesIn, volcanicGround, lavaPoint, lavaDanger, lavaSegments } from '../src/jungle/volcanoes';
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
  const p=lavaPoint(v,1,.1,0),deer=new DeerAgent('volcanic-herd:mother',p.x,p.y,71);
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

test('lava contact follows the visible shared ribbon and distal surges cool to obsidian',()=>{
  const at=lavaPoint(v,1,.1,0);assert.ok(lavaDanger(v,at.x,at.y,0).distance<0);assert.ok(lavaDanger(v,at.x,at.y,0).heat>.7);
  const hotTime=18-v.phase,coldTime=46-v.phase;
  assert.ok(lavaPoint(v,1,.7,hotTime).heat>lavaPoint(v,1,.7,coldTime).heat);
  const segments=lavaSegments(v,hotTime);assert.equal(segments.length,96);
  for(let branch=0;branch<3;branch++)for(let i=0;i<31;i++)assert.deepEqual(segments[branch*32+i]!.b,segments[branch*32+i+1]!.a);
  assert.equal(lavaDanger(v,v.x-15,v.y-15,0).distance>1,true);
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
  const home={x:a.x,y:a.y};a.update(dt,env);assert.equal(a.phase,'alive');assert.equal(a.cycles,1);assert.ok(Math.hypot(a.x-home.x,a.y-home.y)>3);
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
  assert.ok(ids.includes(v.id));assert.ok(ids.some(id=>id?.includes(':molten')));assert.ok(ids.some(id=>id?.includes(':obsidian')));assert.ok(ids.some(id=>id?.includes(':smoke')));assert.ok(ids.some(id=>id?.includes(':fire')));
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
