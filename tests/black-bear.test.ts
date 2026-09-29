import test from 'node:test';
import assert from 'node:assert/strict';
import {AgentSystem,type AgentEnvironment} from '../src/agents';
import {BlackBearAgent,jungleAgents} from '../src/jungle/agents';
import {InfiniteWorld} from '../src/jungle/infinite';
import {ECO_SPECS,ecoClips} from '../src/jungle/ecology';
const forest:AgentEnvironment={time:0,nearby:()=>[],canMove:(x,y)=>x>=0&&Math.hypot(x-1,y-1)>.13,
 sample:x=>({water:x<0,moisture:.7,light:.8,wind:1,elevation:0}),perches:()=>[{x:1.17,y:1,height:125,root:{x:1,y:1}}]};

test('black bears turn while planted, walk with calibrated strides, and forage beside vegetation',()=>{
 const a=new BlackBearAgent('bear',.4,1,18);a.state='travel';a.target={x:1.8,y:1};a.heading=Math.PI;a.timer=30;a.decision=10;
 const start=[a.x,a.y,a.gait];for(let i=0;i<20;i++)a.update(1/60,forest);
 assert.deepEqual([a.x,a.y,a.gait],start,'turn before translating');
 a.heading=0;const x=a.x,phase=a.gait;for(let i=0;i<10;i++)a.update(1/60,forest);
 assert.ok(a.x>x);assert.ok(Math.abs((a.gait-phase)*ECO_SPECS.blackBear.stride*a.size-(a.x-x))<1e-10);
 assert.ok(Math.abs(.52/.68*23*ECO_SPECS.blackBear.displayScale*Math.SQRT1_2/96-ECO_SPECS.blackBear.stride)<.001);
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
 system.step(agents,1/60,env);assert.equal(mother.state,'rest');assert.equal(mother.speed,0);assert.equal(cub.state,'travel');
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

test('bears raise, stand and pick at registered roots with planted feet and exact continuation',()=>{
 const env={...forest,canMove:()=>true,perches:()=>[{x:1.17,y:1,height:100,root:{x:1,y:1}}]};
 const a=new BlackBearAgent('picker',.71,1,27);a.heading=0;a.forageTarget=true;a.treeTarget=true;a.supportX=1;a.supportY=1;a.timer=0;
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
 a.state='pick';a.gait=.4;a.update(1/60,{...env,perches:()=>[]});assert.equal(a.state,'lower');
});
