import { BIRD_FLIGHT } from '../flight';
import { StartleResponse, FlightMotion, AgentRandom, BinaryReader, BinaryWriter, SpeedMotor, ease, herdIntent, type Agent, type AgentEnvironment } from '../../agents';
import { clamp, lerp, type Vec2 } from '../../iso/math';
import { angleDelta, TAU } from '../animation';
import type { EcoKind } from '../ecology';
export type WildlifeKind = EcoKind | 'toucan' | 'orangutan' | 'jaguar';
export type WildlifeState = 'rest' | 'travel' | 'chase' | 'climb' | 'swing' | 'surface' | 'run' | 'drink' | 'spray' | 'wrap' | 'coil' | 'unwrap' | 'descend' | 'swim' | 'hop' | 'forage' | 'rise' | 'stand' | 'pick' | 'lower' | 'graze';
const states: WildlifeState[] = ['rest','travel','chase','climb','swing','surface','run','drink','spray','wrap','coil','unwrap','descend','swim','hop','forage','rise','stand','pick','lower','graze'];
export interface WildlifeSample extends Vec2 { heading: number; gait: number; altitude: number; state: WildlifeState }
/** Common mechanics only; species decisions stay in concrete subclasses. */
export abstract class WildlifeAgent implements Agent {
  abstract readonly kind: WildlifeKind; abstract readonly type: number;
  startle=new StartleResponse();
  random: AgentRandom; motor = new SpeedMotor(); heading: number; gait = 0; altitude = 0; targetAltitude = 0;
  size: number; coat: number; juvenile = false; groupId = ''; leaderId = ''; motherId = '';
  state: WildlifeState = 'rest'; timer: number; cooldown = 0; decision = 0; target: Vec2; pace: number; tripPace=1; flight=new FlightMotion();
  territory: [number,number,number,number] = [-1e8,-1e8,1e8,1e8]; previous: WildlifeSample;
  constructor(readonly id: string, public x: number, public y: number, seed: number) {
    this.random = new AgentRandom(seed); this.heading = this.random.next()*TAU; this.size = .85 + this.random.next()*.3;
    this.coat = Math.floor(this.random.next()*3); this.pace = .85+this.random.next()*.3; this.timer = 3+this.random.next()*12;
    this.target = {x,y}; this.previous = this.sample();
  }
  get speed(): number { return this.motor.speed; }
  sample(): WildlifeSample { return {x:this.x,y:this.y,heading:this.heading,gait:this.gait,altitude:this.altitude,state:this.state}; }
  protected within(x:number,y:number): boolean { return x>this.territory[0]+.15 && y>this.territory[1]+.15 && x<this.territory[2]-.15 && y<this.territory[3]-.15; }
  protected clear(x:number,y:number,env:AgentEnvironment, flying=false): boolean {
    if(!this.within(x,y)) return false;
    if(flying) return true;
    const count=Math.ceil(Math.hypot(x-this.x,y-this.y)/.08);
    for(let i=1;i<=count;i++) if(!env.canMove(this.x+(x-this.x)*i/count,this.y+(y-this.y)*i/count)) return false;
    return true;
  }
  protected wander(env:AgentEnvironment, distance:number, canopy=false): boolean {
    const social = herdIntent(this,env.nearby(this.x,this.y,5));
    const perches = canopy ? env.perches?.(this.x,this.y,3)?.filter(p=>this.within(p.x,p.y) && Math.hypot(p.x-this.x,p.y-this.y)>.3) ?? [] : [];
    if(social && perches.length)perches.sort((a,b)=>Math.hypot(a.x-social.target.x,a.y-social.target.y)-Math.hypot(b.x-social.target.x,b.y-social.target.y));
    for(let i=0;i<18;i++) {
      const angle=this.random.next()*TAU, radius=.4+this.random.next()*distance;
      const perch=perches.length ? perches[Math.floor(this.random.next()*(social?Math.min(2,perches.length):perches.length))] : undefined;
      const target=perch ?? (social && i<5 ? social.target : undefined) ?? {x:this.x+Math.cos(angle)*radius,y:this.y+Math.sin(angle)*radius};
      if(this.clear(target.x,target.y,env,this.kind==='toucan')) {
        this.target={x:target.x,y:target.y}; this.targetAltitude=this.kind==='toucan' ? (perch?.height ?? 45) : 0;
        this.tripPace=.75+this.random.next()*.5; this.state='travel'; this.timer=30; return true;
      }
    }
    this.timer=2+this.random.next()*3; return false;
  }
  protected escapeClear(x:number,y:number,env:AgentEnvironment):boolean {return this.clear(x,y,env,this.kind==='toucan');}
  protected perceiveSplash(env:AgentEnvironment):void {
    if(env.hasStimuli===false||this.altitude>8||this.kind==='fish'||this.kind==='whale')return;
    if(!this.startle.sense(this,env.nearby(this.x,this.y,3)))return;
    this.state='rest';this.timer=3;this.motor.stop();
    for(const distance of [1.1,.6,.3])for(const offset of [0,.5,-.5,1,-1]){
      const angle=this.startle.heading+offset,x=this.x+Math.cos(angle)*distance,y=this.y+Math.sin(angle)*distance;
      if(!this.escapeClear(x,y,env))continue;
      this.target={x,y};this.tripPace=1.18;this.state=this.kind==='jaguar'||this.kind==='wolf'?'run':'travel';this.timer=15;
      if(['toucan','seagull','macaw','parakeet','kingfisher'].includes(this.kind))this.targetAltitude=Math.max(22,this.altitude);
      return;
    }
  }
  protected abstract decide(env:AgentEnvironment): void;
  update(dt:number,env:AgentEnvironment): void {
    this.startle.update(dt);
    Object.assign(this.previous,this.sample()); this.timer-=dt; this.cooldown=Math.max(0,this.cooldown-dt); this.decision-=dt;
    if(this.decision<=0) { this.decision=.2+this.pace*.08; this.perceiveSplash(env);if(this.startle.remaining<=0)this.decide(env); }
    if(this.state==='rest') { if(this.startle.remaining>0)this.heading+=clamp(angleDelta(this.heading,this.startle.heading),-dt*2.8,dt*2.8);this.motor.update(0,dt,1,5); this.gait+=dt*.22*this.pace; return; }
    if(this.state==='climb') {
      const desired=Math.atan2(this.target.y-this.y,this.target.x-this.x);this.heading+=clamp(angleDelta(this.heading,desired),-dt*2,dt*2);
      this.altitude=ease(this.altitude,this.targetAltitude,1.4,dt); this.gait+=dt*.65*this.pace;
      if(Math.abs(this.altitude-this.targetAltitude)<.4) {this.altitude=this.targetAltitude; this.state='rest'; this.timer=8+this.random.next()*12;}
      return;
    }
    const dx=this.target.x-this.x,dy=this.target.y-this.y,d=Math.hypot(dx,dy), desired=Math.atan2(dy,dx),delta=angleDelta(this.heading,desired);
    const bird=this.kind==='toucan', sprint=this.state==='chase'||this.state==='run';
    this.heading+=clamp(delta,-dt*(bird?4:2.8),dt*(bird?4:2.8));
    const cruise=(bird?.55:this.kind==='orangutan'?.095:sprint?1.22:.16)*this.pace*this.tripPace;
    const accel=sprint?3.8:bird?1.3:.55;
    this.motor.update(Math.min(cruise,d/.22,Math.sqrt(2*accel*d)*.7)*Math.max(0,Math.cos(delta)),dt,accel,sprint?24:6);
    const step=Math.min(d,this.speed*dt),x=this.x+Math.cos(this.heading)*step,y=this.y+Math.sin(this.heading)*step;
    if(this.within(x,y) && (bird||env.canMove(x,y))) {this.x=x;this.y=y;if(!bird)this.gait+=step/((sprint?.43:this.kind==='orangutan'?.16:.18)*this.size);}
    else {this.motor.stop(); this.state='rest';this.timer=1;}
    if(bird){
      this.gait=this.flight.advance(this.gait,dt,this.targetAltitude-this.altitude,this.pace*this.tripPace,this.random,BIRD_FLIGHT.toucan!);
      this.altitude=ease(this.altitude,this.targetAltitude+this.flight.lift*Math.min(1,d/.4),.45,dt);
    }
    if(d<.015 || this.timer<=0) {if(this.state==='chase')this.cooldown=30;this.motor.stop();this.state='rest';this.timer=5+this.random.next()*12; if(bird)this.altitude=this.targetAltitude;}
  }
  write(w:BinaryWriter):void {
    w.string(this.id);w.u32(this.random.state);w.string(this.groupId);w.string(this.leaderId);w.string(this.motherId);w.u8(Number(this.juvenile));w.u8(this.coat);w.u8(states.indexOf(this.state));w.u8(states.indexOf(this.previous.state));
    this.flight.write(w);this.startle.write(w);w.f64(this.tripPace);
    for(const n of [this.x,this.y,this.heading,this.gait,this.altitude,this.targetAltitude,this.size,this.timer,this.cooldown,this.decision,this.target.x,this.target.y,this.pace,this.speed,this.motor.acceleration,...this.territory,this.previous.x,this.previous.y,this.previous.heading,this.previous.gait,this.previous.altitude]) w.f64(n);
  }
  static restore<T extends WildlifeAgent>(r:BinaryReader, create:(id:string,x:number,y:number,seed:number)=>T):T {
    const id=r.string(),seed=r.u32(),group=r.string(),leader=r.string(),mother=r.string(),young=r.u8(),coat=r.u8(),state=states[r.u8()],previousState=states[r.u8()];
    if(young>1||coat>2||!state||!previousState)throw new Error('Invalid wildlife state');
    const flight=new FlightMotion();flight.read(r);const startle=new StartleResponse();startle.read(r);const tripPace=r.f64();
    const a=create(id,r.f64(),r.f64(),seed);a.flight=flight;a.startle=startle;a.tripPace=tripPace;a.random.state=seed;a.groupId=group;a.leaderId=leader;a.motherId=mother;a.juvenile=Boolean(young);a.coat=coat;a.state=state;
    a.heading=r.f64();a.gait=r.f64();a.altitude=r.f64();a.targetAltitude=r.f64();a.size=r.f64();a.timer=r.f64();a.cooldown=r.f64();a.decision=r.f64();a.target={x:r.f64(),y:r.f64()};a.pace=r.f64();a.motor.speed=r.f64();a.motor.acceleration=r.f64();a.territory=[r.f64(),r.f64(),r.f64(),r.f64()];
    a.previous={x:r.f64(),y:r.f64(),heading:r.f64(),gait:r.f64(),altitude:r.f64(),state:previousState};return a;
  }
}
export class ToucanAgent extends WildlifeAgent {
  readonly kind='toucan';readonly type=30;
  protected decide(env:AgentEnvironment):void {
    const social=herdIntent(this,env.nearby(this.x,this.y,5));
    if(this.state==='rest' && (this.timer<=0 || (social?.moving && Math.hypot(social.target.x-this.x,social.target.y-this.y)>.7))) this.wander(env,2.4,true);
  }
  static read(r:BinaryReader):ToucanAgent{return WildlifeAgent.restore(r,(...args)=>new ToucanAgent(...args));}
}
export class OrangutanAgent extends WildlifeAgent {
  readonly kind='orangutan';readonly type=31;
  protected decide(env:AgentEnvironment):void {
    if(this.state!=='rest'||this.timer>0)return;
    if(this.altitude>1){this.targetAltitude=0;this.state='climb';return;}
    const trees=env.perches?.(this.x,this.y,.5)??[];
    if(trees.length && this.random.next()<.6){this.target={x:trees[0]!.x-.17,y:trees[0]!.y};this.targetAltitude=trees[0]!.height*.7;this.state='climb';return;}
    this.wander(env,1.2,true);
  }
  static read(r:BinaryReader):OrangutanAgent{return WildlifeAgent.restore(r,(...args)=>new OrangutanAgent(...args));}
}
export class JaguarAgent extends WildlifeAgent {
  readonly kind='jaguar';readonly type=32;
  protected decide(env:AgentEnvironment):void {
    if(this.state==='chase' && (this.timer<=.3||this.cooldown>0)){this.state='rest';this.timer=6;this.cooldown=25+this.random.next()*20;return;}
    if(this.cooldown===0) {
      const prey=env.nearby(this.x,this.y,2.8).filter(n=>n.kind==='deer'&&this.clear(n.x,n.y,env)).sort((a,b)=>Math.hypot(a.x-this.x,a.y-this.y)-Math.hypot(b.x-this.x,b.y-this.y)||a.id.localeCompare(b.id))[0];
      if(prey && (this.state==='chase'||this.random.next()<.12)) {
        const distance=Math.hypot(prey.x-this.x,prey.y-this.y);
        if(distance<.28){this.state='rest';this.timer=5;this.cooldown=35;return;} // Non-contact encounters; no kills.
        this.target={x:prey.x,y:prey.y};if(this.state!=='chase'){this.timer=2.5+this.random.next()*1.5;this.state='chase';}return;
      }
    }
    if(this.state==='rest'&&this.timer<=0){
      const run=this.cooldown===0&&this.random.next()<.16;
      if(this.wander(env,run?2.4:1.6)&&run){this.state='run';this.cooldown=25+this.random.next()*25;}
    }
  }
  static read(r:BinaryReader):JaguarAgent{return WildlifeAgent.restore(r,(...args)=>new JaguarAgent(...args));}
}
export function sampleWildlife(a:WildlifeAgent,alpha:number):WildlifeSample {
  return {x:lerp(a.previous.x,a.x,alpha),y:lerp(a.previous.y,a.y,alpha),heading:a.previous.heading+angleDelta(a.previous.heading,a.heading)*alpha,
    gait:a.previous.state===a.state?lerp(a.previous.gait,a.gait,alpha):a.gait,altitude:lerp(a.previous.altitude,a.altitude,alpha),state:a.state};
}
