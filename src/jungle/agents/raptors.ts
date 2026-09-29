import { BinaryReader, BinaryWriter, ease, type AgentEnvironment } from '../../agents';
import { clamp } from '../../iso/math';
import { angleDelta, TAU } from '../animation';
import { BIRD_FLIGHT } from '../flight';
import { EcologicalAgent } from './ecological-base';

/** A bounded home range remains owned by its original chunk while circling.
 * These birds never migrate or create carcasses by killing another agent. */
abstract class RaptorAgent extends EcologicalAgent {
 homeX:number;homeY:number;orbit=0;radius=2.8;action=0;
 constructor(id:string,x:number,y:number,seed:number){
  super(id,x,y,seed);this.homeX=x-2.8;this.homeY=y;this.altitude=105;this.heading=Math.PI/2;
  this.state='travel';this.timer=30;this.cooldown=30+this.random.next()*40;this.previous=this.sample();
 }
 protected decide(_env:AgentEnvironment):void {}
 protected fly(dt:number,env:AgentEnvironment,x:number,y:number,height:number,speed:number):void {
  const desired=Math.atan2(y-this.y,x-this.x),delta=angleDelta(this.heading,desired);
  this.heading+=clamp(delta,-dt*1.5,dt*1.5);
  this.motor.update(Math.min(speed,Math.hypot(x-this.x,y-this.y)*2)*Math.max(0,Math.cos(delta)),dt,.6,3);
  const step=Math.min(Math.hypot(x-this.x,y-this.y),this.speed*dt);
  this.x+=Math.cos(this.heading)*step;this.y+=Math.sin(this.heading)*step;
  this.gait=this.flight.advance(this.gait,dt,height-this.altitude,this.pace,this.random,BIRD_FLIGHT[this.kind]!);
  this.altitude=ease(this.altitude,height,.7,dt);
 }
 protected circle(dt:number,env:AgentEnvironment,height:number):void {
  this.orbit+=dt*.58/this.radius;
  this.fly(dt,env,this.homeX+Math.cos(this.orbit+.35)*this.radius,this.homeY+Math.sin(this.orbit+.35)*this.radius,height,.65*this.pace);
 }
 protected tick(dt:number):void {
  Object.assign(this.previous,this.sample());this.previousBreath=this.breathClock;this.breathClock+=dt;
  this.timer-=dt;this.decision-=dt;this.cooldown=Math.max(0,this.cooldown-dt);
 }
 override write(w:BinaryWriter):void {super.write(w);for(const n of [this.homeX,this.homeY,this.orbit,this.radius,this.action])w.f64(n);}
 static restoreRaptor<T extends RaptorAgent>(r:BinaryReader,create:(id:string,x:number,y:number,seed:number)=>T):T {
  const a=EcologicalAgent.readAs(r,create);a.homeX=r.f64();a.homeY=r.f64();a.orbit=r.f64();a.radius=r.f64();a.action=r.f64();
  if(a.radius<1||a.radius>4||a.action<0||a.action>1)throw new Error('Invalid raptor route');return a;
 }
}

/** Rare broad circles, an occasional missed dive, then a long search recovery. */
export class HawkAgent extends RaptorAgent {
 readonly kind='hawk';readonly type=61;
 override update(dt:number,env:AgentEnvironment):void {
  this.tick(dt);
  if(this.state==='dive'){
   this.action=Math.min(1,this.action+dt/3.4);
   const t=this.action,s=t*t*(3-2*t),x=this.routeX+(this.target.x-this.routeX)*s,y=this.routeY+(this.target.y-this.routeY)*s;
   // A fixed, already-missed intercept cannot follow or capture fleeing prey.
   const desired=Math.atan2(this.target.y-this.routeY,this.target.x-this.routeX);
   this.heading+=clamp(angleDelta(this.heading,desired),-dt*2,dt*2);
   this.motor.speed=Math.hypot(x-this.x,y-this.y)/dt;this.x=x;this.y=y;
   this.altitude=this.routeHeight+(105-this.routeHeight)*s-89*Math.sin(Math.PI*t)**2;
   this.gait=this.flight.advance(this.gait,dt,t>.5?12:-12,this.pace,this.random,BIRD_FLIGHT.hawk!);
   if(t===1){this.state='travel';this.cooldown=55+this.random.next()*55;this.action=0;}
   return;
  }
  this.circle(dt,env,105+Math.sin(this.breathClock*.12)*8);
  if(this.decision>0)return;this.decision=1;
  if(this.cooldown>0||this.random.next()>.12)return;
  const prey=env.nearby(this.x,this.y,3).filter(n=>['squirrel','toad'].includes(n.kind)&&(n.altitude??0)<=.01&&Math.hypot(n.x-this.x,n.y-this.y)>.4)
   .sort((a,b)=>a.id.localeCompare(b.id))[0];
  if(!prey)return;
  this.routeX=this.x;this.routeY=this.y;this.routeHeight=this.altitude;this.action=0;this.state='dive';
  const angle=Math.atan2(prey.y-this.y,prey.x-this.x);
  this.target={x:prey.x+Math.cos(angle)*.45,y:prey.y+Math.sin(angle)*.45};
 }
 static read(r:BinaryReader):HawkAgent {return RaptorAgent.restoreRaptor(r,(...a)=>new HawkAgent(...a));}
}

/** Solitary scavenger: long ground meals at its retained bones, short circling trips. */
export class VultureAgent extends RaptorAgent {
 readonly kind='vulture';readonly type=62;
 constructor(id:string,x:number,y:number,seed:number){
  super(id,x,y,seed);this.homeX=x;this.homeY=y;this.radius=1.8;this.altitude=0;this.state='forage';
  this.timer=45+this.random.next()*55;this.previous=this.sample();
 }
 override update(dt:number,env:AgentEnvironment):void {
  this.tick(dt);
  if(this.state==='forage'){
   this.motor.stop();this.gait+=dt*.45*this.pace;
   const desired=Math.atan2(this.homeY-this.y,this.homeX+.16-this.x);
   this.heading+=clamp(angleDelta(this.heading,desired),-dt,dt);
   if(this.timer<=0){this.state='travel';this.timer=18+this.random.next()*14;this.orbit=this.heading;}
   return;
  }
  if(this.state==='land'){
   const d=Math.hypot(this.homeX-this.x,this.homeY-this.y);
   this.fly(dt,env,this.homeX,this.homeY,Math.min(72,d*45),.5);
   if(d<.025&&this.altitude<.5){this.x=this.homeX;this.y=this.homeY;this.altitude=0;this.state='forage';this.timer=50+this.random.next()*65;this.gait=0;this.motor.stop();}
   return;
  }
  this.circle(dt,env,72);
  if(this.timer<=0){this.state='land';}
 }
 static read(r:BinaryReader):VultureAgent {return RaptorAgent.restoreRaptor(r,(...a)=>new VultureAgent(...a));}
}
