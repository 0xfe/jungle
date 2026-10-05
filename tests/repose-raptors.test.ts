import test from 'node:test';
import assert from 'node:assert/strict';
import { AgentSystem, type AgentEnvironment } from '../src/agents';
import { DeerAgent, ZebraAgent, JaguarAgent, BlackBearAgent, HawkAgent, VultureAgent, SquirrelAgent, ToadAgent, jungleAgents } from '../src/jungle/agents';
import { ecoClips } from '../src/jungle/ecology';
import { populationRange, threatens } from '../src/jungle/encounters';
import { deerMesh } from '../scripts/art/deer-model';
import { wildlifeMesh } from '../scripts/art/wildlife-model';
import { ecologyMesh } from '../scripts/art/ecology-model';
import { bakeMesh } from '../src/iso/bake/rasterize';

const land:AgentEnvironment={time:0,nearby:()=>[],canMove:()=>true,sample:()=>({water:false,moisture:.4,light:1,wind:1,elevation:0})};

test('quiet wildlife including bears settles into ground rest',()=>{
 for(const C of [DeerAgent,ZebraAgent,JaguarAgent,BlackBearAgent]){
  const a=new C('quiet',0,0,12);let rested=false;
  for(let i=0;i<18000;i++){a.update(1/60,land);rested||=a.repose.mode==='lying';}
  assert.ok(rested,C.name);
 }
});

test('resting meshes keep transparent margins in every direction and phase',()=>{
 for(const kind of ['deer','zebra','jaguar','blackBear'] as const)for(const clip of ['lieDown','lying','shift'] as const)for(let d=0;d<8;d++)for(let f=0;f<8;f++){
  const p=f/(clip==='lieDown'?7:8),mesh=kind==='deer'?deerMesh(clip,p):kind==='jaguar'?wildlifeMesh(kind,clip,p):ecologyMesh(kind,clip,p);
  const image=bakeMesh(mesh,d*Math.PI/4,{width:112,height:112,anchor:[56,87],scale:28});
  for(let i=0;i<112;i++)for(const n of [i,111*112+i,i*112,i*112+111])assert.equal(image.data[n*4+3],0,`${kind}/${clip}/${d}/${f}`);
 }
});

test('ground rest plants all four species, shifts pose, rises and resumes exactly',()=>{
 for(const C of [DeerAgent,ZebraAgent,JaguarAgent,BlackBearAgent]){
  const a=new C('rest',0,0,71);a.repose.begin(a.random);a.timer=100;
  for(let i=0;i<100;i++)a.update(1/60,land);
  assert.equal(a.repose.mode,'lying');assert.equal(a.x,0);assert.equal(a.y,0);assert.equal(a.speed,0);
  const b=jungleAgents.decode(jungleAgents.encode([a]))[0]!;
  let shifted=false,rose=false;
  for(let i=0;i<6000;i++){
   a.update(1/60,land);b.update(1/60,land);
   shifted||=String(a.repose.mode)==='shift';rose||=String(a.repose.mode)==='up';
   if(a.repose.active){assert.equal(a.x,0);assert.equal(a.y,0);assert.equal(a.speed,0);}
   if(!a.repose.active)break;
  }
  assert.ok(shifted&&rose,C.name);assert.equal(a.repose.active,false);
  assert.deepEqual(jungleAgents.encode([a]),jungleAgents.encode([b]));
 }
});

test('a nearby hunter wakes a resting zebra and it runs away without entering blocked ground',()=>{
 const zebra=new ZebraAgent('prey',0,0,10);zebra.repose.begin(zebra.random);
 for(let i=0;i<100;i++)zebra.update(1/60,land);
 const env={...land,nearby:()=>[{id:'hunter',kind:'jaguar',x:-.7,y:0,speed:0}],canMove:(x:number,y:number)=>x<2&&Math.abs(y)<1};
 let ran=false;
 for(let i=0;i<500;i++){zebra.update(1/60,env);ran||=zebra.state==='run'&&zebra.speed>.5;assert.ok(env.canMove(zebra.x,zebra.y));}
 assert.ok(ran);assert.ok(zebra.x>.7);assert.equal(zebra.repose.active,false);
 assert.equal(threatens({kind:'jaguar'},'butterfly'),false);
 assert.equal(threatens({kind:'hawk',altitude:100},'squirrel'),false);
 assert.equal(threatens({kind:'hawk',altitude:20},'squirrel'),true);
});

