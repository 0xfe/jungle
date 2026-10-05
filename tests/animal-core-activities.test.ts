import test from 'node:test';
import assert from 'node:assert/strict';
import { type AgentEnvironment } from '../src/agents';
import { GiraffeAgent,BoarAgent,BeaverAgent,KingfisherAgent,SeagullAgent,jungleAgents } from '../src/jungle/agents';
import { ecologyMesh } from '../scripts/art/ecology-model';
import { bakeMesh } from '../src/iso/bake/rasterize';
import { ECO_SPECS } from '../src/jungle/ecology';

const land:AgentEnvironment={time:0,canMove:()=>true,nearby:()=>[],sample:()=>({water:false,bank:true,beach:true,moisture:.4,light:.8,wind:1,elevation:0}),perches:()=>[{x:.5,y:0,height:50,root:{x:.5,y:0}}]};

test('browsing, rooting and gnawing use planted feeding transitions and resume every action',()=>{
 for(const C of [GiraffeAgent,BoarAgent,BeaverAgent]){
  let a=new C('forager',0,0,17);a.timer=0;a.territory=[-2,-2,2,2];const seen=new Set<string>();
  for(let i=0;i<240*60;i++){
   const x=a.x,y=a.y;a.update(1/60,land);
   if(!seen.has(a.state)){
    seen.add(a.state);const b=jungleAgents.decode(jungleAgents.encode([a]))[0]!;
    const original=jungleAgents.encode([a]);
    for(let j=0;j<120;j++){b.update(1/60,land);a.update(1/60,land);}
    assert.deepEqual(jungleAgents.encode([a]),jungleAgents.encode([b]));
    // Continue occupancy checks from the saved state without skipping a transition.
    a=jungleAgents.decode(original)[0] as typeof a;
   }
   if(['feedDown','forage','feedUp'].includes(a.previous.state)&&['feedDown','forage','feedUp'].includes(a.state)){
    assert.equal(a.x,x);assert.equal(a.y,y);assert.equal(a.speed,0);
   }
  }
  for(const state of ['travel','feedDown','forage','feedUp'])assert.ok(seen.has(state),`${a.kind}: ${state}`);
 }
});

test('giraffes require foliage and beavers require a dry bank support for feeding',()=>{
 for(const C of [GiraffeAgent,BeaverAgent]){
  const a=new C('no-tree',0,0,11);a.timer=0;
  for(let i=0;i<90*60;i++){a.update(1/60,{...land,perches:()=>[]});assert.notEqual(a.state,'forage');}
 }
 const mother={id:'mother',kind:'giraffe',x:1.8,y:0,speed:.3,groupId:'family',heading:0};
 const cub=new GiraffeAgent('cub',0,0,14);cub.juvenile=true;cub.groupId='family';cub.motherId=cub.leaderId='mother';cub.timer=0;
 cub.update(1/60,{...land,nearby:()=>[mother]});assert.equal(cub.state,'run');
});

test('kingfishers dive into real water and return to their retained perch with exact continuation',()=>{
 const env={...land,perches:()=>[{x:0,y:0,height:42}],sample:(x:number)=>({...land.sample(x,0),water:x>.25,depth:.3})};
 const a=new KingfisherAgent('fisher',0,0,19);a.altitude=42;a.timer=0;let lowest=42,sawDive=false;
 for(let i=0;i<6*60;i++){
  a.update(1/60,env);lowest=Math.min(lowest,a.altitude);
  if(a.state==='dive'&&!sawDive){sawDive=true;const b=jungleAgents.decode(jungleAgents.encode([a]))[0]!;
   for(let j=0;j<120;j++){a.update(1/60,env);b.update(1/60,env);lowest=Math.min(lowest,a.altitude);}
   assert.deepEqual(jungleAgents.encode([a]),jungleAgents.encode([b]));
  }
 }
 assert.ok(sawDive&&lowest<3);assert.equal(a.state,'rest');assert.equal(a.x,0);assert.equal(a.y,0);assert.equal(a.altitude,42);assert.ok(a.cooldown>0);
 const dry=new KingfisherAgent('dry',0,0,19);dry.altitude=42;dry.timer=0;
 for(let i=0;i<600;i++){dry.update(1/60,land);assert.notEqual(dry.state,'dive');}
});

test('gulls walk with folded wings on dry shoreline and peck independently',()=>{
 const env={...land,perches:()=>[],sample:(x:number)=>({...land.sample(x,0),water:x>.8})};
 const a=new SeagullAgent('shore',0,0,32);a.timer=0;a.territory=[-2,-2,2,2];const seen=new Set<string>();
 for(let i=0;i<240*60;i++){
  a.update(1/60,env);seen.add(a.state);
  if(a.state==='walk'){assert.equal(env.sample(a.x).water,false);assert.equal(a.altitude,0);}
 }
 for(const state of ['walk','feedDown','forage','feedUp','travel'])assert.ok(seen.has(state),state);
});

test('new feeding clip endpoints match rest and active feeding at every heading',()=>{
 for(const kind of ['giraffe','boar','beaver','seagull'] as const){
  const spec=ECO_SPECS[kind],camera={width:112,height:112,anchor:[56,87] as [number,number],scale:spec.cameraScale};
  for(let d=0;d<spec.directions;d++)for(const [a,p,b,q] of [['feedDown',0,'rest',0],['feedDown',1,'forage',0],['feedUp',0,'forage',0],['feedUp',1,'rest',0]] as const){
   assert.deepEqual(bakeMesh(ecologyMesh(kind,a,p),d/spec.directions*Math.PI*2,camera).data,bakeMesh(ecologyMesh(kind,b,q),d/spec.directions*Math.PI*2,camera).data,`${kind}/${a}/${b}/${d}`);
  }
 }
});
