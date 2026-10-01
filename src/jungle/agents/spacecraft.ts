import { AgentRandom, BinaryReader, BinaryWriter, type Agent, type AgentEnvironment } from '../../agents';
import { CONFIG } from '../../config';
import { clamp, lerp } from '../../iso/math';
import { SPACE_SPECS, VISITOR_STRIDE, type SpaceKind } from '../ecology';

const TAU = Math.PI * 2;
const angleDelta = (a:number,b:number) => Math.atan2(Math.sin(b-a),Math.cos(b-a));
const smooth = (t:number) => {t=clamp(t,0,1);return t*t*(3-2*t);};
const CREW_STATES = ['aboard','exit','walk','inspect','return'] as const;
const SHIP_STATES = ['waiting','approach','open','unload','explore','board','close','depart'] as const;
type CrewState = typeof CREW_STATES[number];
type ShipState = typeof SHIP_STATES[number];
interface CrewSample {x:number;y:number;heading:number;gait:number;gesture:number;visibility:number}
interface ShipSample {altitude:number;hatch:number}
export interface SpaceEnvironment extends AgentEnvironment {
  /** Static terrain/canopy admission. Moving occupants come from nearby's pre-update snapshot. */
  canLand(x:number,y:number):boolean;
}

/** A small independently seeded explorer. Its owning craft schedules exit/recall only;
 * each explorer owns targets, curiosity pauses, locomotion and previous presentation. */
