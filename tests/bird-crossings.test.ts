import test from 'node:test';
import assert from 'node:assert/strict';
import {AgentRandom,type AgentEnvironment} from '../src/agents';
import {crossingPerch} from '../src/jungle/flight';
import {ToucanAgent,MacawAgent,ParakeetAgent,KingfisherAgent,jungleAgents} from '../src/jungle/agents';

function river(offset:number):AgentEnvironment {
 return {time:0,nearby:()=>[],canMove:()=>false,
  sample:(x)=>({water:x>offset+.4&&x<offset+2.6,moisture:.6,light:1,wind:1,elevation:0}),
  perches:(x,y,r)=>[{x:offset,y:0,height:55},{x:offset+3.5,y:0,height:62},{x:offset+1.5,y:0,height:60}].filter(p=>Math.hypot(p.x-x,p.y-y)<=r)};
}

test('occasional crossing searches choose dry opposite-bank perches at positive and negative coordinates',()=>{
 for(const offset of [0,-18]){
  const env=river(offset);let chosen=0;
  for(let seed=0;seed<200;seed++){
   const p=crossingPerch(offset,0,env,new AgentRandom(seed),(x,y)=>x>=offset-1&&x<=offset+4&&Math.abs(y)<2);
   if(p){chosen++;assert.equal(p.x,offset+3.5);}
  }
  assert.ok(chosen>15&&chosen<65,`occasional trips: ${chosen}/200`);
  for(let seed=0;seed<30;seed++)assert.equal(crossingPerch(offset,0,env,new AgentRandom(seed),()=>false),undefined);
 }
});

test('canopy birds fly across water to real perches and resume their flight exactly',()=>{
 for(const C of [ToucanAgent,MacawAgent,ParakeetAgent,KingfisherAgent])for(const offset of [0,-18]){
  const env=river(offset);let bird:InstanceType<typeof C>|undefined;
  for(let seed=0;seed<100&&!bird;seed++){
   const a=new C('bird',offset,0,seed);a.territory=[offset-.5,-1,offset+4,1];a.altitude=a.targetAltitude=55;a.timer=0;
   a.update(1/60,env);if(a.target.x===offset+3.5)bird=a;
  }
  assert.ok(bird,C.name);
  let aboveWater=false;
  for(let i=0;i<200;i++){bird.update(1/60,env);aboveWater||=env.sample(bird.x,bird.y).water;assert.ok(bird.altitude>40);}
  const copy=jungleAgents.decode(jungleAgents.encode([bird]))[0]!;
  let landed=false;
  for(let i=0;i<1200;i++){
   bird.update(1/60,env);copy.update(1/60,env);aboveWater||=env.sample(bird.x,bird.y).water;
   if(bird.state==='rest'){assert.equal(env.sample(bird.x,bird.y).water,false);assert.ok(Math.abs(bird.x-offset-3.5)<.03);landed=true;break;}
  }
  assert.ok(aboveWater&&landed,C.name);assert.deepEqual(jungleAgents.encode([bird]),jungleAgents.encode([copy]));
 }
});
