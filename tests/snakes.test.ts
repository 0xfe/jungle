import test from 'node:test';
import assert from 'node:assert/strict';
import { AgentSystem, type AgentEnvironment } from '../src/agents';
import { BoaAgent, SmallSnakeAgent, PlantAgent, LandscapePatchAgent, jungleAgents } from '../src/jungle/agents';
import { InfiniteWorld } from '../src/jungle/infinite';
import { SNAKE_MODEL_TO_TILE, SNAKE_SUPPORT_OFFSET } from '../src/jungle/snake-pose';

const env:AgentEnvironment={time:0,nearby:()=>[],canMove:(x,y)=>Math.hypot(x,y)>.13,
  sample:()=>({water:false,moisture:.6,elevation:0,light:.8,wind:1}),perches:()=>[{x:.17,y:0,height:60}]};

test('boas approach an actual tree, wrap, reside, unwrap and resume exactly from every action',()=>{
  const a=new BoaAgent('boa',.6,0,7);a.timer=0;
  const seen=new Set<string>();let coiled=0;
  for(let i=0;i<15000;i++){
    a.update(1/60,env);
    if(['wrap','coil','unwrap'].includes(a.state)){
      assert.equal(a.hasSupport,true);
      assert.ok(Math.abs(Math.hypot(a.x-a.supportX,a.y-a.supportY)-SNAKE_SUPPORT_OFFSET*SNAKE_MODEL_TO_TILE*a.size)<1e-9);
      assert.equal(a.speed,0);
      if(a.state==='coil')coiled++;
      const state=a.state;
      if(!seen.has(state)){
        const b=jungleAgents.decode(jungleAgents.encode([a]))[0] as BoaAgent;
        for(let k=0;k<120;k++){a.update(1/60,env);b.update(1/60,env);}
        assert.deepEqual(jungleAgents.encode([a]),jungleAgents.encode([b]));
      }
      seen.add(state);
    }
    if(seen.has('unwrap')&&a.state==='rest')break;
  }
  assert.deepEqual([...seen],['wrap','coil','unwrap']);assert.ok(coiled>1200);assert.equal(a.hasSupport,false);
  const unsupported=new BoaAgent('alone',.6,0,7);unsupported.timer=0;
  for(let i=0;i<6000;i++){unsupported.update(1/60,{...env,perches:()=>[]});assert.ok(!['wrap','coil','unwrap'].includes(unsupported.state));}
});

test('snake turn and blocked travel stay planted; traveling waves follow distance and body scale',()=>{
  for(const C of [BoaAgent,SmallSnakeAgent]){
    const a=new C('s',1,1,12);a.state='travel';a.target={x:2,y:1};a.timer=30;a.heading=Math.PI/2;a.decision=100;
    const gait=a.gait;a.update(1/60,env);assert.equal(a.x,1);assert.equal(a.y,1);assert.equal(a.gait,gait);
    a.heading=0;let distance=0;
    for(let i=0;i<120;i++){const x=a.x,y=a.y;a.update(1/60,env);distance+=Math.hypot(a.x-x,a.y-y);}
    assert.ok(distance>0);assert.ok(Math.abs(a.gait-gait-distance/(a.spec.stride*a.size))<1e-10);
    const x=a.x,y=a.y,phase=a.gait;a.update(1/60,{...env,canMove:()=>false});
    assert.equal(a.x,x);assert.equal(a.y,y);assert.equal(a.gait,phase);assert.equal(a.speed,0);
  }
});

test('small snakes keep loose groups with independent size and phase; dry habitat is respected',()=>{
  const snakes=Array.from({length:5},(_,i)=>{const a=new SmallSnakeAgent(`s${i}`,.5+i*.1,1,100+i);a.groupId='snakes';a.leaderId='s0';a.timer=0;return a;});
  const system=new AgentSystem(),land={...env,canMove:(x:number)=>x>0,sample:(x:number)=>({...env.sample(0,0),water:x<=0}),perches:()=>[]};
  for(let i=0;i<6000;i++)system.step(snakes,1/60,land);
  const center={x:snakes.reduce((s,a)=>s+a.x,0)/5,y:snakes.reduce((s,a)=>s+a.y,0)/5};
  for(const a of snakes){assert.ok(a.x>0);assert.ok(Math.hypot(a.x-center.x,a.y-center.y)<1.5);}
  assert.ok(new Set(snakes.map(a=>a.size)).size===5);assert.ok(new Set(snakes.map(a=>a.gait)).size===5);
  const restored=jungleAgents.decode(jungleAgents.encode(snakes));
  for(let i=0;i<500;i++){system.step(snakes,1/60,land);system.step(restored,1/60,land);}
  assert.deepEqual(jungleAgents.encode(snakes),jungleAgents.encode(restored));
});

test('generated boas are solitary and tree-associated; small snakes arrive as varied groups',()=>{
  const empty=new InfiniteWorld(2718,'rainforest',undefined,{plants:0});
  assert.deepEqual(empty.wildlifeLandmark('boa',-3,4),{x:-3,y:4});assert.equal(empty.generated,0);
  const world=new InfiniteWorld(2718);
  for(const kind of ['boa','smallSnake'] as const){
    const p=world.wildlifeLandmark(kind);world.ensure({minX:p.x-3,minY:p.y-3,maxX:p.x+3,maxY:p.y+3});
    for(const chunk of world.active.values()){
      const boas=chunk.agents.filter(a=>a instanceof BoaAgent);assert.ok(boas.length<=1);
      if(boas.length){assert.ok(chunk.agents.some(a=>a instanceof LandscapePatchAgent&&a.supports.length>0));assert.equal(boas[0]!.groupId,'');}
      const small=chunk.agents.filter(a=>a instanceof SmallSnakeAgent);
      if(small.length){assert.ok(small.length>=3&&small.length<=5);assert.ok(small.every(a=>a.groupId===small[0]!.groupId));}
    }
  }
});
