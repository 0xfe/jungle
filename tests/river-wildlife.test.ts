import test from 'node:test';
import assert from 'node:assert/strict';
import { AgentSystem, type AgentEnvironment } from '../src/agents';
import { SquirrelAgent, BoarAgent, BeaverAgent, CrocodileAgent, ToadAgent, DeerAgent, jungleAgents } from '../src/jungle/agents';
import { ecoClips } from '../src/jungle/ecology';
const bank:AgentEnvironment={time:0,nearby:()=>[],canMove:x=>x>=0,
  sample:(x)=>({water:x<0,bank:x>=0&&x<1.5,beach:x>=0&&x<.2,depth:x<0?.25:0,elevation:0,moisture:.6,light:.8,wind:1}),
  perches:()=>[{x:.3,y:0,height:48}]};

test('a solitary squirrel approaches a real support, climbs and descends, then keeps a cooldown',()=>{
  const a=new SquirrelAgent('s',.3,0,4);a.timer=0;
  assert.equal(a.tryClimb({...bank,perches:()=>[]}),false);
  assert.equal(a.tryClimb(bank),true);let peak=0,up=false,down=false;
  for(let i=0;i<4200;i++){a.update(1/60,bank);peak=Math.max(peak,a.altitude);up||=a.state==='climb';down||=a.state==='descend';if(a.altitude>0)assert.ok(Math.hypot(a.x-.3,a.y)<.03);if(down&&a.altitude===0)break;}
  assert.ok(peak>20&&up&&down);assert.equal(a.altitude,0);assert.ok(a.cooldown>=30);assert.equal(a.groupId,'');
});

test('boar dashes are brief, stop short and trigger independently perceived deer escape',()=>{
  const e={...bank,canMove:()=>true,sample:()=>({...bank.sample(1,0),water:false}),nearby:(x:number,y:number,r:number)=>Math.hypot(x-1.5,y)<=r?[{id:'d',kind:'deer',x:1.5,y:0,speed:0}]:[]};
  const a=new BoarAgent('b',0,0,1);a.timer=0;a.heading=0;let ran=false,peak=0;
  for(let i=0;i<600;i++){a.update(1/60,e);ran||=a.state==='run';peak=Math.max(peak,a.speed);if(ran&&a.state==='rest')break;}
  assert.ok(ran&&peak>.3);assert.ok(a.x<=1.01);assert.ok(a.cooldown>20);
  const deer=new DeerAgent('d',1.5,0,9);const sys=new AgentSystem();
  // A real pre-update snapshot is used, never a direct mutation from the boar.
  a.x=.5;a.timer=100;a.state='rest';
  for(let i=0;i<120;i++)sys.step([deer,a],1/60,e);
  assert.ok(deer.fear>.5);assert.equal(deer.locomotion,'run');
});

test('bank animals enter and leave water, toads hop, and interrupted state resumes exactly',()=>{
  for(const C of [BeaverAgent,CrocodileAgent,ToadAgent]){
    const a=new C('r',.15,0,71);a.timer=0;let wet=false,dry=false,air=false;
    for(let i=0;i<15000;i++){a.update(1/60,bank);wet||=a.x<0;dry||=wet&&a.x>=0;air||=a.altitude>1;assert.ok(a.x<1.5);}
    assert.ok(wet&&dry,C.name);if(a.kind==='toad')assert.ok(air);
    const b=jungleAgents.decode(jungleAgents.encode([a]))[0]!;
    for(let i=0;i<700;i++){a.update(1/60,bank);b.update(1/60,bank);}
    assert.deepEqual(jungleAgents.encode([a]),jungleAgents.encode([b]));
  }
});

test('climbing, descending, charging and airborne hops preserve active routes through codecs',()=>{
  for(const [C,state,altitude] of [[SquirrelAgent,'climb',12],[SquirrelAgent,'descend',12],[BoarAgent,'run',0],[ToadAgent,'hop',4]] as const){
    const a=new C('saved',.3,0,18);a.state=state;a.altitude=altitude;a.timer=2;a.decision=1;
    a.target={x:.6,y:0};a.routeX=.3;a.routeY=0;a.routeProgress=.4;a.routeDuration=.6;a.targetAltitude=state==='climb'?26:0;
    const b=jungleAgents.decode(jungleAgents.encode([a]))[0]!;
    for(let i=0;i<600;i++){a.update(1/60,bank);b.update(1/60,bank);}
    assert.deepEqual(jungleAgents.encode([a]),jungleAgents.encode([b]),state);
  }
});

test('elephant splashes select supported poses for every new species, with toads hopping rather than walking',()=>{
  const env:AgentEnvironment={...bank,nearby:()=>[{id:'elephant',kind:'elephant',x:.1,y:0,speed:0,stimulus:{kind:'splash',x:.3,y:0,radius:2}}]};
  for(const C of [SquirrelAgent,BoarAgent,BeaverAgent,CrocodileAgent,ToadAgent]){
    const a=new C('recipient',.3,0,8);a.timer=100;
    for(let i=0;i<300;i++){a.update(1/60,env);assert.ok(ecoClips(a.kind)[a.state],`${a.kind}/${a.state}`);}
  }
  const toad=new ToadAgent('hop',.3,0,8);toad.update(1/60,env);assert.equal(toad.state,'hop');
});
