import { nearestThreat } from '../encounters';
import { BIRD_FLIGHT, CANOPY_BIRDS, crossingPerch } from '../flight';
import { BinaryReader, BinaryWriter, ease, herdIntent, type AgentEnvironment } from '../../agents';
import { clamp, lerp } from '../../iso/math';
import { angleDelta, TAU } from '../animation';
import { ECO_SPECS, habitatAllows, type EcoKind } from '../ecology';
import { WildlifeAgent } from './wildlife';
/** Shared transport for new habitats. Species-specific decisions remain below. */
export abstract class EcologicalAgent extends WildlifeAgent {
 abstract override readonly kind:EcoKind;
 routeX=0;routeY=0;routeHeight=0;routeProgress=0;routeDuration=1;
 breathClock=0;previousBreath=0;
 get spec(){return ECO_SPECS[this.kind];}
 get cycleSeconds(){return 42+this.pace*12;}
 protected allowed(x:number,y:number,env:AgentEnvironment):boolean {
  if(!this.within(x,y))return false;
  const mode=this.spec.mode,s=env.sample(x,y);
  if(s.refuge&&['tiger','wolf','blackBear','crocodile','boa'].includes(this.kind)&&this.pace>.86)return false;
  if(mode==='air')return this.kind==='seagull'?habitatAllows(this.kind,s):true;
  if(mode==='canopy')return this.altitude>1||(!s.water&&env.canMove(x,y));
  if(!habitatAllows(this.kind,s))return false;
  if(mode==='amphibious'&&!s.water&&!env.canMove(x,y))return false;
  if(mode==='ground'||mode==='shore'){
   if(!env.canMove(x,y))return false;
   const radius=this.kind==='elephant'?.23*this.size:this.kind==='giraffe'?.14:this.kind==='blackBear'?.15*this.size:this.kind==='bison'?.22*this.size:this.kind==='tiger'?.15*this.size:0;
   if(radius)for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]])if(!env.canMove(x+dx!*radius,y+dy!*radius))return false;
  }
  if(this.kind==='whale')for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]])if(!habitatAllows('whale',env.sample(x+dx!*.65,y+dy!*.65)))return false;
  return true;
 }
 protected routeClear(x:number,y:number,env:AgentEnvironment):boolean {
  const count=Math.ceil(Math.hypot(x-this.x,y-this.y)/.07);
  for(let i=1;i<=count;i++)if(!this.allowed(lerp(this.x,x,i/count),lerp(this.y,y,i/count),env))return false;
  return true;
 }
 protected journey(env:AgentEnvironment,perching=false):boolean {
  const social=herdIntent(this,env.nearby(this.x,this.y,4));
  const crossing=perching&&CANOPY_BIRDS.includes(this.kind)?crossingPerch(this.x,this.y,env,this.random,(x,y)=>this.within(x,y)):undefined;
  if(crossing){
   this.target={x:crossing.x,y:crossing.y};this.targetAltitude=crossing.height;
   this.tripPace=.85+this.random.next()*.35;this.state='travel';this.timer=30;return true;
  }
  const perches=perching?(env.perches?.(this.x,this.y,this.spec.range)??[]).filter(p=>this.within(p.x,p.y)&&Math.hypot(p.x-this.x,p.y-this.y)>.18):[];
  if(social)perches.sort((a,b)=>Math.hypot(a.x-social.target.x,a.y-social.target.y)-Math.hypot(b.x-social.target.x,b.y-social.target.y));
  if(perching && !perches.length){this.timer=1+this.random.next();return false;}
  for(let attempt=0;attempt<24;attempt++){
   const angle=this.heading+(this.random.next()-.5)*(attempt<8?2:TAU),distance=.3+this.random.next()*this.spec.range;
   const perch=perches.length?perches[Math.floor(this.random.next()*(social?Math.min(3,perches.length):perches.length))]:undefined;
   const goal=perch??(social && attempt<8?{x:social.target.x+(this.random.next()-.5)*.3,y:social.target.y+(this.random.next()-.5)*.3}:{x:this.x+Math.cos(angle)*distance,y:this.y+Math.sin(angle)*distance});
   if(Math.hypot(goal.x-this.x,goal.y-this.y)<.15||!this.routeClear(goal.x,goal.y,env))continue;
   this.target={x:goal.x,y:goal.y};this.targetAltitude=perch?.height??(this.spec.mode==='air'?(env.sample(goal.x,goal.y).beach?0:28+this.random.next()*18):0);
   this.routeX=this.x;this.routeY=this.y;this.routeHeight=this.altitude;this.routeProgress=0;
   this.routeDuration=Math.max(1.2,Math.hypot(goal.x-this.x,goal.y-this.y)/(.6*this.pace));
   this.tripPace=.72+this.random.next()*.56;this.state='travel';this.timer=30;return true;
  }
  this.timer=.5+this.random.next()*2;return false;
 }
 /** Bounded non-contact flight response, owned entirely by the prey. */
 protected perceivePredator(env:AgentEnvironment):void {
  if(this.altitude>.01)return;
  const threat=nearestThreat(this.kind,this.x,this.y,env.nearby(this.x,this.y,2.2));
  if(!threat)return;
  this.startle.remaining=3;this.startle.heading=Math.atan2(this.y-threat.y,this.x-threat.x);
  for(const length of (this.kind==='toad'?[.55,.35,.2]:[1.5,.9,.45]))for(const offset of [0,.5,-.5,1,-1]){
   const angle=this.startle.heading+offset,x=this.x+Math.cos(angle)*length,y=this.y+Math.sin(angle)*length;
   if(!this.routeClear(x,y,env))continue;
   this.target={x,y};this.targetAltitude=0;this.state=this.kind==='zebra'?'run':'travel';this.timer=8;this.tripPace=this.kind==='squirrel'?1.8:1.25;
   if(this.kind==='toad'){this.state='hop';this.routeX=this.x;this.routeY=this.y;this.routeProgress=0;this.routeDuration=.45;}
   return;
  }
  this.motor.stop();this.state='rest';this.timer=1;
 }
 protected stationaryAction(_dt:number,_env:AgentEnvironment):boolean {return false;}
 protected override escapeClear(x:number,y:number,env:AgentEnvironment):boolean {return this.routeClear(x,y,env);}
 protected follow(env:AgentEnvironment,perching=false):void {
  if(this.state!=='rest')return;
  const intent=herdIntent(this,env.nearby(this.x,this.y,4));
  if(this.timer<=0||(intent?.moving && Math.hypot(intent.target.x-this.x,intent.target.y-this.y)>.65))this.journey(env,perching);
 }
 override update(dt:number,env:AgentEnvironment):void {
  this.startle.update(dt);
  Object.assign(this.previous,this.sample());this.previousBreath=this.breathClock;this.breathClock+=dt;
  this.timer-=dt;this.cooldown=Math.max(0,this.cooldown-dt);this.decision-=dt;
  if(this.decision<=0){this.decision=.2+this.pace*.09;this.perceiveSplash(env);this.perceivePredator(env);if(this.startle.remaining<=0&&!this.repose.active)this.decide(env);}
  if(this.repose.update(dt,this.random,this.startle.remaining>0)){this.motor.stop();return;}
  if(this.stationaryAction(dt,env))return;
  if(this.state==='swing'){
   this.routeProgress=Math.min(1,this.routeProgress+dt/this.routeDuration);
   const t=this.routeProgress,u=t*t*(3-2*t),arc=Math.sin(TAU*u);
   const dx=(this.target.x-this.routeX)*arc,dy=(this.target.y-this.routeY)*arc;
   const x=this.routeX+dx,y=this.routeY+dy,rope=24*this.size,horizontal=(dx-dy)*96;
   this.motor.speed=Math.hypot(x-this.x,y-this.y)/dt;this.x=x;this.y=y;
   // Constant-length pendulum in the fixed isometric view, anchored to one tree.
   this.altitude=this.routeHeight+(dx+dy)*48+rope-Math.sqrt(Math.max(0,rope*rope-horizontal*horizontal))
    +env.sample(this.routeX,this.routeY).elevation-env.sample(x,y).elevation;
   this.gait=t;
   if(t===1){this.x=this.routeX;this.y=this.routeY;this.altitude=this.routeHeight;this.motor.stop();this.state='rest';this.timer=25+this.random.next()*35;this.target={x:this.x,y:this.y};}
   return;
  }
  if(this.state==='climb'){
   this.motor.stop();this.x=ease(this.x,this.target.x,.5,dt);this.y=ease(this.y,this.target.y,.5,dt);
   this.altitude=ease(this.altitude,this.targetAltitude,1.3/this.pace,dt);this.gait+=dt*.65*this.pace;
   if(Math.abs(this.altitude-this.targetAltitude)<.3){this.altitude=this.targetAltitude;this.x=this.target.x;this.y=this.target.y;this.state='rest';this.timer=20+this.random.next()*35;}
   return;
  }
  if(this.state==='rest'){if(this.startle.remaining>0)this.heading+=clamp(angleDelta(this.heading,this.startle.heading),-dt*3,dt*3);this.motor.stop();this.gait+=dt*.25*this.pace;return;}
  const dx=this.target.x-this.x,dy=this.target.y-this.y,d=Math.hypot(dx,dy),desired=Math.atan2(dy,dx),turn=this.spec.mode==='water'?1.8:3;
  const delta=angleDelta(this.heading,desired);this.heading+=clamp(delta,-turn*dt,turn*dt);
  if((this.type>=53||this.kind==='elephant')&&Math.abs(delta)>.2){this.motor.stop();return;}
  const running=this.kind==='tiger'?this.state==='chase':(this.kind==='wolf'||this.kind==='boar'||this.kind==='zebra'||this.kind==='bison'||this.spec.runSpeed!==undefined)&&this.state==='run';
  const speed=(running?(this.spec.runSpeed??(this.kind==='bison'?.7:this.kind==='tiger'?1:.95)):this.state==='stalk'?.075:this.spec.speed)*this.pace*this.tripPace*(this.juvenile?.88:1)*(this.spec.mode==='air'?(this.flight.powered?1.08:.9):1),accel=running?2.6:this.kind==='elephant'?.22:this.spec.mode==='air'?1.5:.6;
  this.motor.update(Math.min(speed,d/.24,Math.sqrt(2*accel*d)*.65)*Math.max(0,Math.cos(delta)),dt,accel,accel*7);
  const step=Math.min(d,this.speed*dt),x=this.x+Math.cos(this.heading)*step,y=this.y+Math.sin(this.heading)*step;
  if(this.allowed(x,y,env)){this.x=x;this.y=y;if(this.spec.mode!=='air')this.gait+=step/((running?(this.spec.runStride??(this.kind==='boar'?.27:this.kind==='zebra'?.40:this.kind==='bison'?.40:this.kind==='tiger'?.38:.42)):this.spec.stride)*this.size);}
  else{this.motor.stop();this.state='rest';this.timer=.3;}
  if(this.spec.mode==='air'){
   this.gait=this.flight.advance(this.gait,dt,this.targetAltitude-this.altitude,this.pace*this.tripPace,this.random,BIRD_FLIGHT[this.kind]!);
   this.altitude=ease(this.altitude,this.targetAltitude+this.flight.lift*Math.min(1,d/.4),.55,dt);
  }
  if(d<.012||this.timer<=0){
   if(this.kind==='seagull'&&env.sample(this.x,this.y).water){this.timer=0;}
   else{this.motor.stop();this.state='rest';this.timer=this.spec.rest*(.5+this.random.next());if(this.spec.mode==='air')this.altitude=this.targetAltitude;}
  }
  if(this.kind==='fish')this.altitude=-2;
  if(this.kind==='whale'){
   const p=(this.breathClock%this.cycleSeconds)/this.cycleSeconds;
   const surface=p>.83?Math.sin((p-.83)/.17*Math.PI)**2:0;
   this.altitude=-12+surface*12;this.state=surface>.08?'surface':'travel';
   if(d<.02)this.timer=0;
  }
 }
 override write(w:BinaryWriter):void {super.write(w);for(const n of [this.routeX,this.routeY,this.routeHeight,this.routeProgress,this.routeDuration,this.breathClock,this.previousBreath])w.f64(n);}
 static readAs<T extends EcologicalAgent>(r:BinaryReader,create:(id:string,x:number,y:number,seed:number)=>T):T {
  const a=WildlifeAgent.restore(r,create);a.routeX=r.f64();a.routeY=r.f64();a.routeHeight=r.f64();a.routeProgress=r.f64();a.routeDuration=r.f64();a.breathClock=r.f64();a.previousBreath=r.f64();return a;
 }
}
