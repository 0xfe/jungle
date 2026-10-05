import test from 'node:test';
import assert from 'node:assert/strict';
import type { AgentEnvironment } from '../src/agents';
import { WolfAgent,MonkeyAgent,OrangutanAgent,ToucanAgent,MacawAgent,ParakeetAgent,CrocodileAgent,ToadAgent,SmallSnakeAgent,FishAgent,HippoAgent } from '../src/jungle/agents';
import { KoiAgent,DuckAgent,PelicanAgent } from '../src/jungle/agents/zen';
const land:AgentEnvironment={time:0,canMove:()=>true,nearby:()=>[],sample:()=>({water:false,bank:true,beach:true,moisture:.5,depth:.2,elevation:0,wind:1,light:1}),perches:(x,y,r)=>[{x:0,y:0,height:45},{x:1,y:0,height:48}].filter(p=>Math.hypot(p.x-x,p.y-y)<=r)};

test('independent species actually choose their new quiet activities over several seeded lifetimes',()=>{
 for(const [C,wanted,canopy,water] of [[WolfAgent,'sniff',false,false],[MonkeyAgent,'feed',true,false],[OrangutanAgent,'feed',true,false],[ToucanAgent,'preen',true,false],[MacawAgent,'preen',true,false],[ParakeetAgent,'preen',true,false],[CrocodileAgent,'bask',false,false],[ToadAgent,'feed',false,false],[SmallSnakeAgent,'investigate',false,false],[FishAgent,'feed',false,true],[HippoAgent,'yawn',false,true]] as const){
  const seen=new Set<string>();
  for(const seed of [7,19,31]){
   const a=new C('observer',0,0,seed);a.timer=0;if(canopy)a.altitude=30;
   const env=water?{...land,sample:()=>({...land.sample(0,0),water:true})}:land;
   for(let i=0;i<180*60;i++){a.update(1/60,env);seen.add(a.state);}
  }
  assert.ok(seen.has(wanted),`${C.name} never chose ${wanted}: ${[...seen]}`);
 }
});

test('pond activities use independent bounded routes, complete dips and allow temporary duck shore visits',()=>{
 const env={...land,sample:(x:number,y:number)=>({...land.sample(x,y),water:(x/1.8)**2+(y/1.2)**2<1})};
 for(const C of [KoiAgent,DuckAgent,PelicanAgent]){
  const a=new C('pond',0,0,17),seen=new Set<number>(),goals=new Set<string>();a.timer=0;
  const fish={id:'koi',kind:'koi',x:.4,y:0,speed:.05};
  for(let i=0;i<240*60;i++){
   a.update(1/60,{...env,nearby:()=>[fish]});seen.add(a.state);goals.add(`${a.goalX.toFixed(2)},${a.goalY.toFixed(2)}`);
   if(a instanceof DuckAgent&&[3,4,5].includes(a.state))assert.ok(Math.hypot(a.x,a.y)<2.4);else assert.ok(env.sample(a.x,a.y).water);
  }
  assert.ok(goals.size>8,`${a.kind} route variety`);assert.ok(seen.has(2),`${a.kind} feeding/dip`);
  if(a instanceof DuckAgent)assert.ok(seen.has(4)&&seen.has(5),'duck rests ashore and returns');
 }
});
