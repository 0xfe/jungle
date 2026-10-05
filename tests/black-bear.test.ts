import test from 'node:test';
import assert from 'node:assert/strict';
import {AgentSystem,type AgentEnvironment} from '../src/agents';
import {BlackBearAgent,jungleAgents} from '../src/jungle/agents';
import {InfiniteWorld} from '../src/jungle/infinite';
import {BEAR_MOTION,BEAR_MODEL_TO_TILE,bearFoot} from '../src/jungle/bear-motion';
import {blackBearMesh} from '../scripts/art/black-bear-model';
import {bakeMesh} from '../src/iso/bake/rasterize';
import {ECO_SPECS,ecoClips} from '../src/jungle/ecology';
const forest:AgentEnvironment={time:0,nearby:()=>[],canMove:(x,y)=>x>=0&&Math.hypot(x-1,y-1)>.13,
 sample:x=>({water:x<0,moisture:.7,light:.8,wind:1,elevation:0}),perches:()=>[{x:1.17,y:1,height:125,root:{x:1,y:1}}]};

test('black bears turn while planted, walk with calibrated strides, and forage beside vegetation',()=>{
 const a=new BlackBearAgent('bear',.4,1,18);a.state='travel';a.target={x:1.8,y:1};a.heading=Math.PI;a.timer=30;a.decision=10;
 const start=[a.x,a.y,a.gait];for(let i=0;i<20;i++)a.update(1/60,forest);
 assert.deepEqual([a.x,a.y,a.gait],start,'turn before translating');
 a.heading=0;const x=a.x,phase=a.gait;for(let i=0;i<10;i++)a.update(1/60,forest);
 assert.ok(a.x>x);assert.ok(Math.abs((a.gait-phase)*ECO_SPECS.blackBear.stride*a.size-(a.x-x))<1e-10);
 assert.ok(a.speed>.05);
 a.state='rest';a.timer=0;a.decision=0;let foraged=false,walked=false;
 for(let i=0;i<6000;i++){a.update(1/60,forest);const state=a.sample().state;foraged||=state==='forage'||state==='pick';walked||=a.speed>.02;assert.ok(forest.canMove(a.x,a.y));assert.ok(ecoClips('blackBear')[a.state]);if(state==='forage')assert.equal(a.speed,0);}
 assert.ok(foraged&&walked);assert.equal(a.groupId,'');
 const blocked=new BlackBearAgent('blocked',.4,.4,3);blocked.state='travel';blocked.heading=0;blocked.target={x:1,y:.4};blocked.decision=100;blocked.timer=30;
 const gait=blocked.gait;blocked.update(1/60,{...forest,canMove:()=>false});assert.equal(blocked.gait,gait);assert.equal(blocked.x,.4);
});

test('mother bears wait for cubs; cubs follow their parent and all active behavior resumes exactly',()=>{
 const mother=new BlackBearAgent('mother',2,2,9),cub=new BlackBearAgent('cub',.4,2,11);
 for(const a of [mother,cub]){a.groupId='family';a.leaderId='mother';a.territory=[0,0,4,4];a.timer=0;}
 cub.juvenile=true;cub.motherId='mother';cub.size=mother.size*.5;
 mother.state='travel';mother.target={x:3,y:2};mother.heading=0;mother.timer=30;
 const agents=[mother,cub],system=new AgentSystem(),env={...forest,canMove:()=>true};
 system.step(agents,1/60,env);assert.equal(mother.state,'rest');assert.equal(mother.speed,0);assert.equal(cub.state,'run');
 for(let i=0;i<600;i++)system.step(agents,1/60,env);
 assert.ok(Math.hypot(cub.x-mother.x,cub.y-mother.y)<1.1);
 const restored=jungleAgents.decode(jungleAgents.encode(agents)),reverse=jungleAgents.decode(jungleAgents.encode(agents)).reverse();
 for(let i=0;i<1200;i++){system.step(agents,1/60,env);system.step(restored,1/60,env);system.step(reverse,1/60,env);}
 assert.deepEqual(jungleAgents.encode(agents),jungleAgents.encode(restored));
 assert.deepEqual(jungleAgents.encode(agents),jungleAgents.encode(reverse.reverse()));
 mother.state='forage';mother.timer=5;mother.forageTarget=true;mother.gait=.37;
 const saved=jungleAgents.decode(jungleAgents.encode([mother]))[0]!;
 for(let i=0;i<900;i++){mother.update(1/60,env);saved.update(1/60,env);}
 assert.deepEqual(jungleAgents.encode([mother]),jungleAgents.encode([saved]));
});

