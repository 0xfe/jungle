import { BinaryReader, type AgentEnvironment } from '../../agents';
import { clamp, lerp } from '../../iso/math';
import { angleDelta, TAU } from '../animation';
import { crossingPerch } from '../flight';
import { EcologicalAgent } from './ecological-base';

/** Shore resident alternates independent pecking/steps with real flights. */
export class SeagullAgent extends EcologicalAgent {
 readonly kind='seagull';readonly type=45;
 protected override allowed(x:number,y:number,env:AgentEnvironment):boolean {
  if(this.state==='walk')return this.within(x,y)&&!env.sample(x,y).water&&Boolean(env.sample(x,y).beach)&&env.canMove(x,y);
  return super.allowed(x,y,env);
 }
 protected decide(env:AgentEnvironment):void {
  // Open-water waypoints are fly-through points, never invisible perches.
  if(this.state==='travel'&&Math.hypot(this.target.x-this.x,this.target.y-this.y)<.04&&env.sample(this.target.x,this.target.y).water){this.journey(env);return;}
  if(this.state!=='rest'||this.timer>0)return;
  if(env.sample(this.x,this.y).water){this.journey(env);return;}
  if(this.altitude<1&&this.cooldown===0&&this.random.next()<.5){this.beginFeeding(3+this.random.next()*4);return;}
  if(this.altitude<1&&this.random.next()<.72){
   this.state='walk';
   for(let i=0;i<24;i++){
    const angle=this.heading+(this.random.next()-.5)*TAU,d=.16+this.random.next()*.5;
    const x=this.x+Math.cos(angle)*d,y=this.y+Math.sin(angle)*d;
    if(!this.routeClear(x,y,env))continue;
    this.target={x,y};this.timer=8;this.tripPace=.8+this.random.next()*.4;return;
   }
   this.state='rest';this.timer=1;return;
  }
  this.journey(env);
 }
 protected override stationaryAction(dt:number,_env:AgentEnvironment):boolean {return this.feedingAction(dt,.35,.9);}
 static read(r:BinaryReader):SeagullAgent{return EcologicalAgent.readAs(r,(...a)=>new SeagullAgent(...a));}
}

/** A real waterside perch, a fixed fishing dive, then a return to the same support. */
export class KingfisherAgent extends EcologicalAgent {
 readonly kind='kingfisher';readonly type=50;
 private fishingPoint(env:AgentEnvironment,x:number,y:number):{x:number;y:number}|undefined {
  for(let i=0;i<32;i++){
   const angle=i/32*TAU,d=.3+(i%4)*.2,px=x+Math.cos(angle)*d,py=y+Math.sin(angle)*d;
   if(this.within(px,py)&&env.sample(px,py).water&&(env.sample(px,py).depth??.2)>.08)return{x:px,y:py};
  }
  return undefined;
 }
 protected decide(env:AgentEnvironment):void {
  if(this.state!=='rest'||this.timer>0)return;
  const crossing=crossingPerch(this.x,this.y,env,this.random,(x,y)=>this.within(x,y));
  if(crossing){this.target={x:crossing.x,y:crossing.y};this.targetAltitude=crossing.height;this.state='travel';this.timer=30;this.tripPace=.85+this.random.next()*.3;return;}
  const perches=(env.perches?.(this.x,this.y,2)??[]).slice(0,48).filter(p=>this.within(p.x,p.y)&&!env.sample(p.x,p.y).water&&p.height>12&&this.fishingPoint(env,p.x,p.y));
  const perch=perches.find(p=>Math.hypot(p.x-this.x,p.y-this.y)<.08);
  if(perch&&this.altitude>10&&this.cooldown===0){
   const fish=this.fishingPoint(env,perch.x,perch.y)!;
   this.routeX=this.x;this.routeY=this.y;this.routeHeight=this.altitude;this.routeProgress=0;
   this.target=fish;this.state='dive';this.gait=0;this.motor.stop();return;
  }
  if(perch&&this.cooldown>0){this.timer=2+this.random.next()*3;return;}
  if(perches.length){
   const goal=perches[Math.floor(this.random.next()*perches.length)]!;
   this.target={x:goal.x,y:goal.y};this.targetAltitude=goal.height;this.state='travel';this.timer=20;this.tripPace=.9+this.random.next()*.2;
  }else this.follow(env,true);
 }
 protected override stationaryAction(dt:number,env:AgentEnvironment):boolean {
  if(this.state!=='dive')return false;
  const support=(env.perches?.(this.routeX,this.routeY,.15)??[]).some(p=>Math.hypot(p.x-this.routeX,p.y-this.routeY)<.08);
  if(!support||!env.sample(this.target.x,this.target.y).water){
   this.state='rest';this.timer=0;this.cooldown=15;this.journey(env,true);return true;
  }
  const before=this.routeProgress,t=Math.min(1,before+dt/3.2),out=t<.48;
  const u=out?t/.48:(1-t)/.52,s=u*u*(3-2*u);
  const desired=Math.atan2(this.target.y-this.routeY,this.target.x-this.routeX)+(out?0:Math.PI);
  const turn=angleDelta(this.heading,desired);this.heading+=clamp(turn,-dt*6,dt*6);
  if(before===0&&Math.abs(turn)>.12){this.motor.stop();return true;}
  const x=lerp(this.routeX,this.target.x,s),y=lerp(this.routeY,this.target.y,s);
  this.motor.speed=Math.hypot(x-this.x,y-this.y)/dt;this.x=x;this.y=y;
  this.altitude=lerp(this.routeHeight,1.5,s);this.routeProgress=t;this.gait=t;
  if(t===1){this.x=this.routeX;this.y=this.routeY;this.altitude=this.routeHeight;this.targetAltitude=this.altitude;this.state='rest';this.gait=0;this.timer=4;this.cooldown=20+this.random.next()*25;this.motor.stop();}
  return true;
 }
 static read(r:BinaryReader):KingfisherAgent{return EcologicalAgent.readAs(r,(...a)=>new KingfisherAgent(...a));}
}
