import test from 'node:test';
import assert from 'node:assert/strict';
import { type AgentEnvironment } from '../src/agents';
import { BisonAgent,ZebraAgent,HippoAgent,TigerAgent,MacawAgent,ParakeetAgent,SeagullAgent,ToucanAgent,jungleAgents } from '../src/jungle/agents';
import { ecologyMesh } from '../scripts/art/ecology-model';
import { wildlifeMesh } from '../scripts/art/wildlife-model';
import { bakeMesh } from '../src/iso/bake/rasterize';
import { ECO_SPECS } from '../src/jungle/ecology';
const land:AgentEnvironment={time:0,canMove:()=>true,nearby:()=>[],sample:()=>({water:false,bank:true,beach:true,moisture:.4,depth:.2,elevation:0,wind:1,light:1}),perches:()=>[{x:0,y:0,height:45},{x:1,y:0,height:50}]};

test('large grazers lower and raise their heads while planted and resume every transition',()=>{
 for(const C of [BisonAgent,ZebraAgent,HippoAgent]){
  const a=new C('grazer',0,0,17);a.timer=0;const seen=new Set<string>();
  for(let i=0;i<90*60;i++){a.update(1/60,land);seen.add(a.state);if(['feedDown','graze','feedUp'].includes(a.state))assert.equal(a.speed,0);}
  for(const state of ['feedDown','graze','feedUp'])assert.ok(seen.has(state),`${a.kind}/${state}`);
  for(const state of ['feedDown','feedUp'] as const){
   a.state=state;a.gait=.41;a.timer=3;const b=jungleAgents.decode(jungleAgents.encode([a]))[0]!;
   for(let i=0;i<180;i++){a.update(1/60,land);b.update(1/60,land);}assert.deepEqual(jungleAgents.encode([a]),jungleAgents.encode([b]));
  }
 }
});

test('hippo immersion and emergence use bounded planted transitions with exact continuation',()=>{
 const a=new HippoAgent('hippo',0,0,23);a.decision=10;
 const water={...land,sample:()=>({...land.sample(0,0),water:true})};
 a.update(1/60,water);assert.equal(a.state,'enterWater');assert.ok(a.gait>0&&a.gait<.02);
 const copy=jungleAgents.decode(jungleAgents.encode([a]))[0]!;
 for(let i=0;i<80;i++){a.update(1/60,water);copy.update(1/60,water);assert.equal(a.speed,0);assert.equal(a.x,0);}
 assert.deepEqual(jungleAgents.encode([a]),jungleAgents.encode([copy]));assert.equal(a.submerged,true);
 a.update(1/60,land);assert.equal(a.state,'leaveWater');
 for(let i=0;i<80;i++)a.update(1/60,land);assert.equal(a.submerged,false);
});

test('tigers crouch before stalking and raise the body before pursuit',()=>{
 const env={...land,nearby:()=>[{id:'prey',kind:'deer',x:1.2,y:0,speed:0}]};
 let started=false;
 for(let seed=1;seed<30;seed++){
  const a=new TigerAgent('tiger',0,0,seed);a.timer=0;a.cooldown=0;
  a.update(1/60,env);if(a.state!=='crouch')continue;started=true;
  const seen=new Set<string>();for(let i=0;i<180;i++){seen.add(a.state);a.update(1/60,env);if(['crouch','uncrouch'].includes(a.state))assert.equal(a.speed,0);}
  for(const state of ['stalk','uncrouch','chase'])assert.ok(seen.has(state),state);break;
 }
 assert.ok(started);
});

test('bird takeoff and landing preserve real destination height and serializable posture',()=>{
 for(const C of [MacawAgent,ParakeetAgent,SeagullAgent,ToucanAgent]){
  const a=new C('bird',0,0,29);a.altitude=a.targetAltitude=C===SeagullAgent?0:45;a.timer=0;
  // A retained flight destination makes this a deterministic landing fixture.
  a.state='land';a.gait=.2;a.target={x:0,y:0};a.targetAltitude=C===SeagullAgent?0:45;
  if('routeHeight' in a)a.routeHeight=a.altitude+3;else a.flightOrigin=a.altitude+3;
  const b=jungleAgents.decode(jungleAgents.encode([a]))[0]!;
  for(let i=0;i<50;i++){a.update(1/60,land);b.update(1/60,land);assert.equal(a.x,0);}
  assert.equal(a.state,'rest');assert.equal(a.altitude,a.targetAltitude);assert.deepEqual(jungleAgents.encode([a]),jungleAgents.encode([b]));
 }
});

test('feeding and wing-fold endpoints have identical registered pixels at every direction',()=>{
 for(const kind of ['bison','hippo','zebra','seagull','macaw','parakeet','kingfisher'] as const){
  const spec=ECO_SPECS[kind],camera={width:112,height:112,anchor:[56,87] as [number,number],scale:spec.cameraScale};
  const pairs=spec.mode==='air'?[['takeoff',0,'rest',0],['takeoff',1,'travel',0],['land',0,'travel',0],['land',1,'rest',0]] as const:[['feedDown',0,'rest',0],['feedDown',1,'graze',0],['feedUp',0,'graze',0],['feedUp',1,'rest',0]] as const;
  for(let d=0;d<spec.directions;d++)for(const [a,p,b,q] of pairs)assert.deepEqual(bakeMesh(ecologyMesh(kind,a,p),d/spec.directions*Math.PI*2,camera).data,bakeMesh(ecologyMesh(kind,b,q),d/spec.directions*Math.PI*2,camera).data,`${kind}/${a}/${b}/${d}`);
 }
 const camera={width:112,height:112,anchor:[56,87] as [number,number],scale:28};
 for(let d=0;d<16;d++)for(const [a,p,b,q] of [['takeoff',0,'rest',0],['takeoff',1,'travel',0],['land',1,'rest',0]] as const)assert.deepEqual(bakeMesh(wildlifeMesh('toucan',a,p),d*Math.PI/8,camera).data,bakeMesh(wildlifeMesh('toucan',b,q),d*Math.PI/8,camera).data,`toucan/${a}/${b}/${d}`);
});


test('tiger crouches and hippo immersion join registered endpoint poses in every direction',()=>{
 for(const kind of ['tiger','hippo'] as const){
  const spec=ECO_SPECS[kind],camera={width:112,height:112,anchor:[56,87] as [number,number],scale:spec.cameraScale};
  const pairs=kind==='tiger'?[['crouch',0,'rest',0],['crouch',1,'stalk',0],['uncrouch',1,'rest',0]] as const:[['enterWater',0,'rest',0],['enterWater',1,'wallow',0],['leaveWater',1,'rest',0]] as const;
  for(let form=0;form<(kind==='hippo'?2:1);form++)for(let d=0;d<spec.directions;d++)for(const [a,p,b,q] of pairs)assert.deepEqual(bakeMesh(ecologyMesh(kind,a,p,form),d/spec.directions*Math.PI*2,camera).data,bakeMesh(ecologyMesh(kind,b,q,form),d/spec.directions*Math.PI*2,camera).data,`${kind}/${a}/${b}/${d}/${form}`);
 }
});