test('bear generation is mostly solitary, with occasional single-parent families and smaller cubs',()=>{
 let singles=0,families=0,cubs=0;
 for(const seed of [71,2718,2026]){
  const w=new InfiniteWorld(seed,'rainforest',undefined,{water:0,animals:5});w.ensure({minX:40,minY:40,maxX:76,maxY:76});
  const bears=w.agents.filter((a):a is BlackBearAgent=>a instanceof BlackBearAgent);
  for(const a of bears){
   if(!a.groupId){singles++;assert.equal(a.juvenile,false);continue;}
   if(!a.juvenile){families++;assert.equal(a.leaderId,a.id);continue;}
   cubs++;const parent=bears.find(b=>b.id===a.motherId)!;assert.ok(parent&&!parent.juvenile);assert.equal(a.leaderId,parent.id);
   assert.ok(a.size>=parent.size*.43&&a.size<parent.size*.57);
   assert.equal(bears.filter(b=>b.groupId===a.groupId&&!b.juvenile).length,1);
  }
  const copy=InfiniteWorld.restore(w.checkpoint());copy.ensure({minX:40,minY:40,maxX:76,maxY:76});
  for(let i=0;i<40;i++){w.update(1/60);copy.update(1/60);}
  assert.deepEqual(jungleAgents.encode(w.agents),jungleAgents.encode(copy.agents));
 }
 assert.ok(singles>families&&families>2&&cubs>=families);
});

test('bears rise briefly and pick at registered roots with planted feet and exact continuation',()=>{
 const env={...forest,canMove:()=>true,perches:()=>[{x:1.17,y:1,height:100,root:{x:1,y:1}}]};
 const a=new BlackBearAgent('picker',.71,1,27);a.heading=0;a.forageTarget=true;a.treeTarget=true;a.supportX=1;a.supportY=1;a.timer=0;
 a.state='rise';a.treeTarget=true;a.forageTarget=false;
 a.update(1/60,env);assert.equal(a.state,'rise');
 const seen=new Set<string>();
 for(let i=0;i<1000;i++){
  seen.add(a.state);
  if(['rise','stand','pick','lower'].includes(a.state)){
   const b=jungleAgents.decode(jungleAgents.encode([a]))[0]!;
   const x=a.x,y=a.y;a.update(1/60,env);b.update(1/60,env);
   assert.deepEqual(jungleAgents.encode([a]),jungleAgents.encode([b]));assert.equal(a.x,x);assert.equal(a.y,y);assert.equal(a.speed,0);
  }else a.update(1/60,env);
 }
 for(const state of ['rise','stand','pick','lower','rest'])assert.ok(seen.has(state),state);
 a.state='pick';a.treeTarget=true;a.gait=.4;a.update(1/60,{...env,perches:()=>[]});assert.equal(a.state,'lower');
});


test('bears stay quadrupedal, vary trip tempo and direction, and only stand briefly',()=>{
 const seen=new Set<string>(),tempos=new Set<number>(),headings=new Set<number>();let upright=0,ground=0;
 for(const seed of [12,91,207]){
  const a=new BlackBearAgent('walker',0,0,seed),env={...forest,canMove:()=>true,perches:()=>[]};a.timer=0;
  for(let i=0;i<600*60;i++){
   a.update(1/60,env);seen.add(a.state);
   if(['rise','stand','pick','lower'].includes(a.state)){upright++;assert.equal(a.speed,0);}else ground++;
   if(a.speed>.1){assert.ok(a.state==='travel'||a.state==='run');tempos.add(Math.round(a.tripPace*100));headings.add(Math.floor(a.heading/.4));}
  }
 }
 assert.ok(upright>100&&upright/(upright+ground)<.12,`${upright} upright / ${ground} ground steps`);
 assert.ok(tempos.size>12&&headings.size>8);
 for(const state of ['travel','lower','forage','rise','feedDown','feedUp'])assert.ok(seen.has(state),state);
});

