import test from 'node:test';
import assert from 'node:assert/strict';
import {AgentSystem,StartleResponse,type AgentEnvironment} from '../src/agents';
import {ElephantAgent,DeerAgent,WolfAgent,JaguarAgent,MonkeyAgent,jungleAgents} from '../src/jungle/agents';
import {elephantTrunk,ELEPHANT_MODEL_TO_TILE} from '../src/jungle/elephant-pose';
import {InfiniteWorld} from '../src/jungle/infinite';
const shore:AgentEnvironment={time:0,nearby:()=>[],canMove:(x)=>x<.8,sample:x=>({water:x>=.8,elevation:0,moisture:.6,light:.8,wind:1,depth:x>=.8?.25:0})};
const land:AgentEnvironment={...shore,canMove:()=>true,sample:()=>({...shore.sample(0,0),water:false})};

test('elephants seek actual reachable water, fill their trunk, curl to drink, then linger',()=>{
 const a=new ElephantAgent('e',-.3,0,19);a.size=1;a.heading=0;a.timer=0;a.territory=[-3,-3,3,3];a.cooldown=100;
 const system=new AgentSystem();let drinking=0,filled=false,drank=false;
 for(let i=0;i<3600;i++){
  system.step([a],1/60,shore);assert.ok(a.x+.23<.8+1e-9,'feet entered water');
  if(a.state==='drink'){drinking++;assert.ok(shore.sample(a.waterX,a.waterY).water);assert.ok(Math.hypot(a.x-a.waterX,a.y-a.waterY)<=1.95*ELEPHANT_MODEL_TO_TILE*a.size+.03);}
  filled ||= a.loaded;
  if(a.thirst<.1&&a.state==='rest'){drank=true;assert.ok(a.timer>=15);break;}
 }
 assert.ok(drinking>200&&filled&&drank);assert.ok(a.x>0);
 const dip=elephantTrunk('drink',.3)[3]!,mouth=elephantTrunk('drink',.7)[3]!;
 assert.ok(dip[2]<.05&&dip[0]>1.9);assert.ok(mouth[2]>1&&mouth[0]<1.1);
 const dry=new ElephantAgent('dry',0,0,7);dry.timer=0;
 for(let i=0;i<1200;i++){system.step([dry],1/60,land);assert.ok(dry.state!=='drink'&&dry.state!=='spray');assert.equal(dry.loaded,false);}
});

test('an elephant only initiates playful spray after filling at water, sometimes targeting another species',()=>{
 const sys=new AgentSystem();let sprays=0,other=0;
 for(let seed=1;seed<=12;seed++){
  const e=new ElephantAgent('e',.4,0,seed);e.size=1;e.heading=0;e.state='drink';e.gait=.22;e.waterKnown=true;e.waterX=.897;e.waterY=0;e.timer=10;
  const d=new DeerAgent('d',.3,.8,20);d.timer=100;d.heading=-Math.PI/2;
  let filled=false;
  for(let i=0;i<400;i++){
   sys.step([e,d],1/60,shore);filled ||= e.loaded;
   if(e.sample().state==='spray'){sprays++;assert.ok(filled);assert.ok(e.cooldown>20);other+=Number(Math.abs(e.sprayX-.3)<.05);break;}
  }
 }
 assert.ok(sprays>0&&sprays<12&&other>0);
});