export class AlienExplorer implements Agent {
  readonly random:AgentRandom;
  state:CrewState='aboard';
  heading=0; gait=0; gesture=0; speed=0; timer=0; visibility=0;
  size=1; role=0; slot=0; crewCount=4; shipX=0; shipY=0; shipHeading=0;
  targetX=0; targetY=0; previous:CrewSample;
  constructor(readonly id:string,public x:number,public y:number,seed:number,readonly vessel:SpaceKind) {
    this.random=new AgentRandom(seed); this.previous=this.sample();
  }
  get type():number {return SPACE_SPECS[this.vessel].alienType;}
  get kind():string {return SPACE_SPECS[this.vessel].alien;}
  sample():CrewSample {return {x:this.x,y:this.y,heading:this.heading,gait:this.gait,gesture:this.gesture,visibility:this.visibility};}
  presentation(alpha:number):CrewSample {
    const p=this.previous;
    return {x:lerp(p.x,this.x,alpha),y:lerp(p.y,this.y,alpha),heading:p.heading+angleDelta(p.heading,this.heading)*alpha,
      gait:lerp(p.gait,this.gait,alpha),gesture:lerp(p.gesture,this.gesture,alpha),visibility:lerp(p.visibility,this.visibility,alpha)};
  }
  get hatch():{x:number;y:number} {return {x:this.shipX+Math.cos(this.shipHeading)*.59,y:this.shipY+Math.sin(this.shipHeading)*.59};}
  /** Fan out ahead of the ramp; bounded sectors keep routes clear of the hull. */
  private investigate():void {
    const angle=this.shipHeading+(this.slot/(this.crewCount-1)-.5)*1.65+(this.random.next()-.5)*.15;
    const radius=.92+this.random.next()*.25;
    this.targetX=this.shipX+Math.cos(angle)*radius;this.targetY=this.shipY+Math.sin(angle)*radius;
    this.state='walk';
  }
  recall():void {if(this.state==='aboard')return;this.state='return';const h=this.hatch;this.targetX=h.x;this.targetY=h.y;this.timer=0;}
  update(dt:number,e:AgentEnvironment):void {
    this.previous=this.sample();
    if(this.state==='aboard'){this.speed=0;this.visibility=Math.max(0,this.visibility-dt*5);return;}
    if(this.state==='exit'&&this.timer>0){this.timer-=dt;return;}
    this.visibility=Math.min(1,this.visibility+dt*4);
    if(this.state==='inspect'){
      this.speed=0;this.gesture+=dt*(.45+this.role*.12);this.timer-=dt;
      if(this.timer<=0)this.investigate();
      return;
    }
    if(this.state==='exit')this.investigate();
    const dx=this.targetX-this.x,dy=this.targetY-this.y,distance=Math.hypot(dx,dy);
    if(distance<.015){
      this.speed=0;
      if(this.state==='return'){this.state='aboard';return;}
      this.state='inspect';this.timer=2+this.random.next()*3;this.gesture=this.role/3;return;
    }
    const desired=Math.atan2(dy,dx),turn=angleDelta(this.heading,desired);
    this.heading+=clamp(turn,-dt*3.2,dt*3.2);
    // Planted turns and distance-driven strides also hold when ground becomes blocked.
    if(Math.abs(turn)>.25){this.speed=0;return;}
    const cruise=(.16+this.slot*.009)*this.size;
    this.speed=Math.min(cruise,this.speed+dt*.6,Math.sqrt(distance*.7));
    const step=Math.min(distance,this.speed*dt),x=this.x+Math.cos(this.heading)*step,y=this.y+Math.sin(this.heading)*step;
    if(!e.canMove(x,y)||e.sample(x,y).water){this.speed=0;return;}
    this.x=x;this.y=y;this.gait+=step/(VISITOR_STRIDE*this.size);
  }
  write(w:BinaryWriter):void {
    w.string(this.id);w.u32(this.random.state);w.u8(CREW_STATES.indexOf(this.state));
    for(const n of [this.x,this.y,this.heading,this.gait,this.gesture,this.speed,this.timer,this.visibility,this.size,this.role,this.slot,this.crewCount,
      this.shipX,this.shipY,this.shipHeading,this.targetX,this.targetY,
      this.previous.x,this.previous.y,this.previous.heading,this.previous.gait,this.previous.gesture,this.previous.visibility])w.f64(n);
  }
  static decode(r:BinaryReader,vessel:SpaceKind):AlienExplorer {
    const id=r.string(),seed=r.u32(),state=CREW_STATES[r.u8()];if(!state)throw new Error('Invalid explorer state');
    const a=new ALIEN_CLASSES[vessel](id,r.f64(),r.f64(),seed);a.state=state;
    a.heading=r.f64();a.gait=r.f64();a.gesture=r.f64();a.speed=r.f64();a.timer=r.f64();a.visibility=r.f64();
    a.size=r.f64();a.role=r.f64();a.slot=r.f64();a.crewCount=r.f64();a.shipX=r.f64();a.shipY=r.f64();a.shipHeading=r.f64();a.targetX=r.f64();a.targetY=r.f64();
    a.previous={x:r.f64(),y:r.f64(),heading:r.f64(),gait:r.f64(),gesture:r.f64(),visibility:r.f64()};
    if(a.size<=0||a.size>2||a.crewCount<4||a.crewCount>6||!Number.isInteger(a.slot)||a.slot<0||a.slot>=a.crewCount||a.role<0||a.role>2)throw new Error('Invalid explorer traits');
    return a;
  }
}
export class SproutExplorer extends AlienExplorer {
  constructor(id:string,x:number,y:number,seed:number){super(id,x,y,seed,'saucer');}
  static read(r:BinaryReader):SproutExplorer{return AlienExplorer.decode(r,'saucer');}
}
export class EmberExplorer extends AlienExplorer {
  constructor(id:string,x:number,y:number,seed:number){super(id,x,y,seed,'lander');}
  static read(r:BinaryReader):EmberExplorer{return AlienExplorer.decode(r,'lander');}
}
export class ReedExplorer extends AlienExplorer {
  constructor(id:string,x:number,y:number,seed:number){super(id,x,y,seed,'scout');}
  static read(r:BinaryReader):ReedExplorer{return AlienExplorer.decode(r,'scout');}
}
export const ALIEN_CLASSES={saucer:SproutExplorer,lander:EmberExplorer,scout:ReedExplorer};

/** One bounded encounter owns its crew, so chunk sleep/eviction cannot strand explorers.
 * A ship waits invisibly between visits and selects a different safe site for each arrival. */
