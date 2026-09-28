import test from 'node:test';
import assert from 'node:assert/strict';
import {journeyDensity} from '../src/jungle/journey';
import {InfiniteWorld} from '../src/jungle/infinite';
import {PlantAgent,DeerAgent,WildlifeAgent,LandscapePatchAgent} from '../src/jungle/agents';

test('opening density rises smoothly in every direction and saturates at a bounded mature forest',()=>{
 const origin={x:-13.5,y:8.5};
 for(let angle=0;angle<Math.PI*2;angle+=Math.PI/4){let previous=journeyDensity(origin.x,origin.y,origin);
  for(let r=1;r<=100;r++){
   const d=journeyDensity(origin.x+Math.cos(angle)*r,origin.y+Math.sin(angle)*r,origin);
   assert.ok(d.plants>=previous.plants-1e-12&&d.animals>=previous.animals-1e-12);
   assert.ok(d.plants<=1&&d.animals<=1);previous=d;
  }
  assert.deepEqual(previous,{plants:1,animals:1});
 }
 assert.deepEqual(journeyDensity(origin.x,origin.y,origin),{plants:.24,animals:.85});
 assert.deepEqual(journeyDensity(origin.x+22,origin.y,origin),{plants:1,animals:1});
 assert.ok(journeyDensity(origin.x+12.5,origin.y,origin).plants>.6);
 assert.ok(Math.abs(journeyDensity(origin.x+3.001,origin.y,origin).plants-.24)<1e-6);
});

test('generated populations retain sparse plants and intact families while wildlife fills the opening',()=>{
 const totals=Array.from({length:3},()=>({plants:0,animals:0}));
 for(const seed of [2718,42,971,1234])for(let ring=0;ring<3;ring++)for(const [dx,dy] of [[1,0],[0,1],[-1,0],[0,-1]]){
  const w=new InfiniteWorld(seed,'rainforest',undefined,{water:0,barren:0,meadow:0});
  const r=[0,11,30][ring]!,x=w.origin.x+dx!*r,y=w.origin.y+dy!*r;
  w.ensure({minX:x-5,minY:y-5,maxX:x+5,maxY:y+5});
  // Count canopy trees, including the explicit trunks owned by grouped sprites.
  totals[ring]!.plants+=w.agents.reduce((n,a)=>n+(a instanceof PlantAgent&&a.kind==='tree'?1:a instanceof LandscapePatchAgent?a.supports.length:0),0);
  totals[ring]!.animals+=w.agents.filter(a=>a.speed!==undefined).length;
  for(const a of w.agents)if((a instanceof DeerAgent||a instanceof WildlifeAgent)&&a.groupId&&a.leaderId)assert.ok(w.agents.some(b=>b.id===a.leaderId));
 }
 assert.ok(totals[0]!.animals>100,JSON.stringify(totals));
 // Grouped groves fill in earlier; mature canopy still doubles the opening.
 assert.ok(totals[2]!.plants>totals[0]!.plants*1.8,JSON.stringify(totals));
 for(const kind of ['plants'] as const){
  assert.ok(totals[1]![kind]>totals[0]![kind]*1.3,JSON.stringify(totals));
  assert.ok(totals[2]![kind]>totals[1]![kind]*1.1,JSON.stringify(totals));
 }
});

test('opening origin survives checkpoint restore and is independent of where generation begins',()=>{
 const a=new InfiniteWorld(42),b=new InfiniteWorld(42),origin={...a.origin};
 const near={minX:origin.x-3,minY:origin.y-3,maxX:origin.x+3,maxY:origin.y+3};
 b.ensure({minX:100,minY:-103,maxX:107,maxY:-96});a.ensure(near);b.ensure(near);
 const restored=InfiniteWorld.restore(a.checkpoint());assert.deepEqual(restored.origin,origin);restored.ensure(near);
 assert.deepEqual(a.agents,b.agents);assert.deepEqual(a.agents,restored.agents);
});
