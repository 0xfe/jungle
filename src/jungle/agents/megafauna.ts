import { BinaryReader, type AgentEnvironment } from '../../agents';
import { clamp } from '../../iso/math';
import { EcologicalAgent } from './ecological-base';

/** A solitary cat: long rests, low stalking approaches, brief non-contact pursuits. */
export class TigerAgent extends EcologicalAgent {
 readonly kind='tiger';readonly type=75;
 protected decide(env:AgentEnvironment):void {
  const prey=env.nearby(this.x,this.y,2.8).filter(a=>['deer','zebra','boar'].includes(a.kind))
   .sort((a,b)=>Math.hypot(a.x-this.x,a.y-this.y)-Math.hypot(b.x-this.x,b.y-this.y)||a.id.localeCompare(b.id))[0];
  if(this.state==='stalk'||this.state==='chase'){
   const gap=prey?Math.hypot(prey.x-this.x,prey.y-this.y):0;
   if(!prey||gap<.65||this.timer<=0){this.state='rest';this.motor.stop();this.timer=12;this.cooldown=35+this.random.next()*30;return;}
   const distance=Math.max(0,gap-.6),x=this.x+(prey.x-this.x)/gap*distance,y=this.y+(prey.y-this.y)/gap*distance;
   if(this.routeClear(x,y,env))this.target={x,y};
   if(this.state==='stalk'&&gap<1.5){this.state='chase';this.timer=2.5;}
   return;
  }
  if(this.state==='roar'){if(this.timer<=0){this.state='rest';this.timer=8;}return;}
  if(this.state!=='rest'||this.timer>0)return;
  if(!this.cooldown&&prey&&this.random.next()<.4){
   if(this.routeClear(prey.x,prey.y,env)){this.target={x:prey.x,y:prey.y};this.state='stalk';this.timer=8;this.tripPace=1;this.cooldown=50;return;}
  }
  if(this.random.next()<.22){this.state='roar';this.timer=4.5;this.gait=0;return;}
  this.journey(env);
 }
 protected override stationaryAction(dt:number,env:AgentEnvironment):boolean {
  if(this.state==='chase'&&env.nearby(this.x,this.y,.65).some(a=>['deer','zebra','boar'].includes(a.kind))){this.motor.stop();this.state='rest';this.timer=12;this.cooldown=45;return true;}
  if(this.state!=='roar')return false;
  this.motor.stop();this.gait+=dt/4.5;return true;
 }
 static read(r:BinaryReader){return EcologicalAgent.readAs(r,(...a)=>new TigerAgent(...a));}
}

/** Heavy bank grazer; seeks shallow water to wallow, especially outside dusk. */
export class HippoAgent extends EcologicalAgent {
 readonly kind='hippo';readonly type=76;
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
  if(this.state==='graze'||this.state==='wallow'){
   if(this.timer>0)return;
   this.state='rest';this.timer=0;
  }
  if(this.state!=='rest'||this.timer>0)return;
  const here=env.sample(this.x,this.y),water=here.water;
  // Independent residence timers, followed by a bounded search across the bank.
  if(!this.cooldown){this.state=water?'wallow':'graze';this.timer=water?18+this.random.next()*28:8+this.random.next()*12;this.cooldown=this.timer+8;this.gait=0;return;}
  const seekWater=this.random.next()<(here.light<.4?.35:.8);
  for(let i=0;i<48;i++){
   const a=this.random.next()*Math.PI*2,d=.25+this.random.next()*1.8,x=this.x+Math.cos(a)*d,y=this.y+Math.sin(a)*d;
   if(env.sample(x,y).water!==seekWater||!this.routeClear(x,y,env))continue;
   this.target={x,y};this.state='travel';this.timer=25;this.tripPace=.8+this.random.next()*.25;return;
  }
  this.timer=4;
 }
 protected override stationaryAction(dt:number,env:AgentEnvironment):boolean {
  const wet=env.sample(this.x,this.y).water;
  this.altitude+=clamp((wet?-1:0)-this.altitude,-dt*3,dt*3);
  if(this.state!=='graze'&&this.state!=='wallow')return false;
  this.motor.stop();this.gait+=dt*.13*this.pace;return true;
 }
 static read(r:BinaryReader){return EcologicalAgent.readAs(r,(...a)=>new HippoAgent(...a));}
}

/** Cohesive grazing herd with short shared runs and pauses for lagging members. */
export class BisonAgent extends EcologicalAgent {
 readonly kind='bison';readonly type=77;
 protected decide(env:AgentEnvironment):void {
  const herd=env.nearby(this.x,this.y,5).filter(a=>this.groupId&&a.groupId===this.groupId&&a.id!==this.id);
  const leader=herd.find(a=>a.id===this.leaderId),gap=leader?Math.hypot(leader.x-this.x,leader.y-this.y):0;
  if(leader&&gap>(leader.speed>.3?.45:.85)){
   const angle=leader.heading??0,rank=Number(this.id.split(':').at(-1))||1,side=rank%2?.35:-.35,trail=.55+Math.floor(rank/2)*.42;
   const x=leader.x-Math.cos(angle)*trail-Math.sin(angle)*side,y=leader.y-Math.sin(angle)*trail+Math.cos(angle)*side;
   if(this.routeClear(x,y,env)){this.target={x,y};this.state=leader.speed>.4||gap>1.3?'run':'travel';this.tripPace=1.1;this.timer=12;return;}
  }
  if(!leader&&herd.some(a=>Math.hypot(a.x-this.x,a.y-this.y)>1.8)){
   this.state='rest';this.motor.stop();this.timer=1;return;
  }
  if(this.state==='graze'){if(this.timer<=0){this.state='rest';this.timer=1;this.cooldown=10+this.random.next()*15;}return;}
  if(this.state!=='rest'||this.timer>0)return;
  if(!this.cooldown){this.state='graze';this.gait=0;this.timer=9+this.random.next()*18;return;}
  if(this.journey(env)&&!leader&&this.random.next()<.32){this.state='run';this.timer=3+this.random.next()*3;}
 }
 protected override stationaryAction(dt:number,_env:AgentEnvironment):boolean {
  if(this.state!=='graze')return false;
  this.motor.stop();this.gait+=dt*.2*this.pace;return true;
 }
 static read(r:BinaryReader){return EcologicalAgent.readAs(r,(...a)=>new BisonAgent(...a));}
}