test('every bear action and its previous pose resume exactly; runs stop at blocked ground',()=>{
 const env={...forest,canMove:()=>true,perches:()=>[]};
 for(const state of Object.keys(ecoClips('blackBear'))){
  const a=new BlackBearAgent('action',0,0,9);a.state=state as typeof a.state;a.gait=.43;a.timer=2;a.target={x:2,y:0};a.heading=0;a.decision=10;
  for(let i=0;i<13;i++)a.update(1/60,env);
  const b=jungleAgents.decode(jungleAgents.encode([a]))[0]!;
  for(let i=0;i<600;i++){a.update(1/60,env);b.update(1/60,env);}
  assert.deepEqual(jungleAgents.encode([a]),jungleAgents.encode([b]),state);
 }
 const runner=new BlackBearAgent('run',0,0,1);runner.state='run';runner.heading=0;runner.timer=10;runner.decision=10;runner.target={x:2,y:0};
 const x=runner.x,gait=runner.gait;runner.update(1/60,{...env,canMove:()=>false});assert.equal(runner.x,x);assert.equal(runner.gait,gait);assert.equal(runner.speed,0);
});

test('bear walk/run stance cancels world travel and has a lively, body-scaled cadence',()=>{
 for(const running of [false,true]){
  const stride=running?BEAR_MOTION.runStride:BEAR_MOTION.walkStride;
  for(let leg=0;leg<4;leg++)for(let i=0;i<100;i++){
   const p=i/100,a=bearFoot(p,leg,running),b=bearFoot(p+.001,leg,running);
   if(!a.contact||!b.contact||b.fore>a.fore)continue;
   for(const size of [.5,.85,1.15])assert.ok(Math.abs((b.fore-a.fore)*BEAR_MODEL_TO_TILE*size+stride*size*.001)<1e-12);
  }
 }
 assert.ok(BEAR_MOTION.walkSpeed/BEAR_MOTION.walkStride>1.1);
 assert.ok(BEAR_MOTION.runSpeed/BEAR_MOTION.runStride>1.6);
 assert.ok(ecoClips('blackBear').travel!>=32&&ECO_SPECS.blackBear.directions>=16);
});

test('bear posture and feeding transitions join their neighboring poses without popping',()=>{
 const camera={width:112,height:112,anchor:[56,87] as [number,number],scale:BEAR_MOTION.bakeScale};
 for(let d=0;d<16;d++)for(const [a,p,b,q] of [['rise',0,'rest',0],['rise',1,'stand',0],['lower',0,'stand',0],['lower',1,'rest',0],['feedDown',0,'rest',0],['feedDown',1,'forage',0],['feedUp',1,'rest',0]] as const){
  assert.deepEqual(bakeMesh(blackBearMesh(a,p),d*Math.PI/8,camera).data,bakeMesh(blackBearMesh(b,q),d*Math.PI/8,camera).data,`${a}/${b}/${d}`);
 }
});

test('lost support reverses a partial rise, and cub play stays near its mother',()=>{
 const a=new BlackBearAgent('standing',0,0,3);a.state='rise';a.gait=.37;a.treeTarget=true;a.supportX=.3;a.supportY=0;a.decision=10;
 a.update(1/60,{...forest,perches:()=>[]});
 assert.equal(a.state,'lower');assert.ok(Math.abs(a.gait-(1-.37+1/60/BEAR_MOTION.standSeconds))<1e-12);assert.equal(a.speed,0);
 const cub=new BlackBearAgent('cub',.3,0,17);cub.juvenile=true;cub.groupId='family';cub.motherId=cub.leaderId='mother';cub.size=.5;cub.timer=0;cub.runCooldown=0;
 const env={...forest,canMove:()=>true,perches:()=>[],nearby:()=>[{id:'mother',kind:'blackBear',x:0,y:0,groupId:'family',heading:0,speed:0}]};
 let played=false;
 for(let i=0;i<600*60;i++){cub.update(1/60,env);if(cub.state==='play'){played=true;assert.ok(Math.hypot(cub.x,cub.y)<.72);assert.equal(cub.speed,0);}}
 assert.ok(played);
});
