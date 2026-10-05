import { BinaryReader, BinaryWriter, type AgentEnvironment } from '../../agents';
import { clamp } from '../../iso/math';
import { angleDelta, TAU } from '../animation';
import { SNAKE_MODEL_TO_TILE, SNAKE_SUPPORT_OFFSET, SNAKE_WRAP_SECONDS } from '../snake-pose';
import { EcologicalAgent } from './ecological-base';

/** Slow serpentine transport. Resting/blocked bodies never continue a travel wave. */
export abstract class SnakeAgent extends EcologicalAgent {
  abstract override readonly kind: 'boa' | 'smallSnake';
  hasSupport = false;turnBend=0;previousTurnBend=0;
  supportX = 0; supportY = 0; supportHeading = 0;

  constructor(id: string, x: number, y: number, seed: number) {
    super(id, x, y, seed);
    this.size = .68 + this.random.next() * .55;
    this.timer = 8 + this.random.next() * 24;
  }

  /** Pick an actual trunk, approach its front edge, then wrap without teleporting. */
  protected seekSupport(env: AgentEnvironment): boolean {
    const supports = [...(env.perches?.(this.x, this.y, 1.7) ?? [])]
      .sort((a, b) => Math.hypot(a.x-this.x,a.y-this.y)-Math.hypot(b.x-this.x,b.y-this.y));
    for (const perch of supports) {
      // The jungle's perch anchor sits 0.17 tiles beside the rooted trunk.
      const x = perch.x - .17, y = perch.y;
      const heading = Math.atan2(this.y-y, this.x-x);
      const offset = SNAKE_SUPPORT_OFFSET * SNAKE_MODEL_TO_TILE * this.size;
      const goal = {x:x+Math.cos(heading)*offset, y:y+Math.sin(heading)*offset};
      if (!this.within(x,y) || env.sample(x,y).water || !this.routeClear(goal.x,goal.y,env)) continue;
      this.hasSupport = true; this.supportX = x; this.supportY = y; this.supportHeading = heading;
      this.target = goal; this.state = 'travel'; this.timer = 45; this.tripPace = .85;
      return true;
    }
    return false;
  }

  /** Bounded, cover-seeking routes; small snakes remain near their group's moving center. */
  protected forage(env: AgentEnvironment): void {
    const peers = this.groupId ? env.nearby(this.x,this.y,4).filter(a=>a.id!==this.id&&a.groupId===this.groupId) : [];
    const center = peers.length ? {x:peers.reduce((s,a)=>s+a.x,0)/peers.length,y:peers.reduce((s,a)=>s+a.y,0)/peers.length} : undefined;
    const supports = env.perches?.(this.x,this.y,this.spec.range) ?? [];
    for (let attempt=0; attempt<18; attempt++) {
      const angle = this.heading + (this.random.next()-.5)*TAU;
      const radius = .25 + this.random.next()*this.spec.range;
      const cover = supports.length ? supports[attempt%supports.length] : undefined;
      const base = center ?? cover ?? this;
      const x = base.x+Math.cos(angle)*radius, y = base.y+Math.sin(angle)*radius;
      if (Math.hypot(x-this.x,y-this.y)<.15 || !this.routeClear(x,y,env)) continue;
      this.target = {x,y}; this.state = 'travel'; this.timer = 40;
      this.tripPace = .75+this.random.next()*.4;
      return;
    }
    this.timer = 3+this.random.next()*5;
  }

