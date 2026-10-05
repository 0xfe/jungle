import { BinaryReader, BinaryWriter, type AgentEnvironment } from '../../agents';
import { clamp } from '../../iso/math';
import { EcologicalAgent } from './ecological-base';

/** A solitary cat: long rests, low stalking approaches, brief non-contact pursuits. */
export class TigerAgent extends EcologicalAgent {
 readonly kind='tiger';readonly type=75;
 private liftFromStalk(chase:boolean):void {this.state='uncrouch';this.gait=0;this.routeHeight=Number(chase);this.motor.stop();}
 protected decide(env:AgentEnvironment):void {
  if(this.state==='crouch'||this.state==='uncrouch')return;
  const prey=env.nearby(this.x,this.y,2.8).filter(a=>['deer','zebra','boar'].includes(a.kind))
   .sort((a,b)=>Math.hypot(a.x-this.x,a.y-this.y)-Math.hypot(b.x-this.x,b.y-this.y)||a.id.localeCompare(b.id))[0];
  if(this.state==='stalk'||this.state==='chase'){
   const gap=prey?Math.hypot(prey.x-this.x,prey.y-this.y):0;
   if(!prey||gap<.65||this.timer<=0){if(this.state==='stalk')this.liftFromStalk(false);else{this.state='rest';this.motor.stop();}this.timer=12;this.cooldown=35+this.random.next()*30;return;}
   const distance=Math.max(0,gap-.6),x=this.x+(prey.x-this.x)/gap*distance,y=this.y+(prey.y-this.y)/gap*distance;
   if(this.routeClear(x,y,env))this.target={x,y};
   if(this.state==='stalk'&&gap<1.5)this.liftFromStalk(true);
   return;
  }
  if(this.state==='roar'){if(this.timer<=0){this.state='rest';this.timer=8;}return;}
  if(this.state!=='rest'||this.timer>0)return;
  if(!this.cooldown&&prey&&this.random.next()<.4){
   if(this.routeClear(prey.x,prey.y,env)){this.target={x:prey.x,y:prey.y};this.state='crouch';this.gait=0;this.motor.stop();this.timer=8;this.tripPace=1;this.cooldown=50;return;}
  }
  if(this.repose.cooldown===0&&this.random.next()<.3){this.repose.begin(this.random);return;}
  if(this.random.next()<.25){this.beginActivity('groom',6);return;}
  if(this.random.next()<.22){this.state='roar';this.timer=4.5;this.gait=0;return;}
  this.journey(env);
 }
 protected override stationaryAction(dt:number,env:AgentEnvironment):boolean {
  if(this.state==='crouch'||this.state==='uncrouch'){
   this.motor.stop();this.gait=Math.min(1,this.gait+dt/.6);
   if(this.gait===1){this.state=this.state==='crouch'?'stalk':this.routeHeight?'chase':'rest';this.timer=this.state==='stalk'?8:this.state==='chase'?2.5:12;this.gait=0;}
   return true;
  }
  if(this.state==='chase'&&env.nearby(this.x,this.y,.65).some(a=>['deer','zebra','boar'].includes(a.kind))){this.motor.stop();this.state='rest';this.timer=12;this.cooldown=45;return true;}
  if(this.state!=='roar')return false;
  this.motor.stop();this.gait+=dt/4.5;return true;
 }
 static read(r:BinaryReader){return EcologicalAgent.readAs(r,(...a)=>new TigerAgent(...a));}
}

