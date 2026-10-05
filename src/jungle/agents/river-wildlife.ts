import { BinaryReader, BinaryWriter, type AgentEnvironment } from '../../agents';
import { clamp, lerp } from '../../iso/math';
import { angleDelta, TAU } from '../animation';
import { EcologicalAgent } from './ecological-base';

/** Solitary ground forager with short, quick trips and residence on actual tree trunks. */
export class SquirrelAgent extends EcologicalAgent {
  readonly kind='squirrel'; readonly type=53;
  tryClimb(env:AgentEnvironment):boolean {
    const perches=[...(env.perches?.(this.x,this.y,1.3)??[])].sort((a,b)=>Math.hypot(a.x-this.x,a.y-this.y)-Math.hypot(b.x-this.x,b.y-this.y));
    for(const p of perches){
      if(!this.within(p.x,p.y)||!this.routeClear(p.x,p.y,env))continue;
      this.target={x:p.x,y:p.y};this.targetAltitude=Math.min(34,p.height*.55);
      this.routeX=p.x;this.routeY=p.y;this.state='travel';this.timer=12;return true;
    }
    return false;
  }
  protected override perceiveSplash(env:AgentEnvironment):void {if(this.altitude===0&&this.targetAltitude===0)super.perceiveSplash(env);}
  protected decide(env:AgentEnvironment):void {
    if(this.state!=='rest'||this.timer>0)return;
    if(this.cooldown===0&&(env.perches?.(this.x,this.y,.4)??[]).length){this.beginActivity(this.random.next()<.8?'feed':'groom',5);this.cooldown=22;return;}
    if(this.altitude>0){this.state='descend';this.targetAltitude=0;return;}
    if(!this.cooldown&&this.random.next()<.45&&this.tryClimb(env))return;
    this.targetAltitude=0;this.journey(env);this.timer=8;
  }
  protected override stationaryAction(dt:number,env:AgentEnvironment):boolean {
    if(this.state==='rest'&&this.targetAltitude>0&&this.altitude===0){
      if(Math.hypot(this.x-this.routeX,this.y-this.routeY)<.03){
        const turn=angleDelta(this.heading,Math.PI);this.motor.stop();
        this.heading+=clamp(turn,-dt*4,dt*4);
        if(Math.abs(turn)>.03)return true;
        this.state='climb';
      }
      else this.targetAltitude=0;
    }
    if(this.altitude>0&&!(env.perches?.(this.x,this.y,.2)??[]).length){this.state='descend';this.targetAltitude=0;}
    if(this.state!=='climb'&&this.state!=='descend')return false;
    this.motor.stop();const before=this.altitude;
    this.altitude+=clamp(this.targetAltitude-this.altitude,-dt*13*this.pace,dt*13*this.pace);
    this.gait+=Math.abs(this.altitude-before)/8;
    if(this.altitude===this.targetAltitude){this.state='rest';this.timer=this.altitude?8+this.random.next()*16:2+this.random.next()*3;if(!this.altitude)this.cooldown=30+this.random.next()*35;}
    return true;
  }
  static read(r:BinaryReader){return EcologicalAgent.readAs(r,(...a)=>new SquirrelAgent(...a));}
}

/** Territorial boar: root/amble, sometimes a short warning dash, then a long recovery. */
export class BoarAgent extends EcologicalAgent {
  readonly kind='boar'; readonly type=54;
  protected decide(env:AgentEnvironment):void {
    if(this.state!=='rest'||this.timer>0)return;
    if(!this.cooldown){
      const deer=env.nearby(this.x,this.y,1.9).filter(n=>n.kind==='deer').sort((a,b)=>a.id.localeCompare(b.id))[0];
      if(deer&&this.random.next()<.65){
        const distance=Math.hypot(deer.x-this.x,deer.y-this.y),fraction=Math.max(0,(distance-.5)/distance);
        const x=lerp(this.x,deer.x,fraction),y=lerp(this.y,deer.y,fraction);
        if(distance>.65&&this.routeClear(x,y,env)){this.target={x,y};this.state='run';this.timer=1.8;this.cooldown=32+this.random.next()*38;this.tripPace=1;return;}
      }
    }
    if(this.cooldown===0&&env.sample(this.x,this.y).moisture>.25&&this.random.next()<.65){
      this.beginFeeding(5+this.random.next()*7);return;
    }
    this.journey(env);
  }
  protected override stationaryAction(dt:number,env:AgentEnvironment):boolean {
    if(this.feedingAction(dt,.65,.75))return true;
    if(this.state==='run'&&env.nearby(this.x,this.y,.48).some(n=>n.kind==='deer')){
      this.motor.stop();this.state='rest';this.timer=8;return true;
    }
    return false;
  }
  static read(r:BinaryReader){return EcologicalAgent.readAs(r,(...a)=>new BoarAgent(...a));}
}