export class SpacecraftAgent implements Agent {
  readonly random:AgentRandom;
  state:ShipState='waiting'; elapsed=0; timer:number; heading=0; altitude=420; hatch=0; landings=0;
  previous:ShipSample={altitude:420,hatch:0}; crew:AlienExplorer[]=[];
  readonly ownerX:number; readonly ownerY:number;
  constructor(readonly id:string,public x:number,public y:number,seed:number,readonly kind:SpaceKind) {
    this.ownerX=Math.floor(x/4);this.ownerY=Math.floor(y/4);this.random=new AgentRandom(seed);
    const c=CONFIG.world.spacecraft;this.timer=c.arrivalMinSeconds+this.random.next()*(c.arrivalMaxSeconds-c.arrivalMinSeconds);
  }
  get type():number {return SPACE_SPECS[this.kind].type;}
  get radius():number {return SPACE_SPECS[this.kind].radius;}
  get speed():number|undefined {return this.state==='waiting'?undefined:0;}
  get blocksGround():boolean {return this.state!=='waiting'&&this.altitude<65;}
  /** Bounded search entirely inside the owner chunk, with room for every explorer. */
  chooseSite(canLand:(x:number,y:number)=>boolean):boolean {
    for(let i=0;i<24;i++){
      const x=this.ownerX*4+1.35+this.random.next()*1.3,y=this.ownerY*4+1.35+this.random.next()*1.3;
      if(this.landings>0&&Math.hypot(x-this.x,y-this.y)<.4)continue;
      if(!canLand(x,y))continue;
      this.x=x;this.y=y;return true;
    }
    return false;
  }
  /** Begin flight only after the caller has accepted a clear site. */
  beginApproach():void {
    this.heading=Math.floor(this.random.next()*8)*TAU/8;this.crew=[];this.altitude=420;
    this.hatch=0;this.previous={altitude:420,hatch:0};this.enter('approach');
  }
  private enter(state:ShipState):void {this.state=state;this.elapsed=0;}
  private unoccupied(e:AgentEnvironment,x=this.x,y=this.y):boolean {
    // Wildlife at the outer exploration margin may coexist with visitors. Reserve
    // the hull/ramp plus a body margin, not the whole disk used for terrain checks.
    return !e.nearby(x,y,this.radius+.3).some(n=>n.id!==this.id&&(n.altitude??0)<45);
  }
  private prepareCrew():void {
    const count=4+Math.floor(this.random.next()*3),C=ALIEN_CLASSES[this.kind];this.crew=[];
    for(let i=0;i<count;i++){
      const a=new C(`${this.id}:crew:${i}`,this.x+Math.cos(this.heading)*.59,this.y+Math.sin(this.heading)*.59,Math.floor(this.random.next()*0xffffffff));
      a.shipX=this.x;a.shipY=this.y;a.shipHeading=this.heading;a.heading=this.heading;
      a.slot=i;a.crewCount=count;a.size=.88+i*.035+this.random.next()*.035;a.role=i%3;a.state='exit';a.timer=i*.55;a.previous=a.sample();this.crew.push(a);
    }
  }
  presentation(alpha:number):{x:number;y:number;altitude:number;hatch:number} {
    const altitude=lerp(this.previous.altitude,this.altitude,alpha);
    // Oblique descent/ascent is presentation of the same reserved landing anchor.
    const drift=altitude*.004;
    return {x:this.x-Math.cos(this.heading)*drift,y:this.y-Math.sin(this.heading)*drift,
      altitude,hatch:lerp(this.previous.hatch,this.hatch,alpha)};
  }
  update(dt:number,environment:AgentEnvironment):void {
    const e=environment as SpaceEnvironment,c=CONFIG.world.spacecraft;
    this.previous={altitude:this.altitude,hatch:this.hatch};this.elapsed+=dt;
    if(this.state==='waiting'){
      this.timer-=dt;if(this.timer>0)return;
      if(!e.canLand||!this.chooseSite((x,y)=>e.canLand(x,y)&&this.unoccupied(e,x,y))){this.timer=18+this.random.next()*20;return;}
      this.beginApproach();return;
    }
    if(this.state==='approach'){
      this.altitude=420*(1-smooth(this.elapsed/6));
      if(this.altitude<85&&(!e.canLand(this.x,this.y)||!this.unoccupied(e))){this.enter('depart');return;}
      if(this.elapsed>=6){this.altitude=0;this.landings++;this.enter('open');}
    }else if(this.state==='open'){
      this.hatch=smooth(this.elapsed/1.2);
      if(this.elapsed>=1.2){this.hatch=1;this.prepareCrew();this.enter('unload');}
    }else if(this.state==='unload'||this.state==='explore'||this.state==='board'){
      for(const a of this.crew)a.update(dt,e);
      if(this.state==='unload'&&this.crew.every(a=>a.state!=='exit'&&Math.hypot(a.x-this.x,a.y-this.y)>.75)){
        this.timer=c.exploreMinSeconds+this.random.next()*(c.exploreMaxSeconds-c.exploreMinSeconds);this.enter('explore');
      }else if(this.state==='explore'){
        this.timer-=dt;if(this.timer<=0){for(const a of this.crew)a.recall();this.enter('board');}
      }else if(this.state==='board'&&this.crew.every(a=>a.state==='aboard'&&a.visibility===0))this.enter('close');
    }else if(this.state==='close'){
      this.hatch=1-smooth(this.elapsed/1.2);if(this.elapsed>=1.2){this.hatch=0;this.enter('depart');}
    }else if(this.state==='depart'){
      // Starting above the ground also handles an aborted approach without snapping down.
      this.altitude=Math.min(420,this.altitude+dt*(25+this.elapsed*28));
      if(this.altitude>=420){this.crew=[];this.enter('waiting');this.timer=c.returnMinSeconds+this.random.next()*(c.returnMaxSeconds-c.returnMinSeconds);}
    }
  }
  write(w:BinaryWriter):void {
    w.string(this.id);w.u32(this.random.state);w.u8(SHIP_STATES.indexOf(this.state));
    for(const n of [this.x,this.y,this.ownerX,this.ownerY,this.elapsed,this.timer,this.heading,this.altitude,this.hatch,this.landings,this.previous.altitude,this.previous.hatch])w.f64(n);
    w.u8(this.crew.length);for(const a of this.crew)a.write(w);
  }
  static decode(r:BinaryReader,kind:SpaceKind):SpacecraftAgent {
    const id=r.string(),seed=r.u32(),state=SHIP_STATES[r.u8()];if(!state)throw new Error('Invalid spacecraft state');
    const x=r.f64(),y=r.f64(),ownerX=r.f64(),ownerY=r.f64();
    const a=new SPACE_CLASSES[kind](id,x,y,seed);a.random.state=seed;a.state=state;
    if(a.ownerX!==ownerX||a.ownerY!==ownerY)throw new Error('Invalid spacecraft territory');
    a.elapsed=r.f64();a.timer=r.f64();a.heading=r.f64();a.altitude=r.f64();a.hatch=r.f64();a.landings=r.f64();a.previous={altitude:r.f64(),hatch:r.f64()};
    const count=r.u8();if(count>6)throw new Error('Spacecraft crew exceeds budget');
    for(let i=0;i<count;i++)a.crew.push(AlienExplorer.decode(r,kind));
    if(new Set(a.crew.map(c=>c.id)).size!==count||a.crew.some(c=>c.shipX!==a.x||c.shipY!==a.y||c.crewCount!==count))throw new Error('Invalid spacecraft crew');
    return a;
  }
}
export class SaucerAgent extends SpacecraftAgent {
  constructor(id:string,x:number,y:number,seed:number){super(id,x,y,seed,'saucer');}
  static read(r:BinaryReader):SaucerAgent{return SpacecraftAgent.decode(r,'saucer');}
}
export class LanderAgent extends SpacecraftAgent {
  constructor(id:string,x:number,y:number,seed:number){super(id,x,y,seed,'lander');}
  static read(r:BinaryReader):LanderAgent{return SpacecraftAgent.decode(r,'lander');}
}
export class ScoutAgent extends SpacecraftAgent {
  constructor(id:string,x:number,y:number,seed:number){super(id,x,y,seed,'scout');}
  static read(r:BinaryReader):ScoutAgent{return SpacecraftAgent.decode(r,'scout');}
}
export const SPACE_CLASSES={saucer:SaucerAgent,lander:LanderAgent,scout:ScoutAgent};