/** Heavy bank grazer; seeks shallow water to wallow, especially outside dusk. */
export class HippoAgent extends EcologicalAgent {
 readonly kind='hippo';readonly type=76;
 /** Submergence is owned state, so shoreline crossings cannot snap the body away. */
 submerged=false;resumeTravel=false;
 protected override allowed(x:number,y:number,env:AgentEnvironment):boolean {
  if(!super.allowed(x,y,env))return false;
  const radius=.22*this.size;
  for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
   const px=x+dx!*radius,py=y+dy!*radius,s=env.sample(px,py);
   if(!s.water&&!env.canMove(px,py))return false;
  }
  return true;
 }
 protected decide(env:AgentEnvironment):void {
  if(['feedDown','feedUp','enterWater','leaveWater'].includes(this.state))return;
  if(this.state==='graze')return;
  if(this.state==='wallow'){
   if(this.timer>0)return;
   if(this.random.next()<.4){this.beginActivity('yawn',4.5);return;}
   this.state='rest';this.timer=0;
  }
  if(this.state!=='rest'||this.timer>0)return;
  const here=env.sample(this.x,this.y),water=here.water;
  // Independent residence timers, followed by a bounded search across the bank.
  if(!this.cooldown){
   if(water){this.state='wallow';this.timer=18+this.random.next()*28;this.cooldown=this.timer+8;this.gait=0;}
   else this.beginFeeding(8+this.random.next()*12);
   return;
  }
  const elephants=env.nearby(this.x,this.y,3).filter(a=>a.kind==='elephant');
  const seekWater=this.random.next()<(here.light<.4?.35:.8);
  for(let i=0;i<48;i++){
   const a=this.random.next()*Math.PI*2,d=.25+this.random.next()*1.8,x=this.x+Math.cos(a)*d,y=this.y+Math.sin(a)*d;
   if(env.sample(x,y).water!==seekWater||!this.routeClear(x,y,env))continue;
   // Keep room around elephants, but allow an already close hippo to walk out.
   if(elephants.some(e=>Math.hypot(x-e.x,y-e.y)<Math.min(1.8,Math.hypot(this.x-e.x,this.y-e.y)+.15)))continue;
   this.target={x,y};this.state='travel';this.timer=25;this.tripPace=.8+this.random.next()*.25;return;
  }
  this.timer=4;
 }
 protected override stationaryAction(dt:number,env:AgentEnvironment):boolean {
  const wet=env.sample(this.x,this.y).water;
  if(!['enterWater','leaveWater'].includes(this.state)&&wet!==this.submerged){
   this.resumeTravel=this.state==='travel';this.state=wet?'enterWater':'leaveWater';this.gait=0;this.motor.stop();
  }
  if(this.state==='enterWater'||this.state==='leaveWater'){
   this.motor.stop();this.gait=Math.min(1,this.gait+dt/1.25);
   if(this.gait===1){this.submerged=this.state==='enterWater';this.state=this.resumeTravel?'travel':this.submerged?'wallow':'rest';this.gait=0;this.timer=this.resumeTravel?20:6;}
   return true;
  }
  this.altitude+=clamp((wet?-1:0)-this.altitude,-dt*3,dt*3);
  if(this.feedingAction(dt,.8,.45,'graze'))return true;
  if(this.state!=='wallow')return false;
  this.motor.stop();this.gait+=dt*.13*this.pace;return true;
 }
 override write(w:BinaryWriter):void {super.write(w);w.u8(Number(this.submerged));w.u8(Number(this.resumeTravel));}
 static read(r:BinaryReader){const a=EcologicalAgent.readAs(r,(...args)=>new HippoAgent(...args)),wet=r.u8(),resume=r.u8();if(wet>1||resume>1)throw new Error('Invalid hippo bank transition');a.submerged=Boolean(wet);a.resumeTravel=Boolean(resume);return a;}
}

/** Cohesive grazing herd with short shared runs and pauses for lagging members. */
export class BisonAgent extends EcologicalAgent {
 readonly kind='bison';readonly type=77;
 protected decide(env:AgentEnvironment):void {
  if(this.state==='feedDown'||this.state==='feedUp')return;
  const herd=env.nearby(this.x,this.y,5).filter(a=>this.groupId&&a.groupId===this.groupId&&a.id!==this.id);
  const leader=herd.find(a=>a.id===this.leaderId),gap=leader?Math.hypot(leader.x-this.x,leader.y-this.y):0;
  if(leader&&gap>(leader.speed>.3?.45:.85)){
   if(this.state==='graze'){this.timer=0;return;}
   const angle=leader.heading??0,rank=Number(this.id.split(':').at(-1))||1,side=rank%2?.35:-.35,trail=.55+Math.floor(rank/2)*.42;
   const x=leader.x-Math.cos(angle)*trail-Math.sin(angle)*side,y=leader.y-Math.sin(angle)*trail+Math.cos(angle)*side;
   if(this.routeClear(x,y,env)){this.target={x,y};this.state=leader.speed>.4||gap>1.3?'run':'travel';this.tripPace=1.1;this.timer=12;return;}
  }
  if(!leader&&herd.some(a=>Math.hypot(a.x-this.x,a.y-this.y)>1.8)){
   if(this.state==='graze'){this.timer=0;return;}
   this.state='rest';this.motor.stop();this.timer=1;return;
  }
  if(this.state==='graze')return;
  if(this.state!=='rest'||this.timer>0)return;
  if(!this.cooldown){this.beginFeeding(9+this.random.next()*18);return;}
  if(this.journey(env)&&!leader&&this.random.next()<.32){this.state='run';this.timer=3+this.random.next()*3;}
 }
 protected override stationaryAction(dt:number,_env:AgentEnvironment):boolean {
  return this.feedingAction(dt,.9,.4,'graze');
 }
 static read(r:BinaryReader){return EcologicalAgent.readAs(r,(...a)=>new BisonAgent(...a));}
}
