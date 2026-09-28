import test from 'node:test';
import assert from 'node:assert/strict';
import { riverField, riverPaths, riverParticle } from '../src/jungle/rivers';
import { DEFAULT_SETTINGS } from '../src/jungle/settings';
import { TerrainChunk, TerrainKind, terrainEnvironment } from '../src/jungle/terrain';
import { InfiniteWorld, faunaPlan } from '../src/jungle/infinite';
import { CONFIG } from '../src/config';

test('river paths join water bodies and carry particles on connected rendered water across signed boundaries',()=>{
  const paths=riverPaths({minX:-48,minY:-48,maxX:48,maxY:48},2718,DEFAULT_SETTINGS);
  assert.ok(paths.length>5);
  for(const path of paths){
    for(const end of [path.points[0]!,path.points.at(-1)!])assert.ok(riverField(end.x,end.y,2718,DEFAULT_SETTINGS)<-.1);
    for(let i=0;i<=100;i++){
      const p=riverParticle(path,0,i/101),s=terrainEnvironment(p.x,p.y,2718);
      assert.equal(s.water,true,`${path.id} ${p.x},${p.y}`);
      const t=riverParticle(path,.02,i/101);
      if(p.fade===1)assert.ok((t.x-p.x)*Math.cos(p.heading)+(t.y-p.y)*Math.sin(p.heading)>0);
    }
  }
  const left=TerrainChunk.generate(-1,-1,2718),right=TerrainChunk.generate(0,-1,2718);
  for(let y=-4;y<0;y+=.125){const a=left.tile(3,Math.floor(y)+4),b=right.tile(0,Math.floor(y)+4);assert.deepEqual(a.fieldsAt(0,y),b.fieldsAt(0,y));assert.equal(a.heightAt(0,y),b.heightAt(0,y));}
});

test('water zero removes streams, river wildlife and water materials; generation remains visit-order independent',()=>{
  const settings={...DEFAULT_SETTINGS,water:0};
  assert.deepEqual(riverPaths({minX:-40,minY:-40,maxX:40,maxY:40},2718,settings),[]);
  for(let y=-40;y<=40;y+=4)for(let x=-40;x<=40;x+=4)assert.equal(terrainEnvironment(x,y,2718,settings).water,false);
  const a=new InfiniteWorld(42),b=new InfiniteWorld(42),near={minX:-4,minY:-4,maxX:4,maxY:4};
  b.ensure({minX:100,minY:100,maxX:108,maxY:108});b.ensure(near);a.ensure(near);
  assert.deepEqual(a.rivers,b.rivers);assert.deepEqual(a.agents,b.agents);
  const restored=InfiniteWorld.restore(a.checkpoint());restored.ensure(near);assert.deepEqual(a.rivers,restored.rivers);
  for(let i=0;i<120;i++){a.update(1/60);restored.update(1/60);}assert.deepEqual(a.agents,restored.agents);
});

test('open woodland favors deer and small snakes, dense cover favors predators, and both support birds',()=>{
  const totals=[{deer:0,smallSnake:0,parakeet:0,wolf:0,jaguar:0,squirrel:0,boar:0},{deer:0,smallSnake:0,parakeet:0,wolf:0,jaguar:0,squirrel:0,boar:0}];
  for(let x=-50;x<50;x++)for(let y=-30;y<30;y++)for(const [i,canopy] of [.15,1].entries()){
    const plan=faunaPlan(x,y,2718,CONFIG.world.settings.animals,canopy);
    for(const key of Object.keys(totals[i]!) as (keyof typeof totals[0])[])totals[i]![key]+=Number(plan[key]);
  }
  for(const key of ['deer','smallSnake','squirrel'] as const)assert.ok(totals[0]![key]>totals[1]![key]*1.6,key);
  assert.ok(totals[1]!.parakeet>totals[0]!.parakeet*.9,'canopy birds remain plentiful in dense stands');
  for(const key of ['wolf','jaguar','boar'] as const)assert.ok(totals[1]![key]>totals[0]![key]*1.6,key);
});

test('stream presentation includes downstream foam and twigs and is stable when time is paused',async()=>{
  const {readFile}=await import('node:fs/promises');
  const {composeInfinite,cameraBounds}=await import('../src/jungle/infinite-scene');
  const atlas=JSON.parse(await readFile('public/assets/jungle.json','utf8'));
  const world=new InfiniteWorld(2718),p=world.riverLandmark();
  const view={width:1100,height:750,pixelRatio:1,zoom:1.25,grid:false,cameraX:p.x,cameraY:p.y};world.ensure(cameraBounds(view));
  const flow=()=>composeInfinite(world,atlas,view,1).commands.filter(c=>c.id.startsWith('river:'));
  const before=flow();assert.ok(before.some(c=>c.id.endsWith(':twig')));assert.ok(before.some(c=>c.color[0]===201));
  assert.deepEqual(flow(),before);
  for(let i=0;i<120;i++)world.update(1/60);
  assert.notDeepEqual(flow(),before);
});
