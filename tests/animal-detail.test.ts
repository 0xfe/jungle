import test from 'node:test';
import assert from 'node:assert/strict';
import { type AgentEnvironment } from '../src/agents';
import { ElephantAgent,WolfAgent,TigerAgent,MonkeyAgent,SquirrelAgent,BeaverAgent,CrocodileAgent,ToadAgent,BoaAgent,SmallSnakeAgent,MacawAgent,ParakeetAgent,FishAgent,ToucanAgent,OrangutanAgent,JaguarAgent,jungleAgents } from '../src/jungle/agents';
import { ecologyMesh } from '../scripts/art/ecology-model';
import { wildlifeMesh } from '../scripts/art/wildlife-model';
import { bakeMesh } from '../src/iso/bake/rasterize';
import { ECO_SPECS,type EcoKind } from '../src/jungle/ecology';
const land:AgentEnvironment={time:0,canMove:()=>true,nearby:()=>[],sample:()=>({water:false,bank:true,beach:true,moisture:.5,depth:.2,elevation:0,wind:1,light:1}),perches:()=>[{x:.25,y:0,height:45,root:{x:.25,y:0}}]};
const cases=[ [ElephantAgent,['feed']], [WolfAgent,['sniff','groom','play']], [TigerAgent,['groom']], [MonkeyAgent,['feed','groom','play']], [SquirrelAgent,['feed','groom']], [BeaverAgent,['groom']], [CrocodileAgent,['bask','alert']], [ToadAgent,['feed']], [BoaAgent,['investigate']], [SmallSnakeAgent,['investigate']], [MacawAgent,['feed','preen']], [ParakeetAgent,['feed','preen']], [FishAgent,['feed']], [ToucanAgent,['feed','preen']], [OrangutanAgent,['feed','groom']], [JaguarAgent,['feed','groom']] ] as const;

test('all new planted activities finish, keep roots fixed and continue exactly from mid-action',()=>{
 for(const [C,actions] of cases)for(const state of actions){
  const a=new C('activity',0,0,17);a.state=state;a.gait=.37;a.activityDuration=4;a.decision=100;a.timer=100;
  const b=jungleAgents.decode(jungleAgents.encode([a]))[0]!;
  for(let i=0;i<170;i++){a.update(1/60,land);b.update(1/60,land);assert.equal(a.x,0);assert.equal(a.y,0);}
  assert.equal(a.state,'rest',`${a.kind}/${state}`);assert.deepEqual(jungleAgents.encode([a]),jungleAgents.encode([b]));
 }
});

test('planted action sheets return to their registered rest pose at both endpoints',()=>{
 for(const [C,actions] of cases){
  const kind=new C('',0,0,1).kind,spec=ECO_SPECS[kind as EcoKind];
  for(const clip of actions)for(const p of [0,1])for(const heading of [0,Math.PI*.625,Math.PI*1.4]){
   const mesh=(action:string,phase:number)=>spec?ecologyMesh(kind as EcoKind,action,phase):wildlifeMesh(kind as 'toucan',action as 'feed',phase);
   const camera={width:144,height:144,anchor:[72,112] as [number,number],scale:spec?.cameraScale??28};
   assert.deepEqual(bakeMesh(mesh(clip,p),heading,camera).data,bakeMesh(mesh('rest',0),heading,camera).data,`${kind}/${clip}/${p}`);
  }
 }
});

test('elephant mothers wait during water trips and browsing requires real foliage',()=>{
 const a=new ElephantAgent('mother',0,0,18);a.state='travel';a.timer=20;a.groupId='family';a.target={x:2,y:0};
 const calf={id:'calf',kind:'elephant',x:-2,y:0,speed:.1,groupId:'family',juvenile:true};
 a.update(1/60,{...land,nearby:()=>[calf]});assert.equal(a.speed,0);assert.equal(a.state,'rest');assert.equal(a.target.x,2);
 const hungry=new ElephantAgent('browser',0,0,3);hungry.thirst=.1;hungry.timer=0;let fed=false;
 for(let i=0;i<60*80;i++){hungry.update(1/60,land);fed||=hungry.state==='feed';}assert.ok(fed);
 const dry=new ElephantAgent('no-foliage',0,0,3);dry.thirst=.1;dry.timer=0;
 for(let i=0;i<60*30;i++){dry.update(1/60,{...land,perches:()=>[]});assert.notEqual(dry.state,'feed');}
});

test('fish steer toward moving school leads, separate and own their non-contact escape',()=>{
 const water={...land,sample:()=>({...land.sample(0,0),water:true,depth:.8})},a=new FishAgent('fish',0,0,7);a.groupId='school';a.leaderId='lead';a.heading=0;
 const lead={id:'lead',kind:'fish',x:.7,y:.1,speed:.2,heading:.5,groupId:'school'};
 a.update(1/60,{...water,nearby:()=>[lead]});assert.ok(a.target.x>.7&&a.target.y>.1);
 a.decision=0;a.update(1/60,{...water,nearby:()=>[{id:'bird',kind:'kingfisher',x:.2,y:0,speed:.7,altitude:2}]});
 assert.ok(a.alarm>0);assert.ok(a.target.x<a.x);assert.ok(a.tripPace>1.5);
});

test('orangutans transfer along the retained tree branch and reverse it before descending',()=>{
 const env={...land,perches:()=>[{x:.17,y:0,height:45,root:{x:0,y:0}}]};
 const a=new OrangutanAgent('branch',-.08,0,7);a.state='climb';a.heading=0;a.targetAltitude=45-.97*28*Math.sqrt(.75)*a.size;a.decision=100;
 for(let i=0;i<150;i++)a.update(1/60,env);
 const b=jungleAgents.decode(jungleAgents.encode([a]))[0] as OrangutanAgent;
 for(let i=0;i<600;i++){a.update(1/60,env);b.update(1/60,env);assert.ok(a.x>=-.08001&&a.x<=.09001);}
 assert.equal(a.state,'rest');assert.ok(a.x>.08);assert.deepEqual(jungleAgents.encode([a]),jungleAgents.encode([b]));
 a.state='climb';a.targetAltitude=0;a.decision=100;
 for(let i=0;i<900;i++)a.update(1/60,env);
 assert.equal(a.altitude,0);assert.ok(Math.abs(a.x+.08)<.006);assert.equal(a.state,'rest');
});
