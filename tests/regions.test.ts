import test from 'node:test';
import assert from 'node:assert/strict';
import {CONFIG} from '../src/config';
import {forestRegion,regionalWetness} from '../src/jungle/regions';
import {InfiniteWorld,faunaPlan} from '../src/jungle/infinite';
import {jungleAgents,LandscapePatchAgent} from '../src/jungle/agents';
import {terrainFields,TerrainChunk} from '../src/jungle/terrain';

test('open, flowering, fruiting and wet regions recur far beyond the opening in both directions',()=>{
 for(const seed of [71,2718,2026]){
  const samples=[];for(let t=-512;t<=512;t+=4)if(Math.abs(t)>64)samples.push({...forestRegion(t,-t,seed),wet:regionalWetness(t,-t,seed)});
  assert.ok(samples.filter(p=>p.canopy<.4).length>10);assert.ok(samples.filter(p=>p.canopy>.95).length>10);
  for(const key of ['flowers','fruit','wet'] as const){assert.ok(samples.some(p=>p[key]>.95));assert.ok(samples.some(p=>p[key]<.05));}
  for(const x of [-24,-4,0,4,24]){const a=forestRegion(x-1e-7,-x,seed),b=forestRegion(x+1e-7,-x,seed);for(const k of ['canopy','flowers','fruit'] as const)assert.ok(Math.abs(a[k]-b[k])<1e-6);}
 }
 const w=new InfiniteWorld(2718),styles=new Set<string>();
 for(const t of [-128,-64,64,112,144]){w.ensure({minX:t-4,minY:-t-4,maxX:t+4,maxY:-t+4});for(const a of w.agents)if(a instanceof LandscapePatchAgent)for(const p of a.pieces)styles.add(p.style);}
 for(const kind of ['grove','grass','flowers','bloom','fruit','mud','water','wet'])assert.ok(styles.has(kind),kind);
});

test('regional water follows shared negative-edge terrain fields and honors the no-water setting',()=>{
 const w=new InfiniteWorld(),a=TerrainChunk.generate(-1,-1,w.seed),b=TerrainChunk.generate(0,-1,w.seed);
 for(let y=-4;y<0;y+=.125){const ta=a.tile(3,Math.floor(y)+4),tb=b.tile(0,Math.floor(y)+4);assert.deepEqual(ta.fieldsAt(0,y),tb.fieldsAt(0,y));assert.equal(ta.heightAt(0,y),tb.heightAt(0,y));}
 const dry=new InfiniteWorld(2718,'rainforest',undefined,{water:0});
 for(let t=-128;t<128;t+=3)assert.ok(terrainFields(t,-t,2718,dry.settings)[0]>=0);
});

test('dense canopy gets more colorful bird candidates without changing ground animal candidate rates',()=>{
 const count=()=>{let birds=0,deer=0;for(let i=0;i<2000;i++){const p=faunaPlan(i,-i,71,2.5,1);birds+=Number(p.macaw)+Number(p.parakeet)+Number(p.kingfisher)+Number(p.toucan);deer+=Number(p.deer);}return{birds,deer};};
 const boosted=count(),before=CONFIG.world.population.canopyBirdBoost;
 try{CONFIG.world.population.canopyBirdBoost=0;const base=count();assert.ok(boosted.birds>base.birds*1.8);assert.equal(boosted.deer,base.deer);}finally{CONFIG.world.population.canopyBirdBoost=before;}
});

test('bird and bear placement cannot perturb other species random streams',()=>{
 const bounds={minX:32,minY:-16,maxX:48,maxY:0};
 const a=new InfiniteWorld(71);a.ensure(bounds);
 const old=CONFIG.world.population.macaw,bear=CONFIG.world.population.blackBear;
 try{
  CONFIG.world.population.macaw=0;CONFIG.world.population.blackBear=0;
  const b=new InfiniteWorld(71);b.ensure(bounds);
  const keep=(w:InfiniteWorld)=>w.agents.filter(a=>a.kind!=='macaw'&&a.kind!=='blackBear');
  assert.deepEqual(jungleAgents.encode(keep(a)),jungleAgents.encode(keep(b)));
 }finally{CONFIG.world.population.macaw=old;CONFIG.world.population.blackBear=bear;}
});