test('splash reactions are localized, repeat-limited and vary by species while respecting land',()=>{
 const sys=new AgentSystem();
 for(const C of [DeerAgent,WolfAgent,JaguarAgent,MonkeyAgent,ElephantAgent]){
  const source=new ElephantAgent('source',0,0,1);source.state='spray';source.loaded=true;source.gait=.5;source.sprayX=.9;source.sprayY=0;source.heading=0;source.decision=100;
  const a=new C('target',.9,0,3);a.heading=Math.PI;a.timer=100;if(a instanceof ElephantAgent)a.thirst=0;
  const far=new C('far',.9,2,4);far.timer=100;if(far instanceof ElephantAgent)far.thirst=0;
  const actors=[source,a,far];let moved=0;
  for(let i=0;i<160;i++){sys.step(actors,1/60,land);moved=Math.max(moved,a.x-.9);}
  assert.ok(a.startle.cooldown>0,C.name);assert.equal(far.startle.cooldown,0);assert.ok(Math.cos(a.heading)>.5,C.name);assert.ok(moved>.035,C.name);
 }
 const r=new StartleResponse(),s={id:'a',x:1,y:0},n={id:'e',kind:'elephant',x:0,y:0,speed:0,stimulus:{kind:'splash' as const,x:1,y:0,radius:.3}};
 assert.ok(r.sense(s,[n]));assert.equal(r.sense(s,[n]),false);
 const blocked=new WolfAgent('blocked',.9,0,1);blocked.heading=Math.PI;
 const source=new ElephantAgent('e',0,0,1);source.state='spray';source.loaded=true;source.gait=.5;source.sprayX=.9;source.sprayY=0;source.heading=0;source.decision=100;
 for(let i=0;i<120;i++)sys.step([source,blocked],1/60,{...land,canMove:()=>false});
 assert.equal(blocked.x,.9);assert.ok(Math.cos(blocked.heading)>.9);
});

test('mid-spray snapshots preserve stimulus, thirst, targets, cooldown and exact order-independent reactions',()=>{
 const e=new ElephantAgent('e',0,0,61);e.state='spray';e.gait=.46;e.loaded=true;e.sprayX=1;e.sprayY=0;e.heading=0;e.decision=100;e.waterKnown=true;e.waterX=.7;e.thirst=.7;
 const d=new DeerAgent('d',1,0,3);d.timer=100;
 const original=[e,d],copy=jungleAgents.decode(jungleAgents.encode(original)).reverse(),sys=new AgentSystem();
 for(let i=0;i<600;i++){sys.step(original,1/60,land);sys.step(copy,1/60,land);}
 assert.deepEqual(jungleAgents.encode(original),jungleAgents.encode(copy.reverse()));
 assert.ok(d.startle.cooldown>0||d.x>1);
});

test('new elephant populations favor chunks with water and retained families stay valid',()=>{
 const w=new InfiniteWorld(2718);let wet=0,dry=0,seen=0;
 for(let i=0;i<10;i++){
  const p=w.wildlifeLandmark('elephant',i*12,-i*9);w.ensure({minX:p.x-2,minY:p.y-2,maxX:p.x+2,maxY:p.y+2});
  for(const c of w.active.values()){
   const elephants=c.agents.filter(a=>a.kind==='elephant') as ElephantAgent[];if(!elephants.length)continue;
   seen++;const water=c.tiles.some(t=>t.fields?.some(f=>f[0]<0));if(water)wet++;else dry++;
   for(const a of elephants){assert.ok(c.agents.some(b=>b.id===a.leaderId));if(a.juvenile)assert.ok(c.agents.some(b=>b.id===a.motherId));}
  }
 }
 assert.ok(seen>=10&&wet>dry,`${wet} waterside vs ${dry} inland`);
});

test('natural waterside populations reach water and perform drinking or spray actions',()=>{
 let drinks=0,sprays=0;
 const w=new InfiniteWorld(2718),p=w.wildlifeLandmark('elephant',-14,-9);w.ensure({minX:p.x-2,minY:p.y-2,maxX:p.x+2,maxY:p.y+2});
 for(let i=0;i<5400;i++){
  w.update(1/60);
  for(const a of w.agents)if(a instanceof ElephantAgent){drinks+=Number(a.state==='drink');sprays+=Number(a.state==='spray');}
 }
 assert.ok(drinks>100&&sprays>20,`drink frames ${drinks}, spray frames ${sprays}`);
});
