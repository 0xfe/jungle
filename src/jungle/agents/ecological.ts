import {drinkingSpot} from '../water-sites';
import {ELEPHANT_DRINK_SECONDS,ELEPHANT_SPRAY_SECONDS,ELEPHANT_MODEL_TO_TILE} from '../elephant-pose';
import { BIRD_FLIGHT } from '../flight';
import { BinaryReader, BinaryWriter, ease, herdIntent, type AgentEnvironment } from '../../agents';
import { clamp, lerp } from '../../iso/math';
import { angleDelta, TAU } from '../animation';
import { ECO_SPECS, MONKEY_GRIP_Z, habitatAllows, type EcoKind } from '../ecology';
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
  if(mode==='air')return this.kind==='seagull'?habitatAllows(this.kind,s):true;
  if(mode==='canopy')return this.altitude>1||(!s.water&&env.canMove(x,y));
  if(!habitatAllows(this.kind,s))return false;
  if(mode==='ground'||mode==='shore'){
   if(!env.canMove(x,y))return false;
   const radius=this.kind==='elephant'?.23*this.size:this.kind==='giraffe'?.14:0;
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
  if(this.decision<=0){this.decision=.2+this.pace*.09;this.perceiveSplash(env);if(this.startle.remaining<=0)this.decide(env);}
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
  const running=this.kind==='wolf'&&this.state==='run';
  const speed=(running?.95:this.spec.speed)*this.pace*this.tripPace*(this.juvenile?.88:1)*(this.spec.mode==='air'?(this.flight.powered?1.08:.9):1),accel=running?2.6:this.kind==='elephant'?.22:this.spec.mode==='air'?1.5:.6;
  this.motor.update(Math.min(speed,d/.24,Math.sqrt(2*accel*d)*.65)*Math.max(0,Math.cos(delta)),dt,accel,accel*7);
  const step=Math.min(d,this.speed*dt),x=this.x+Math.cos(this.heading)*step,y=this.y+Math.sin(this.heading)*step;
  if(this.allowed(x,y,env)){this.x=x;this.y=y;if(this.spec.mode!=='air')this.gait+=step/((running?.42:this.spec.stride)*this.size);}
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
/** Mostly foraging/resting or climbing; rare short, supported swings at one tree. */
export class MonkeyAgent extends EcologicalAgent {
 readonly kind='monkey';readonly type=40;
 get gripHeight(){return MONKEY_GRIP_Z*this.spec.cameraScale*Math.sqrt(.75)*this.size;}
 trySwing(e:AgentEnvironment):boolean {
  if(this.altitude<8||this.cooldown>0)return false;
  const host=(e.perches?.(this.x,this.y,.38)??[]).find(p=>Math.hypot(p.x-this.x,p.y-this.y)<.28);
  if(!host||e.nearby(this.x,this.y,1).some(a=>a.id!==this.id&&a.kind==='monkey'&&a.speed>.1))return false;
  const angle=this.random.next()*TAU,dx=Math.cos(angle),dy=Math.sin(angle),rope=24*this.size;
  const radius=Math.min(.20,rope*.65/(96*Math.abs(dx-dy)+1));
  for(const sign of [-1,1])if(!this.within(this.x+dx*radius*sign,this.y+dy*radius*sign)||e.sample(this.x+dx*radius*sign,this.y+dy*radius*sign).water)return false;
  this.routeX=this.x;this.routeY=this.y;this.routeHeight=this.altitude;
  this.target={x:this.x+dx*radius,y:this.y+dy*radius};this.routeProgress=0;this.routeDuration=(2.8+this.random.next()*.8)/this.pace;
  this.heading=angle;this.state='swing';this.gait=0;this.cooldown=60+this.random.next()*60;
  return true;
 }
 protected decide(e:AgentEnvironment){
  if(this.state!=='rest'||this.timer>0)return;
  if(this.altitude>1){
   if(this.random.next()<.24&&this.trySwing(e))return;
   if(this.random.next()<.55){this.state='climb';this.targetAltitude=0;this.target={x:this.x,y:this.y};}
   else this.timer=20+this.random.next()*35;
   return;
  }
  const tree=(e.perches?.(this.x,this.y,.3)??[]).find(p=>Math.hypot(p.x-this.x,p.y-this.y)<.3&&this.within(p.x+.11,p.y)&&!e.sample(p.x,p.y).water);
  if(tree&&this.random.next()<.55){
   this.target={x:tree.x+.11,y:tree.y};this.targetAltitude=Math.max(12,tree.height-this.gripHeight-24*this.size);
   this.state='climb';return;
  }
  this.journey(e);
 }
 static read(r:BinaryReader){return EcologicalAgent.readAs(r,(...a)=>new MonkeyAgent(...a));}
}
/** Loose family packs: adults explore, young follow parents, stragglers catch up. */
export class WolfAgent extends EcologicalAgent {
 readonly kind='wolf';readonly type=41;
 protected decide(e:AgentEnvironment){
  const peers=e.nearby(this.x,this.y,5).filter(n=>n.id!==this.id&&n.groupId===this.groupId);
  const intent=herdIntent(this,peers),guide=peers.find(n=>n.id===(this.motherId||this.leaderId));
  const gap=intent?Math.hypot(intent.target.x-this.x,intent.target.y-this.y):0;
  if(guide&&intent){
   // Refresh a moving destination, rather than following where a parent used to be.
   if(gap>(this.state==='rest'?.38:.16)&&this.routeClear(intent.target.x,intent.target.y,e)){
    const starting=this.state==='rest';this.target={...intent.target};this.timer=30;
    if(starting)this.tripPace=.85+this.random.next()*.3;
    const hurry=gap>1.05||(guide.speed>.42&&gap>.32);
    this.state=hurry||(this.state==='run'&&gap>.55)?'run':'travel';
   }
   if(this.state==='rest'&&this.timer<=0&&gap>.5)this.journey(e);
   // A resting family stays together, with independent breathing/looking phases.
   return;
  }
  const spread=peers.reduce((d,n)=>Math.max(d,Math.hypot(n.x-this.x,n.y-this.y)),0);
  if(this.state==='run'&&spread>1.65)this.state='travel';
  if(this.state!=='rest')return;
  if(spread>1.8&&intent){if(this.journey(e))this.state='travel';return;}
  if(this.timer<=0){
   const run=this.cooldown===0&&spread<1.25&&this.random.next()<.24;
   if(this.journey(e)&&run){this.state='run';this.cooldown=18+this.random.next()*24;}
  }
 }
 static read(r:BinaryReader){return EcologicalAgent.readAs(r,(...a)=>new WolfAgent(...a));}
}
export class GiraffeAgent extends EcologicalAgent {readonly kind='giraffe';readonly type=42;protected decide(e:AgentEnvironment){this.follow(e);}static read(r:BinaryReader){return EcologicalAgent.readAs(r,(...a)=>new GiraffeAgent(...a));}}
/** Water-seeking family member; the trunk is filled before either drinking or play. */
export class ElephantAgent extends EcologicalAgent {
 readonly kind='elephant';readonly type=43;
 thirst=.65;waterSearch=0;waterX=0;waterY=0;waterKnown=false;loaded=false;sprayX=0;sprayY=0;
 get stimulus(){return this.state==='spray'&&this.loaded&&this.gait>.48&&this.gait<.9?{kind:'splash' as const,x:this.sprayX,y:this.sprayY,radius:.34}:undefined;}
 protected decide(e:AgentEnvironment){
  if(this.state!=='rest')return;
  if(this.waterKnown&&this.thirst>.4){
   const reach=Math.hypot(this.waterX-this.x,this.waterY-this.y);
   if(reach<1.95*ELEPHANT_MODEL_TO_TILE*this.size+.03&&e.sample(this.waterX,this.waterY).water){
    this.state='drink';this.gait=0;this.loaded=false;this.motor.stop();return;
   }
  }
  if(this.waterSearch<=0&&this.thirst>.4){
   this.waterSearch=8+this.random.next()*8;
   const spot=drinkingSpot(this,this.size,e,(x,y)=>this.allowed(x,y,e),(x,y)=>this.routeClear(x,y,e));
   if(spot){
    this.waterKnown=true;this.waterX=spot.waterX;this.waterY=spot.waterY;
    this.target={x:spot.x,y:spot.y};this.tripPace=.8+this.random.next()*.3;
    if(Math.hypot(spot.x-this.x,spot.y-this.y)>.02){this.state='travel';this.timer=40;}
    else {this.state='drink';this.gait=0;this.loaded=false;}
    return;
   }
  }
  // Rest longer at the water's edge; ordinary family following still applies.
  this.follow(e);
 }
 protected override stationaryAction(dt:number,e:AgentEnvironment):boolean {
  this.thirst=Math.min(1,this.thirst+dt/85);this.waterSearch=Math.max(0,this.waterSearch-dt);
  if(this.state!=='drink'&&this.state!=='spray')return false;
  const spraying=this.state==='spray',target=spraying?{x:this.sprayX,y:this.sprayY}:{x:this.waterX,y:this.waterY};
  this.motor.stop();
  const desired=Math.atan2(target.y-this.y,target.x-this.x),delta=angleDelta(this.heading,desired);
  this.heading+=clamp(delta,-dt*1.3,dt*1.3);
  if(Math.abs(delta)>.035)return true; // Align while planted, then articulate the trunk.
  if(!spraying&&!e.sample(this.waterX,this.waterY).water){this.waterKnown=false;this.state='rest';this.timer=2;return true;}
  const before=this.gait;this.gait=Math.min(1,this.gait+dt*this.pace/(spraying?ELEPHANT_SPRAY_SECONDS:ELEPHANT_DRINK_SECONDS));
  if(!spraying&&this.gait>=.25&&this.gait<.42)this.loaded=true;
  if(!spraying&&before<.42&&this.gait>=.42&&this.loaded&&this.cooldown===0){
   const targets=e.nearby(this.x,this.y,1.5).filter(a=>a.id!==this.id&&(a.altitude??0)<8&&a.kind!=='fish'&&a.kind!=='whale'&&Math.hypot(a.x-this.x,a.y-this.y)>.4).sort((a,b)=>a.id.localeCompare(b.id));
   if(targets.length&&this.random.next()<.5){
    const other=targets[Math.floor(this.random.next()*targets.length)]!;
    this.sprayX=other.x;this.sprayY=other.y;this.state='spray';this.gait=0;this.cooldown=28+this.random.next()*28;return true;
   }
  }
  if(!spraying&&this.gait>=.78){this.thirst=.05;this.loaded=false;}
  if(this.gait>=1){this.loaded=false;this.state='rest';this.timer=spraying?2:16+this.random.next()*16;}
  return true;
 }
 override write(w:BinaryWriter):void {
  super.write(w);w.u8(Number(this.waterKnown));w.u8(Number(this.loaded));
  for(const n of [this.thirst,this.waterSearch,this.waterX,this.waterY,this.sprayX,this.sprayY])w.f64(n);
 }
 static read(r:BinaryReader){
  const a=EcologicalAgent.readAs(r,(...args)=>new ElephantAgent(...args)),known=r.u8(),loaded=r.u8();
  if(known>1||loaded>1)throw new Error('Invalid elephant water state');a.waterKnown=Boolean(known);a.loaded=Boolean(loaded);
  a.thirst=r.f64();a.waterSearch=r.f64();a.waterX=r.f64();a.waterY=r.f64();a.sprayX=r.f64();a.sprayY=r.f64();return a;
 }
}
export class CrabAgent extends EcologicalAgent {readonly kind='crab';readonly type=44;protected decide(e:AgentEnvironment){
 if(this.state==='rest'&&this.timer<=0)this.journey(e);
 }static read(r:BinaryReader){return EcologicalAgent.readAs(r,(...a)=>new CrabAgent(...a));}}
export class SeagullAgent extends EcologicalAgent {readonly kind='seagull';readonly type=45;protected decide(e:AgentEnvironment){
 if(this.timer<=0&&this.state==='travel')this.journey(e);this.follow(e);if(this.state==='rest'&&e.sample(this.x,this.y).water){this.timer=0;this.journey(e);}else if(this.state==='rest')this.altitude=ease(this.altitude,0,1,.28);
 }static read(r:BinaryReader){return EcologicalAgent.readAs(r,(...a)=>new SeagullAgent(...a));}}
export class FishAgent extends EcologicalAgent {readonly kind='fish';readonly type=46;protected decide(e:AgentEnvironment){
 const intent=herdIntent(this,e.nearby(this.x,this.y,4));
 // Refresh a moving school target during travel; stale destinations split a school.
 if(intent && Math.hypot(intent.target.x-this.x,intent.target.y-this.y)>.25 && this.routeClear(intent.target.x,intent.target.y,e)){
  this.target={...intent.target};this.state='travel';this.timer=30;
 }else this.follow(e);
 }static read(r:BinaryReader){return EcologicalAgent.readAs(r,(...a)=>new FishAgent(...a));}}
export class WhaleAgent extends EcologicalAgent {readonly kind='whale';readonly type=47;protected decide(e:AgentEnvironment){
 if(this.timer<=0||this.state==='rest')this.journey(e);
 }static read(r:BinaryReader){return EcologicalAgent.readAs(r,(...a)=>new WhaleAgent(...a));}}
export class MacawAgent extends EcologicalAgent {readonly kind='macaw';readonly type=48;protected decide(e:AgentEnvironment){this.follow(e,true);}static read(r:BinaryReader){return EcologicalAgent.readAs(r,(...a)=>new MacawAgent(...a));}}
export class ParakeetAgent extends EcologicalAgent {readonly kind='parakeet';readonly type=49;protected decide(e:AgentEnvironment){this.follow(e,true);}static read(r:BinaryReader){return EcologicalAgent.readAs(r,(...a)=>new ParakeetAgent(...a));}}
export class KingfisherAgent extends EcologicalAgent {readonly kind='kingfisher';readonly type=50;protected decide(e:AgentEnvironment){this.follow(e,true);}static read(r:BinaryReader){return EcologicalAgent.readAs(r,(...a)=>new KingfisherAgent(...a));}}
export const ECO_CLASSES={monkey:MonkeyAgent,wolf:WolfAgent,giraffe:GiraffeAgent,elephant:ElephantAgent,crab:CrabAgent,seagull:SeagullAgent,fish:FishAgent,whale:WhaleAgent,macaw:MacawAgent,parakeet:ParakeetAgent,kingfisher:KingfisherAgent};
