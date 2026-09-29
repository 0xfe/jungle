import { BinaryReader, type AgentEnvironment } from '../../agents';
import { EcologicalAgent } from './ecological-base';

/** Small dry-woodland herd: graze between trips, regroup before the leader moves on. */
export class ZebraAgent extends EcologicalAgent {
 readonly kind='zebra';readonly type=59;
 protected decide(env:AgentEnvironment):void {
  const herd=env.nearby(this.x,this.y,5).filter(n=>n.groupId===this.groupId&&n.id!==this.id&&this.groupId);
  const leader=herd.find(n=>n.id===this.leaderId);
  if(leader&&Math.hypot(leader.x-this.x,leader.y-this.y)>.7){
   const angle=leader.heading??0;
   // Stagger followers across the leader's trail so a small herd does not
   // collapse into a single overlapping waypoint. Snapshot IDs fix the order.
   const side=herd.filter(n=>n.id<this.id).length%2?.20:-.20;
   for(const offset of [0,.7,-.7]){
    const x=leader.x-Math.cos(angle+offset)*.42-Math.sin(angle)*side,y=leader.y-Math.sin(angle+offset)*.42+Math.cos(angle)*side;
    if(!this.routeClear(x,y,env))continue;
    this.target={x,y};this.state=Math.hypot(leader.x-this.x,leader.y-this.y)>1.1||leader.speed>.5?'run':'travel';this.timer=20;this.tripPace=1.15;return;
   }
  }
  if(this.id===this.leaderId&&herd.some(n=>Math.hypot(n.x-this.x,n.y-this.y)>1.3)){
   this.state='rest';this.motor.stop();this.timer=1;return;
  }
  if(this.state==='graze'){
   if(this.timer<=0){this.state='rest';this.timer=1+this.random.next()*3;this.cooldown=12+this.random.next()*15;}
   return;
  }
  if(this.state!=='rest'||this.timer>0)return;
  if(this.repose.cooldown===0&&this.random.next()<.4){this.repose.begin(this.random);this.timer=2;return;}
  if(this.cooldown===0){this.state='graze';this.gait=0;this.timer=5+this.random.next()*9;return;}
  if(this.journey(env)&&this.random.next()<.2){this.state='run';this.timer=3+this.random.next()*3;}
 }
 protected override stationaryAction(dt:number,_env:AgentEnvironment):boolean {
  if(this.state!=='graze')return false;
  this.motor.stop();this.gait+=dt*.22*this.pace;return true;
 }
 static read(r:BinaryReader):ZebraAgent{return EcologicalAgent.readAs(r,(...a)=>new ZebraAgent(...a));}
}