/** Shared shoreline transport; each species owns its timing, target policy and action. */
abstract class BankAgent extends EcologicalAgent {
  bankWet=false;bankTravel=false;
  override write(w:BinaryWriter):void{super.write(w);w.u8(Number(this.bankWet));w.u8(Number(this.bankTravel));}
  static readBank<T extends BankAgent>(r:BinaryReader,create:(id:string,x:number,y:number,seed:number)=>T):T{
    const a=EcologicalAgent.readAs(r,create),wet=r.u8(),travel=r.u8();if(wet>1||travel>1)throw new Error('Invalid bank transition');a.bankWet=Boolean(wet);a.bankTravel=Boolean(travel);return a;
  }

  protected crossBank(env:AgentEnvironment, range=this.spec.range):boolean {
    const water=env.sample(this.x,this.y).water;
    const supports=this.kind==='beaver'&&!water&&this.random.next()<.2?(env.perches?.(this.x,this.y,range)??[]):[];
    for(let i=0;i<48;i++){
      const angle=this.random.next()*TAU,distance=.2+this.random.next()*range;
      const tree=supports[i];
      const x=tree?tree.x+.12:this.x+Math.cos(angle)*distance,y=tree?tree.y:this.y+Math.sin(angle)*distance;
      if(i<32&&!tree&&env.sample(x,y).water===water)continue;
      if(Math.hypot(x-this.x,y-this.y)<.15||!this.routeClear(x,y,env))continue;
      this.target={x,y};this.routeX=this.x;this.routeY=this.y;this.routeProgress=0;
      this.routeDuration=.38+this.random.next()*.22;
      this.state=this.kind==='toad'?'hop':'travel';this.timer=25;return true;
    }
    this.timer=2+this.random.next()*4;return false;
  }
  protected override stationaryAction(dt:number,env:AgentEnvironment):boolean {
    if(this.kind==='toad'&&this.state==='hop'){
      this.motor.stop();const delta=angleDelta(this.heading,Math.atan2(this.target.y-this.y,this.target.x-this.x));
      if(!this.routeProgress&&Math.abs(delta)>.15){this.heading+=clamp(delta,-dt*4,dt*4);return true;}
      const t=Math.min(1,this.routeProgress+dt/this.routeDuration),u=t*t*(3-2*t);
      const x=lerp(this.routeX,this.target.x,u),y=lerp(this.routeY,this.target.y,u);
      if(!this.allowed(x,y,env)){this.state='rest';this.timer=3;this.altitude=0;return true;}
      this.x=x;this.y=y;this.routeProgress=t;this.gait=t;this.altitude=Math.sin(t*Math.PI)*6*this.size;
      if(t===1){this.altitude=0;this.state='rest';this.timer=2+this.random.next()*5;}
      return true;
    }
    const wet=env.sample(this.x,this.y).water;
    if(this.kind!=='toad'){
      if(!['enterWater','leaveWater'].includes(this.state)&&wet!==this.bankWet){this.bankTravel=this.state==='travel';this.state=wet?'enterWater':'leaveWater';this.gait=0;}
      if(this.state==='enterWater'||this.state==='leaveWater'){
        this.motor.stop();this.gait=Math.min(1,this.gait+dt/1.1);
        if(this.gait===1){this.bankWet=wet;this.state=this.bankTravel?'travel':'rest';this.gait=0;this.timer=this.bankTravel?20:8;}
        return true;
      }
    }
    this.altitude+=clamp((env.sample(this.x,this.y).water?-2:0)-this.altitude,-dt*2,dt*2);
    return false;
  }
}
/** Beaver alternates swimming with short bank trips toward woody cover. */
export class BeaverAgent extends BankAgent {
  readonly kind='beaver';readonly type=55;
  protected decide(env:AgentEnvironment):void {
    if(this.state!=='rest')return;
    const roots=(env.perches?.(this.x,this.y,1.2)??[]).slice(0,32).map(p=>p.root??p);
    if(!env.sample(this.x,this.y).water&&this.cooldown===0){
      const near=roots.find(p=>Math.hypot(p.x-this.x,p.y-this.y)<.38);
      if(near){this.routeX=near.x;this.routeY=near.y;this.beginFeeding(8+this.random.next()*9);return;}
      for(const root of roots){
        const angle=Math.atan2(this.y-root.y,this.x-root.x),x=root.x+Math.cos(angle)*.23,y=root.y+Math.sin(angle)*.23;
        if(env.sample(x,y).water||!this.routeClear(x,y,env))continue;
        this.target={x,y};this.state='travel';this.timer=15;return;
      }
    }
    if(this.timer<=0){if(!env.sample(this.x,this.y).water&&this.random.next()<.3){this.beginActivity('groom',6);return;}this.crossBank(env);}
  }
  protected override stationaryAction(dt:number,env:AgentEnvironment):boolean {
    if(this.state==='feedDown'&&this.gait===0){
      const delta=angleDelta(this.heading,Math.atan2(this.routeY-this.y,this.routeX-this.x));
      this.heading+=clamp(delta,-dt*3,dt*3);this.motor.stop();if(Math.abs(delta)>.06)return true;
    }
    if(this.feedingAction(dt,.6,1.1))return true;
    return super.stationaryAction(dt,env);
  }
  static read(r:BinaryReader){return BankAgent.readBank(r,(...a)=>new BeaverAgent(...a));}
}
/** Solitary crocodile basks for long intervals, then slips between bank and water. */
export class CrocodileAgent extends BankAgent {
  readonly kind='crocodile';readonly type=56;
  protected decide(env:AgentEnvironment):void {
    if(this.state!=='rest'||this.timer>0)return;
    if(!env.sample(this.x,this.y).water&&this.cooldown===0){
      const alert=env.nearby(this.x,this.y,1.5).some(n=>n.id!==this.id&&n.speed>.2);
      this.beginActivity(alert?'alert':'bask',alert?5:14);this.cooldown=24;return;
    }
    this.crossBank(env);
  }
  static read(r:BinaryReader){return BankAgent.readBank(r,(...a)=>new CrocodileAgent(...a));}
}
/** Short individually timed hops along and across pond/stream margins. */
export class ToadAgent extends BankAgent {
  readonly kind='toad';readonly type=57;
  protected override perceiveSplash(env:AgentEnvironment):void {
    // Never interrupt an airborne hop; water-resident toads ignore another splash.
    if(this.state==='hop'||env.sample(this.x,this.y).water)return;
    super.perceiveSplash(env);
    if(this.state==='travel'){
      this.state='hop';this.routeX=this.x;this.routeY=this.y;this.routeProgress=0;this.routeDuration=.55;
    }
  }
  protected override perceivePredator(env:AgentEnvironment):void {if(this.state!=='hop')super.perceivePredator(env);}
  protected decide(env:AgentEnvironment):void {
    if(this.state!=='rest'||this.timer>0)return;
    if(this.cooldown===0&&!env.sample(this.x,this.y).water&&env.sample(this.x,this.y).moisture>.3){this.beginActivity('feed',2.5);this.cooldown=15+this.random.next()*15;return;}
    this.crossBank(env);
  }
  static read(r:BinaryReader){return BankAgent.readBank(r,(...a)=>new ToadAgent(...a));}
}
