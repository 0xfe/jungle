import {TigerAgent,HippoAgent,BisonAgent} from './megafauna';
export {TigerAgent,HippoAgent,BisonAgent} from './megafauna';
import {HawkAgent,VultureAgent} from './raptors';
export {HawkAgent,VultureAgent} from './raptors';
import {ZebraAgent} from './zebra';
export {ZebraAgent} from './zebra';
import { BlackBearAgent } from './black-bear';
export { BlackBearAgent } from './black-bear';
import { SquirrelAgent, BoarAgent, BeaverAgent, CrocodileAgent, ToadAgent } from './river-wildlife';
export * from './river-wildlife';
import {drinkingSpot} from '../water-sites';
import {ELEPHANT_DRINK_SECONDS,ELEPHANT_SPRAY_SECONDS,ELEPHANT_MODEL_TO_TILE} from '../elephant-pose';
import { BinaryReader, BinaryWriter, ease, herdIntent, type AgentEnvironment } from '../../agents';
import { clamp } from '../../iso/math';
import { angleDelta, TAU } from '../animation';
import { MONKEY_GRIP_Z } from '../ecology';
import { EcologicalAgent } from './ecological-base';
export { EcologicalAgent } from './ecological-base';
import { BoaAgent, SmallSnakeAgent } from './snakes';
export { BoaAgent, SmallSnakeAgent, SnakeAgent } from './snakes';
/** Mostly foraging/resting or climbing; rare short, supported swings at one tree. */
export class MonkeyAgent extends EcologicalAgent {
 readonly kind='monkey';readonly type=40;
 forageCooldown=0;
 override update(dt:number,e:AgentEnvironment):void{this.forageCooldown=Math.max(0,this.forageCooldown-dt);super.update(dt,e);}
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
  if(this.altitude===0&&this.targetAltitude>0&&Math.hypot(this.x-this.target.x,this.y-this.target.y)<.03){this.state='climb';return;}
  const supported=(e.perches?.(this.x,this.y,.4)??[]).some(p=>Math.hypot(p.x-this.x,p.y-this.y)<.35);
  if(this.forageCooldown===0&&supported){this.beginActivity(this.random.next()<.7?'feed':'groom',5+this.random.next()*3);this.forageCooldown=25;return;}
  const mother=e.nearby(this.x,this.y,.7).find(n=>n.id===this.motherId&&n.speed<.1);
  if(this.juvenile&&mother&&this.altitude===0&&this.forageCooldown===0){this.beginActivity('play',4);this.forageCooldown=35;return;}
  if(this.altitude>1){
   if(this.random.next()<.24&&this.trySwing(e))return;
   if(this.random.next()<.55){this.state='climb';this.targetAltitude=0;this.target={x:this.x,y:this.y};}
   else this.timer=20+this.random.next()*35;
   return;
  }
  const tree=(e.perches?.(this.x,this.y,.3)??[]).find(p=>Math.hypot(p.x-this.x,p.y-this.y)<.3&&this.within(p.x+.11,p.y)&&!e.sample(p.x,p.y).water);
  if(tree&&this.random.next()<.55){
   this.target={x:tree.x+.11,y:tree.y};this.targetAltitude=Math.max(12,tree.height-this.gripHeight-24*this.size);
   this.state='travel';this.timer=12;return;
  }
  this.journey(e);
 }
 override write(w:BinaryWriter):void{super.write(w);w.f64(this.forageCooldown);}
 static read(r:BinaryReader){const a=EcologicalAgent.readAs(r,(...a)=>new MonkeyAgent(...a));a.forageCooldown=r.f64();return a;}
}
/** Loose family packs: adults explore, young follow parents, stragglers catch up. */
export class WolfAgent extends EcologicalAgent {
 readonly kind='wolf';readonly type=41;
 protected decide(e:AgentEnvironment){
  const peers=e.nearby(this.x,this.y,5).filter(n=>n.id!==this.id&&n.groupId===this.groupId);
  const intent=herdIntent(this,peers),guide=peers.find(n=>n.id===(this.motherId||this.leaderId));
  const gap=intent?Math.hypot(intent.target.x-this.x,intent.target.y-this.y):0;
  if(this.state==='rest'&&this.timer<=0&&gap<.6&&this.cooldown===0){
   this.cooldown=18+this.random.next()*20;
   if(this.repose.cooldown===0&&this.random.next()<.3){this.repose.begin(this.random);return;}
   const action=this.juvenile&&guide&&guide.speed<.1?'play':this.random.next()<.55?'sniff':'groom';
   this.beginActivity(action,action==='play'?4:6);return;
  }
  if(['sniff','groom','play'].includes(this.state)){if(gap>1.2)this.gait=Math.max(.85,this.gait);return;}
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
import { GiraffeAgent } from './browsers';
export { GiraffeAgent } from './browsers';
/** Water-seeking family member; the trunk is filled before either drinking or play. */
export class ElephantAgent extends EcologicalAgent {
 readonly kind='elephant';readonly type=43;
 thirst=.65;waterSearch=0;waterX=0;waterY=0;waterKnown=false;loaded=false;sprayX=0;sprayY=0;
 get stimulus(){return this.state==='spray'&&this.loaded&&this.gait>.48&&this.gait<.9?{kind:'splash' as const,x:this.sprayX,y:this.sprayY,radius:.34}:undefined;}
 protected decide(e:AgentEnvironment){
  const family=this.groupId?e.nearby(this.x,this.y,5).filter(n=>n.id!==this.id&&n.groupId===this.groupId):[];
  // A mother pauses her water trip while calves catch up; she retains its destination.
  if(!this.juvenile&&family.some(n=>n.juvenile&&Math.hypot(n.x-this.x,n.y-this.y)>1.45)){
   if(this.state==='travel'){this.state='rest';this.motor.stop();this.timer=1;}return;
  }
  if(this.state!=='rest')return;
  if(this.routeProgress===1){
   this.routeProgress=0;
   if((e.perches?.(this.x,this.y,.9)??[]).some(p=>Math.hypot((p.root??p).x-this.routeX,(p.root??p).y-this.routeY)<.05)){
    this.beginActivity('feed',7);this.cooldown=20;return;
   }
  }
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
  if(this.thirst<.4&&this.cooldown===0&&this.timer<=0){
   for(const tree of (e.perches?.(this.x,this.y,1.4)??[]).slice(0,24)){
    const root=tree.root??tree,angle=Math.atan2(this.y-root.y,this.x-root.x),reach=.48*this.size;
    const x=root.x+Math.cos(angle)*reach,y=root.y+Math.sin(angle)*reach;
    if(!this.routeClear(x,y,e))continue;
    this.target={x,y};this.routeX=root.x;this.routeY=root.y;this.routeProgress=1;this.state='travel';this.timer=20;return;
   }
  }
  // Rest longer at the water's edge; ordinary family following still applies.
  this.follow(e);
 }
 protected override stationaryAction(dt:number,e:AgentEnvironment):boolean {
  this.thirst=Math.min(1,this.thirst+dt/85);this.waterSearch=Math.max(0,this.waterSearch-dt);
  if(this.state==='feed'&&this.gait===0){
   const delta=angleDelta(this.heading,Math.atan2(this.routeY-this.y,this.routeX-this.x));
   this.heading+=clamp(delta,-dt*1.3,dt*1.3);this.motor.stop();if(Math.abs(delta)>.04)return true;
  }
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
import { SeagullAgent, KingfisherAgent } from './shore-birds';
export { SeagullAgent, KingfisherAgent } from './shore-birds';
import { FishAgent,WhaleAgent } from './swimmers';
export { FishAgent,WhaleAgent } from './swimmers';
export class MacawAgent extends EcologicalAgent {readonly kind='macaw';readonly type=48;protected decide(e:AgentEnvironment){
 if(this.state==='rest'&&this.timer<=0&&this.cooldown===0&&this.altitude>8&&(e.perches?.(this.x,this.y,.15)??[]).length&&this.random.next()<.45){
  this.beginActivity(this.random.next()<.6?'preen':'feed',4+this.random.next()*3);this.cooldown=22+this.random.next()*20;return;
 }this.follow(e,true);
 }static read(r:BinaryReader){return EcologicalAgent.readAs(r,(...a)=>new MacawAgent(...a));}}
export class ParakeetAgent extends EcologicalAgent {readonly kind='parakeet';readonly type=49;protected decide(e:AgentEnvironment){
 if(this.state==='rest'&&this.timer<=0&&this.cooldown===0&&this.altitude>8&&(e.perches?.(this.x,this.y,.15)??[]).length&&this.random.next()<.45){
  this.beginActivity(this.random.next()<.6?'preen':'feed',4+this.random.next()*3);this.cooldown=22+this.random.next()*20;return;
 }this.follow(e,true);
 }static read(r:BinaryReader){return EcologicalAgent.readAs(r,(...a)=>new ParakeetAgent(...a));}}
export const ECO_CLASSES={tiger:TigerAgent,hippo:HippoAgent,bison:BisonAgent,hawk:HawkAgent,vulture:VultureAgent,zebra:ZebraAgent,blackBear:BlackBearAgent,squirrel:SquirrelAgent,boar:BoarAgent,beaver:BeaverAgent,crocodile:CrocodileAgent,toad:ToadAgent,boa:BoaAgent,smallSnake:SmallSnakeAgent,monkey:MonkeyAgent,wolf:WolfAgent,giraffe:GiraffeAgent,elephant:ElephantAgent,crab:CrabAgent,seagull:SeagullAgent,fish:FishAgent,whale:WhaleAgent,macaw:MacawAgent,parakeet:ParakeetAgent,kingfisher:KingfisherAgent};