  override update(dt: number, env: AgentEnvironment): void {
    Object.assign(this.previous,this.sample());this.previousTurnBend=this.turnBend;
    this.previousBreath = this.breathClock; this.breathClock += dt;
    this.timer -= dt; this.cooldown = Math.max(0,this.cooldown-dt); this.decision -= dt;
    this.startle.update(dt);
    if (this.decision<=0) {
      this.decision = .3+this.pace*.1;
      // A wrapped snake grips its tree instead of being pulled away by a splash.
      if (!this.hasSupport) this.perceiveSplash(env);
      if (this.startle.remaining<=0) this.decide(env);
    }
    if (this.state==='wrap' || this.state==='coil' || this.state==='unwrap') {
      this.motor.stop();
      const delta = angleDelta(this.heading,this.supportHeading);
      this.heading += clamp(delta,-dt*1.4,dt*1.4);
      if (Math.abs(delta)>.02) return;
      if (this.state==='coil') {
        if (this.timer<=0) {this.state='unwrap';this.gait=0;}
        return;
      }
      this.gait = Math.min(1,this.gait+dt*this.pace/SNAKE_WRAP_SECONDS);
      if (this.gait===1) {
        if (this.state==='wrap') {this.state='coil';this.gait=0;this.timer=22+this.random.next()*38;}
        else {this.state='rest';this.gait=0;this.hasSupport=false;this.cooldown=45+this.random.next()*50;this.timer=3;}
      }
      return;
    }
    if(this.quietActivity(dt))return;
    if (this.state==='rest') {this.motor.stop();return;}
    const dx=this.target.x-this.x,dy=this.target.y-this.y,distance=Math.hypot(dx,dy);
    if (distance<.012 || this.timer<=0) {
      this.motor.stop();
      if (this.hasSupport && distance<.012) {
        // Turn while planted before selecting the supported wrap clip.
        const delta=angleDelta(this.heading,this.supportHeading);
        this.heading+=clamp(delta,-dt*1.4,dt*1.4);
        if(Math.abs(delta)<.02){this.x=this.target.x;this.y=this.target.y;this.state='wrap';this.gait=0;}
      } else {this.hasSupport=false;this.state='rest';this.timer=this.spec.rest*(.7+this.random.next());}
      return;
    }
    const delta=angleDelta(this.heading,Math.atan2(dy,dx));
    this.heading+=clamp(delta,-dt*1.5,dt*1.5);
    // The head leads a supported body bend while the root stays planted.
    const wanted=Math.abs(delta)>.16?Math.min(1,Math.abs(delta)/.8):0;
    this.turnBend+=clamp(wanted-this.turnBend,-dt*2,dt*2);
    if(wanted||this.turnBend>.001){this.state=delta>=0?'turnLeft':'turnRight';this.motor.stop();return;}
    if(this.state==='turnLeft'||this.state==='turnRight'){this.state='travel';this.turnBend=0;}
    const acceleration=.22,cruise=this.spec.speed*this.pace*this.tripPace;
    this.motor.update(Math.min(cruise,distance/.35,Math.sqrt(2*acceleration*distance)*.65),dt,acceleration,1.2);
    const step=Math.min(distance,this.speed*dt),x=this.x+Math.cos(this.heading)*step,y=this.y+Math.sin(this.heading)*step;
    if (!this.allowed(x,y,env)) {this.motor.stop();this.hasSupport=false;this.state='rest';this.timer=3;return;}
    this.x=x;this.y=y;this.gait+=step/(this.spec.stride*this.size);
  }

  override write(w: BinaryWriter): void {
    super.write(w);w.u8(Number(this.hasSupport));
    for (const n of [this.supportX,this.supportY,this.supportHeading,this.turnBend,this.previousTurnBend]) w.f64(n);
  }
  static restoreSnake<T extends SnakeAgent>(r:BinaryReader,create:(id:string,x:number,y:number,seed:number)=>T):T {
    const a=EcologicalAgent.readAs(r,create),flag=r.u8();
    if(flag>1)throw new Error('Invalid snake support state');
    a.hasSupport=Boolean(flag);a.supportX=r.f64();a.supportY=r.f64();a.supportHeading=r.f64();a.turnBend=r.f64();a.previousTurnBend=r.f64();return a;
  }
}

/** Solitary constrictor: long rests in cover, slow travel and occasional trunk residence. */
export class BoaAgent extends SnakeAgent {
  readonly kind='boa';readonly type=51;
  constructor(id:string,x:number,y:number,seed:number){super(id,x,y,seed);this.size=.95+this.random.next()*.2;}
  protected decide(env:AgentEnvironment):void {
    if(this.state!=='rest'||this.timer>0)return;
    if(this.cooldown===0&&this.random.next()<.25){this.beginActivity('investigate',5);this.cooldown=20;return;}
    if(this.cooldown===0&&this.random.next()<.75&&this.seekSupport(env))return;
    this.forage(env);
  }
  static read(r:BinaryReader){return SnakeAgent.restoreSnake(r,(...a)=>new BoaAgent(...a));}
}

/** Artistic loose snake aggregations; independent phases and sizes, never lockstep herds. */
export class SmallSnakeAgent extends SnakeAgent {
  readonly kind='smallSnake';readonly type=52;
  protected decide(env:AgentEnvironment):void {
    if(this.state==='rest'&&this.timer<=0){if(this.cooldown===0){this.beginActivity('investigate',3.5);this.cooldown=20;}else this.forage(env);}
    if(this.state==='travel'&&this.groupId){
      const peers=env.nearby(this.x,this.y,4).filter(a=>a.id!==this.id&&a.groupId===this.groupId);
      if(peers.length){
        const x=peers.reduce((s,a)=>s+a.x,0)/peers.length,y=peers.reduce((s,a)=>s+a.y,0)/peers.length;
        if(Math.hypot(x-this.x,y-this.y)>.8&&this.routeClear(x,y,env))this.target={x,y};
      }
    }
  }
  static read(r:BinaryReader){return SnakeAgent.restoreSnake(r,(...a)=>new SmallSnakeAgent(...a));}
}
