import test from 'node:test';
import assert from 'node:assert/strict';
import {AgentSystem,type AgentEnvironment} from '../src/agents';
import {WolfAgent,JaguarAgent,jungleAgents} from '../src/jungle/agents';
import {InfiniteWorld} from '../src/jungle/infinite';

const land:AgentEnvironment={time:0,canMove:()=>true,nearby:()=>[],sample:()=>({water:false,elevation:0,moisture:.6,wind:1,light:.8})};
function pack(){return Array.from({length:5},(_,i)=>{
 const a=new WolfAgent(`pack:${i}`,-i*.28,i%2*.2,110+i);a.groupId='pack';a.leaderId='pack:0';a.heading=0;a.timer=i?4:0;
 a.territory=[-4,-4,4,4];if(i===4){a.juvenile=true;a.motherId='pack:0';a.size=.6;}return a;
});}

test('wolf families stay cohesive while adults explore and cubs catch up at their own pace',()=>{
 const wolves=pack(),sys=new AgentSystem();let running=0,walking=0,resting=0,maxGap=0,peak=0;
 const cub=wolves[4]!,leader=wolves[0]!;
 for(let i=0;i<7200;i++){
  sys.step(wolves,1/60,land);
  maxGap=Math.max(maxGap,Math.hypot(cub.x-leader.x,cub.y-leader.y));
  for(const w of wolves){running+=Number(w.state==='run');walking+=Number(w.state==='travel');resting+=Number(w.state==='rest');peak=Math.max(peak,w.speed);assert.ok(w.x>-3.85&&w.x<3.85&&w.y>-3.85&&w.y<3.85);}
 }
 assert.ok(running>120&&walking>1000&&resting>1000);assert.ok(peak>.6);assert.ok(maxGap<2,`cub left behind: ${maxGap}`);
 assert.ok(new Set(wolves.map(w=>w.gait)).size===5);
 assert.ok(wolves.every(w=>Math.hypot(w.x-leader.x,w.y-leader.y)<1.6));
});

test('wolf pack decisions are update-order independent and resume exactly mid-run',()=>{
 const a=pack(),b=jungleAgents.decode(jungleAgents.encode(a)).reverse() as WolfAgent[],sys=new AgentSystem();
 for(let i=0;i<1800;i++){sys.step(a,1/60,land);sys.step(b,1/60,land);}
 assert.deepEqual(jungleAgents.encode(a),jungleAgents.encode(b.reverse()));
 a[0]!.state='run';a[0]!.target={x:2,y:2};a[0]!.motor.speed=.4;a[0]!.motor.acceleration=1.1;
 const restored=jungleAgents.decode(jungleAgents.encode(a));
 for(let i=0;i<1200;i++){sys.step(a,1/60,land);sys.step(restored,1/60,land);}
 assert.deepEqual(jungleAgents.encode(a),jungleAgents.encode(restored));
});

test('wolf and jaguar runs accelerate, cover ground, cycle by distance and brake on arrival',()=>{
 for(const C of [WolfAgent,JaguarAgent]){
  const a=new C('runner',0,0,8);a.state='run';a.heading=0;a.target={x:2.5,y:0};a.timer=30;a.decision=100;a.pace=a.tripPace=a.size=1;
  let peak=0,braked=false,distance=0,cycles=0,first=0;
  const stride=C===WolfAgent?.42:.43,accel=C===WolfAgent?2.6:3.8;
  for(let i=0;i<900&&a.state==='run';i++){
   const x=a.x,gait=a.gait,speed=a.speed;a.update(1/60,land);
   distance+=a.x-x;cycles+=a.gait-gait;
   assert.ok(Math.abs(a.gait-gait-(a.x-x)/stride)<1e-9);
   if(a.state==='run')assert.ok(Math.abs(a.speed-speed)<=accel/60+1e-8);
   peak=Math.max(peak,a.speed);if(i===0)first=a.speed;
   if(a.x>2.2&&a.speed<peak*.7)braked=true;
   assert.ok(a.x<=2.5);
  }
  assert.ok(peak>.85&&first<.02);assert.ok(distance>2.48&&cycles>5&&braked);assert.equal(a.state,'rest');
 }
});

test('solitary jaguars sometimes run even without prey and retain recovery between bouts',()=>{
 let runs=0,walks=0;const a=new JaguarAgent('j',0,0,83);a.timer=0;
 for(let i=0;i<18000;i++){const state=a.state;a.update(1/60,land);if(a.state==='run'&&state!=='run'){runs++;assert.ok(a.cooldown>=25);}walks+=Number(a.state==='travel');assert.notEqual(a.state,'chase');}
 assert.ok(runs>0&&walks>1000);
 const b=jungleAgents.decode(jungleAgents.encode([a]))[0]!;
 for(let i=0;i<1800;i++){a.update(1/60,land);b.update(1/60,land);}
 assert.deepEqual(jungleAgents.encode([a]),jungleAgents.encode([b]));
});

test('procedural wolves form larger separated packs, sometimes with linked smaller cubs',()=>{
 const w=new InfiniteWorld(2718);let families=0,cubs=0,adultsOnly=0;
 for(let i=0;i<8;i++){
  const p=w.wildlifeLandmark('wolf',i*20,-i*13);w.ensure({minX:p.x-3,minY:p.y-3,maxX:p.x+3,maxY:p.y+3});
  const wolves=w.agents.filter((a):a is WolfAgent=>a instanceof WolfAgent),groups=new Set(wolves.map(a=>a.groupId));
  for(const group of groups){
   const members=wolves.filter(a=>a.groupId===group);families++;assert.ok(members.length>=3&&members.length<=7);
   if(members.every(a=>!a.juvenile))adultsOnly++;
   for(const a of members){
    assert.ok(members.some(b=>b.id===a.leaderId));
    if(a.juvenile){cubs++;const parent=members.find(b=>b.id===a.motherId)!;assert.ok(parent&&!parent.juvenile);assert.ok(a.size<parent.size*.8);}
    for(const b of members)if(b!==a)assert.ok(Math.hypot(a.x-b.x,a.y-b.y)>=.22-1e-9);
   }
  }
 }
 assert.ok(families>=8&&cubs>0&&adultsOnly>0);
});
