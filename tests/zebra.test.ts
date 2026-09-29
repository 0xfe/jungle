import test from 'node:test';
import assert from 'node:assert/strict';
import {AgentSystem,type AgentEnvironment} from '../src/agents';
import {ZebraAgent,jungleAgents} from '../src/jungle/agents';
import {ECO_SPECS,habitatAllows} from '../src/jungle/ecology';
import {InfiniteWorld} from '../src/jungle/infinite';
const land:AgentEnvironment={time:0,nearby:()=>[],canMove:()=>true,sample:()=>({water:false,moisture:.4,light:1,wind:1,elevation:0})};

test('zebra herds regroup, graze and resume exactly with distance-driven strides',()=>{
 const lead=new ZebraAgent('leader',1.8,0,9),follow=new ZebraAgent('follower',0,0,10);
 for(const a of [lead,follow]){a.groupId='herd';a.leaderId=lead.id;a.timer=0;}
 const herd=[lead,follow],sys=new AgentSystem();sys.step(herd,1/60,land);
 assert.equal(lead.state,'rest');assert.equal(follow.state,'travel');
 let grazed=false;
 for(let i=0;i<3600;i++){sys.step(herd,1/60,land);grazed||=herd.some(a=>a.state==='graze');}
 assert.ok(grazed);assert.ok(Math.hypot(lead.x-follow.x,lead.y-follow.y)<1.5);
 const saved=jungleAgents.decode(jungleAgents.encode(herd));
 for(let i=0;i<900;i++){sys.step(herd,1/60,land);sys.step(saved,1/60,land);}
 assert.deepEqual(jungleAgents.encode(herd),jungleAgents.encode(saved));
 const a=new ZebraAgent('stride',0,0,3);a.state='travel';a.heading=0;a.target={x:1,y:0};a.decision=100;a.timer=30;
 for(let i=0;i<60;i++){const x=a.x,gait=a.gait;a.update(1/60,land);assert.ok(Math.abs((a.gait-gait)*ECO_SPECS.zebra.stride*a.size-(a.x-x))<1e-10);}
 const gait=a.gait;a.update(1/60,{...land,canMove:()=>false});assert.equal(a.gait,gait);assert.equal(a.speed,0);
 assert.equal(habitatAllows('zebra',{...land.sample(0,0),water:true}),false);
 assert.equal(habitatAllows('zebra',{...land.sample(0,0),moisture:.9}),false);
});

test('zebras spawn as small habitat-valid herds at signed coordinates',()=>{
 let count=0;
 for(const x of [-60,60]){
  const w=new InfiniteWorld(2718,'rainforest',undefined,{water:0,animals:5});w.ensure({minX:x,minY:-12,maxX:x+20,maxY:12});
  const zebras=w.agents.filter((a):a is ZebraAgent=>a instanceof ZebraAgent);count+=zebras.length;
  for(const a of zebras){assert.ok(a.groupId);assert.ok(zebras.some(b=>b.id===a.leaderId));assert.ok(zebras.filter(b=>b.groupId===a.groupId).length<=3);}
 }
 assert.ok(count>3);
});