test('complementary predator ranges keep most prey habitat outside hunter territory across signed coordinates',()=>{
 let prey=0,overlap=0,hunters=0;
 for(let y=-150;y<150;y+=2)for(let x=-150;x<150;x+=2){
  const p=populationRange('deer',x,y,2718),h=populationRange('jaguar',x,y,2718);
  prey+=Number(p);hunters+=Number(h);overlap+=Number(p&&h);
 }
 assert.ok(prey>1000&&hunters>1000);assert.ok(overlap/prey<.25);
});

test('raptors stay in bounded ranges and vultures spend most of their time scavenging on the ground',()=>{
 const hawk=new HawkAgent('h',0,0,1),vulture=new VultureAgent('v',0,0,9);
 let ground=0,flown=false,returned=false,maxRange=0;
 for(let i=0;i<24000;i++){
  hawk.update(1/60,land);vulture.update(1/60,land);
  maxRange=Math.max(maxRange,Math.hypot(hawk.x-hawk.homeX,hawk.y-hawk.homeY));
  if(vulture.state==='forage'){ground++;if(flown)returned=true;assert.equal(vulture.altitude,0);}
  flown||=vulture.altitude>20;
 }
 assert.ok(maxRange<4);assert.ok(flown&&returned);assert.ok(ground/24000>.55,`ground fraction ${ground/24000}`);
});

test('a hawk misses a fixed intercept, alarms a squirrel and resumes exact checkpoint continuation',()=>{
 const hawk=new HawkAgent('h',0,0,4),squirrel=new SquirrelAgent('s',.8,0,7),sys=new AgentSystem();
 hawk.state='dive';hawk.routeX=0;hawk.routeY=0;hawk.routeHeight=105;hawk.target={x:1.3,y:0};hawk.action=0;
 squirrel.timer=100;squirrel.state='rest';
 for(let i=0;i<100;i++)sys.step([hawk,squirrel],1/60,land);
 assert.ok(squirrel.startle.remaining>0);assert.ok(squirrel.target.x>.8);
 const restored=jungleAgents.decode(jungleAgents.encode([hawk,squirrel]));
 for(let i=0;i<600;i++){sys.step([hawk,squirrel],1/60,land);sys.step(restored,1/60,land);}
 assert.equal(hawk.state,'travel');assert.ok(hawk.cooldown>0);assert.ok(squirrel.x>.8);
 assert.deepEqual(jungleAgents.encode([hawk,squirrel]),jungleAgents.encode(restored));
});

test('toads escape a low hawk by hopping, while climbing squirrels keep their support',()=>{
 const env={...land,sample:()=>({...land.sample(0,0),bank:true}),nearby:()=>[{id:'h',kind:'hawk',x:-.6,y:0,speed:.5,altitude:20}]};
 const toad=new ToadAgent('t',0,0,5);toad.timer=100;let hopped=false;
 for(let i=0;i<120;i++){toad.update(1/60,env);assert.ok(ecoClips('toad')[toad.state]);hopped||=toad.altitude>1;}
 assert.ok(hopped&&toad.x>.1);
 const squirrel=new SquirrelAgent('s',0,0,8);squirrel.state='climb';squirrel.altitude=3;squirrel.targetAltitude=25;
 squirrel.update(1/60,{...env,perches:()=>[{x:0,y:0,height:45}]});assert.equal(squirrel.state,'climb');assert.equal(squirrel.startle.remaining,0);
 squirrel.update(1/60,{...env,perches:()=>[]});assert.equal(squirrel.state,'descend');
});
