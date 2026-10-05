import { AgentRandom, BinaryReader, BinaryWriter, type Agent, type AgentEnvironment } from '../../agents';
import { clamp, lerp } from '../../iso/math';
import { zenEntrance } from '../zen-layout';
import { CONFIG } from '../../config';
import { zenPlants, zenLayout, type ZenSite } from '../zen-sites';
import type { WorldSettings } from '../settings';

export const ZEN_KINDS=['monk','koi','duck','pelican'] as const;
export type ZenKind=typeof ZEN_KINDS[number];
const TAU=Math.PI*2;
const angleDelta=(a:number,b:number)=>Math.atan2(Math.sin(b-a),Math.cos(b-a));
/** Shared motion/codec only; each resident owns a separate behavior implementation. */
export abstract class ZenResident implements Agent {
 abstract readonly kind:ZenKind;abstract readonly type:number;
 rng:AgentRandom;heading=0;gait=0;speed=0;clock=0;timer=0;state=0;variant=0;index=0;visibility=1;
 size=1;homeX:number;homeY:number;previous={x:0,y:0,heading:0,gait:0,clock:0,visibility:1};
 constructor(readonly id:string,public x:number,public y:number,seed:number){this.homeX=x;this.homeY=y;this.rng=new AgentRandom(seed);this.variant=Math.floor(this.rng.next()*3);this.size=.85+this.rng.next()*.3;this.capture();}
 capture(){this.previous={x:this.x,y:this.y,heading:this.heading,gait:this.gait,clock:this.clock,visibility:this.visibility};}
 presentation(alpha:number){return{x:lerp(this.previous.x,this.x,alpha),y:lerp(this.previous.y,this.y,alpha),heading:this.previous.heading+angleDelta(this.previous.heading,this.heading)*alpha,gait:lerp(this.previous.gait,this.gait,alpha),clock:lerp(this.previous.clock,this.clock,alpha),visibility:lerp(this.previous.visibility,this.visibility,alpha)};}
 /** Turns plant the feet, and only accepted distance advances the baked gait. */
 move(x:number,y:number,pace:number,dt:number,valid:(x:number,y:number)=>boolean):boolean{
  const dx=x-this.x,dy=y-this.y,d=Math.hypot(dx,dy);if(d<.025){this.speed=0;return true;}
  const delta=angleDelta(this.heading,Math.atan2(dy,dx));this.heading+=clamp(delta,-2.4*dt,2.4*dt);
  if(Math.abs(delta)>.32){this.speed=0;return false;}
  const desired=Math.min(pace,d*2),speed=Math.min(desired,this.speed+dt*.25),step=Math.min(d,speed*dt);
  const nx=this.x+Math.cos(this.heading)*step,ny=this.y+Math.sin(this.heading)*step;
  if(!valid(nx,ny)){this.speed=0;return false;}
  this.x=nx;this.y=ny;this.speed=speed;this.gait+=step/(this.kind==='monk'?.12:.18*this.size);return false;
 }
 abstract update(dt:number,e:AgentEnvironment):void;
 write(w:BinaryWriter):void{
  w.string(this.id);w.u32(this.rng.state);w.u8(this.state);w.u8(this.variant);w.u8(this.index);w.f64(this.size);
  for(const n of [this.x,this.y,this.homeX,this.homeY,this.heading,this.gait,this.speed,this.clock,this.timer,this.visibility,...Object.values(this.previous)])w.f64(n);
 }
 static restore<T extends ZenResident>(a:T,r:BinaryReader):T{
  a.rng.state=r.u32();a.state=r.u8();a.variant=r.u8();a.index=r.u8();a.size=r.f64();
  [a.x,a.y,a.homeX,a.homeY,a.heading,a.gait,a.speed,a.clock,a.timer,a.visibility]=Array.from({length:10},()=>r.f64()) as [number,number,number,number,number,number,number,number,number,number];
  a.previous={x:r.f64(),y:r.f64(),heading:r.f64(),gait:r.f64(),clock:r.f64(),visibility:r.f64()};
  if(a.size<.5||a.size>1.5||a.variant>2||a.state>7||a.visibility<0||a.visibility>1)throw new Error('Invalid sanctuary resident');return a;
 }
}
/** Independent residents own their tasks; only the dedicated procession shares a schedule. */
export class ZenMonkAgent extends ZenResident {
 readonly type=71; readonly kind='monk';
 flowers=true; flowerX=0; flowerY=0; formation=0;
 lift=0; previousLift=0;
 role=0; task=2; visits=0; route=0;
 targetX=0; targetY=0; seatX=0; seatY=0; groveX=0; groveY=0;
 private chooseTask(): void {
  this.task=[2,3,6][(this.index+this.visits++)%3]!;
  if(this.task===3&&!this.flowers)this.task=6;
  this.targetX=this.task===3?this.flowerX:this.seatX;
  this.targetY=this.task===3?this.flowerY:this.seatY;
  if(this.task===6){this.targetX+=.25+this.rng.next()*.45;this.targetY+=.2+this.rng.next()*.35;}
  this.state=1;this.route=1;this.timer=0;
 }
 /** The same registered porch and stair waypoints are used in both directions. */
 private passage(dt:number,e:AgentEnvironment):boolean {
  if(!this.route)return false;
  const {door,landing,steps,apron}=zenEntrance(this.homeX,this.homeY),entering=this.state===5;
  const points=entering?[apron,steps,landing,door]:[landing,steps,apron];
  const target=points[this.route-1]!;
  const arrived=this.move(target.x,target.y,.19,dt,(x,y)=>!e.sample(x,y).water);
  const project=(a:{x:number;y:number},b:{x:number;y:number})=>clamp(((this.x-a.x)*(b.x-a.x)+(this.y-a.y)*(b.y-a.y))/((b.x-a.x)**2+(b.y-a.y)**2),0,1);
  const onStairs=entering?this.route===3:this.route===2;
  const onPorch=entering?this.route===4:this.route===1;
  this.lift=onPorch?18.9:onStairs?18.9*project(steps,landing):0;
  // Disappear only at the black doorway, never out in the garden.
  this.visibility=onPorch?clamp(Math.hypot(this.x-door.x,this.y-door.y)/.16,0,1):1;
  if(arrived){
   if(this.route<points.length)this.route++;
   else {this.route=0;if(entering){this.state=0;this.visibility=0;this.lift=18.9;this.timer=7+this.rng.next()*24;}}
  }
  return true;
 }
 update(dt:number,e:AgentEnvironment):void {
  this.capture();this.previousLift=this.lift;this.clock+=dt;
  const {door}=zenEntrance(this.homeX,this.homeY);
  const valid=(x:number,y:number)=>!e.sample(x,y).water;
  if(this.role===1){
   const t=this.clock%300,delay=this.formation*5;
   if(this.state===0){
    this.speed=0;this.visibility=0;this.lift=18.9;
    if(t>=12+delay&&t<205){this.x=door.x;this.y=door.y;this.state=1;this.route=1;}
    return;
   }
   if(t>=205&&this.state!==5){this.state=5;this.route=1;}
   if(this.passage(dt,e))return;
   const angle=(Math.max(55,t)-55)*.065+this.formation*TAU;
   this.targetX=this.groveX+Math.cos(angle)*1.35;this.targetY=this.groveY+Math.sin(angle)*1.15;
   this.state=t<55?1:4;this.visibility=1;this.lift=0;
   this.move(this.targetX,this.targetY,this.state===4?.13:.24,dt,valid);return;
  }
  if(this.state===0){
   this.speed=0;this.visibility=0;this.lift=18.9;this.timer-=dt;
   if(this.timer<=0){this.x=door.x;this.y=door.y;this.chooseTask();}return;
  }
  if(this.passage(dt,e))return;
  this.visibility=1;this.lift=0;
  if(this.state===2||this.state===3||this.state===6){
   this.speed=0;this.timer-=dt;
   if(this.timer<=0){this.state=5;this.route=1;}return;
  }
  if(!this.move(this.targetX,this.targetY,.21+this.index*.008,dt,valid))return;
  this.state=this.task;
  this.timer=this.task===2?22+this.rng.next()*36:this.task===3?13+this.rng.next()*19:4+this.rng.next()*9;
  this.heading=this.task===3?-Math.PI/2:this.rng.next()*TAU;
 }
 override write(w:BinaryWriter):void {
  super.write(w);w.u8(Number(this.flowers));w.u8(this.role);w.u8(this.task);w.u32(this.visits);w.u8(this.route);
  for(const n of [this.flowerX,this.flowerY,this.formation,this.targetX,this.targetY,this.seatX,this.seatY,this.groveX,this.groveY,this.lift,this.previousLift])w.f64(n);
 }
 static read(r:BinaryReader):ZenMonkAgent {
  const a=ZenResident.restore(new ZenMonkAgent(r.string(),0,0,1),r);
  a.flowers=!!r.u8();a.role=r.u8();a.task=r.u8();a.visits=r.u32();a.route=r.u8();
  [a.flowerX,a.flowerY,a.formation,a.targetX,a.targetY,a.seatX,a.seatY,a.groveX,a.groveY,a.lift,a.previousLift]=Array.from({length:11},()=>r.f64()) as [number,number,number,number,number,number,number,number,number,number,number];
  if(a.formation<0||a.formation>=1||a.role>1||a.route>4||![2,3,6].includes(a.task))throw new Error('Invalid monk routine');
  return a;
 }
}
/** Saved local routes keep every pond resident inside its sanctuary. */
export abstract class PondResident extends ZenResident {
 goalX:number;goalY:number;actionPhase=0;previousAction=0;actionSeconds=4;
 constructor(id:string,x:number,y:number,seed:number){super(id,x,y,seed);this.goalX=x;this.goalY=y;}
 protected contained(x:number,y:number,margin=1):boolean{return ((x-this.homeX)/(2.05*margin))**2+((y-this.homeY)/(1.45*margin))**2<1;}
 protected waterGoal(e:AgentEnvironment,away?:{x:number;y:number}):boolean{
  for(let i=0;i<32;i++){
   const angle=away?Math.atan2(this.y-away.y,this.x-away.x)+(this.rng.next()-.5):this.heading+(this.rng.next()-.5)*(i<16?2:TAU);
   const d=.25+this.rng.next()*.7,x=this.x+Math.cos(angle)*d,y=this.y+Math.sin(angle)*d;
   if(!this.contained(x,y)||!e.sample(x,y).water)continue;
   this.goalX=x;this.goalY=y;return true;
  }
  this.goalX=this.homeX;this.goalY=this.homeY;return false;
 }
 protected begin(action:number,seconds:number):void{this.state=action;this.actionPhase=this.previousAction=0;this.actionSeconds=seconds;this.speed=0;}
 protected tick(dt:number):void{this.capture();this.previousAction=this.actionPhase;this.clock+=dt;this.timer-=dt;}
 override write(w:BinaryWriter):void{super.write(w);for(const n of [this.goalX,this.goalY,this.actionPhase,this.previousAction,this.actionSeconds])w.f64(n);}
 static restorePond<T extends PondResident>(a:T,r:BinaryReader):T{ZenResident.restore(a,r);a.goalX=r.f64();a.goalY=r.f64();a.actionPhase=r.f64();a.previousAction=r.f64();a.actionSeconds=r.f64();if(a.actionSeconds<=0||a.actionPhase<0||a.actionPhase>1)throw new Error('Invalid pond action');return a;}
}
/** Independent curved trips, small surface feeding turns and fish-owned bill avoidance. */
export class KoiAgent extends PondResident {
 readonly type=72;readonly kind='koi';
 update(dt:number,e:AgentEnvironment){
  this.tick(dt);const danger=e.nearby(this.x,this.y,.65).find(n=>n.kind==='pelican'&&n.alarm===1);
  if(danger&&this.state!==1){this.state=1;this.timer=1.4+this.rng.next();this.waterGoal(e,danger);}
  if(this.state===2){this.speed=0;this.actionPhase=Math.min(1,this.actionPhase+dt/this.actionSeconds);if(this.actionPhase===1){this.state=0;this.timer=10+this.rng.next()*15;this.waterGoal(e);}return;}
  if(this.state===1&&this.timer<=0){this.state=0;this.timer=12;}
  if(Math.hypot(this.goalX-this.x,this.goalY-this.y)<.10){
   if(this.state===0&&this.timer<=0&&this.rng.next()<.25){this.begin(2,2.5+this.rng.next());return;}
   this.waterGoal(e,danger);
  }
  this.move(this.goalX,this.goalY,this.state===1?.42:.13+this.size*.035,dt,(x,y)=>this.contained(x,y)&&e.sample(x,y).water);
 }
 static read(r:BinaryReader){return PondResident.restorePond(new KoiAgent(r.string(),0,0,1),r);}
}
/** Dabbling folds down/up once; preening may happen during a short dry-bank visit. */
export class DuckAgent extends PondResident {
 readonly type=73;readonly kind='duck';
 update(dt:number,e:AgentEnvironment){
  this.tick(dt);
  if([1,2,4].includes(this.state)){
   this.speed=0;this.actionPhase=Math.min(1,this.actionPhase+dt/this.actionSeconds);
   if(this.actionPhase===1){this.state=this.state===4?5:0;this.timer=12+this.rng.next()*15;this.waterGoal(e);}return;
  }
  if(this.state===0&&this.timer<=0){
   if(this.rng.next()<.24)for(let i=0;i<32;i++){
    const a=this.rng.next()*TAU,x=this.homeX+Math.cos(a)*2.15,y=this.homeY+Math.sin(a)*1.52;
    if(!e.sample(x,y).water&&e.canMove(x,y)){this.state=3;this.goalX=x;this.goalY=y;this.timer=48;break;}
   }
   if(this.state===0){this.begin(this.rng.next()<.5?1:2,4+this.rng.next()*3);return;}
  }
  const landTrip=this.state===3||this.state===5;
  const arrived=this.move(this.goalX,this.goalY,landTrip?.10:.13,dt,(x,y)=>this.contained(x,y,1.12)&&(e.sample(x,y).water||(landTrip&&e.canMove(x,y))));
  if(arrived){if(this.state===3)this.begin(4,6);else{this.state=0;this.waterGoal(e);}}
  if(landTrip&&this.timer<=0){this.state=5;this.timer=20;this.waterGoal(e);}
 }
 static read(r:BinaryReader){return PondResident.restorePond(new DuckAgent(r.string(),0,0,1),r);}
}
/** Retained fish-directed approaches stop short, settle wings, watch, then dip once. */
export class PelicanAgent extends PondResident {
 readonly type=74;readonly kind='pelican';get alarm(){return this.state===2&&this.actionPhase>.3&&this.actionPhase<.7?1:0;}
 update(dt:number,e:AgentEnvironment){
  this.tick(dt);
  if(this.state===2){this.speed=0;this.actionPhase=Math.min(1,this.actionPhase+dt/this.actionSeconds);if(this.actionPhase===1){this.state=0;this.timer=12+this.rng.next()*18;this.waterGoal(e);}return;}
  if(this.state===1){this.speed=0;this.actionPhase=Math.min(1,this.actionPhase+dt/this.actionSeconds);if(this.actionPhase===1)this.begin(2,2.2);return;}
  if(this.timer<=0){
   const fish=e.nearby(this.x,this.y,2).filter(n=>n.kind==='koi').sort((a,b)=>Math.hypot(a.x-this.x,a.y-this.y)-Math.hypot(b.x-this.x,b.y-this.y))[0];
   if(fish){const d=Math.hypot(fish.x-this.x,fish.y-this.y);if(d<.6){this.begin(1,3);return;}
    const x=fish.x+(this.x-fish.x)/d*.4,y=fish.y+(this.y-fish.y)/d*.4;if(this.contained(x,y)&&e.sample(x,y).water){this.goalX=x;this.goalY=y;}}
   else this.waterGoal(e);
  }
  if(this.move(this.goalX,this.goalY,.10,dt,(x,y)=>this.contained(x,y)&&e.sample(x,y).water))this.waterGoal(e);
 }
 static read(r:BinaryReader){return PondResident.restorePond(new PelicanAgent(r.string(),0,0,1),r);}
}
export const ZEN_CLASSES={monk:ZenMonkAgent,koi:KoiAgent,duck:DuckAgent,pelican:PelicanAgent};
/** One bounded sanctuary owner keeps its procession and pond snapshot synchronized. */
export class ZenGardenAgent implements Agent {
 readonly type=70;readonly kind='zenGarden';residents:ZenResident[]=[];clock=0;previousClock=0;
 constructor(readonly id:string,public x:number,public y:number,public seed:number,public form:number){}
 static create(s:ZenSite,settings:Readonly<WorldSettings>){
  const a=new ZenGardenAgent(s.id,s.x,s.y,s.seed,s.form),rng=new AgentRandom(s.seed);
  for(const kind of ZEN_KINDS){if(kind!=='monk'&&!settings.water)continue;const base=({monk:CONFIG.world.zen.monks,koi:CONFIG.world.zen.koi,duck:CONFIG.world.zen.ducks,pelican:CONFIG.world.zen.pelicans})[kind];
   const count=Math.min(kind==='koi'?16:kind==='monk'?12:5,Math.floor(base*settings[`chance_${kind}`]));
   for(let i=0;i<count;i++){
    const C=ZEN_CLASSES[kind],home=kind==='monk'?{x:s.x,y:s.y}:{x:s.pondX,y:s.pondY};
    const c=new C(`${s.id}:${kind}:${i}`,home.x,home.y,Math.floor(rng.next()*0xffffffff));c.index=i;
    if(c instanceof ZenMonkAgent){
     const layout=zenLayout(s),group=count>=6?Math.min(4,Math.floor(count/3)):0,independent=count-group;
     c.x=layout.door.x;c.y=layout.door.y;c.visibility=0;c.state=0;
     c.role=i>=independent?1:0;c.formation=c.role?(i-independent)/group:0;
     c.timer=2+i*3.1+c.rng.next()*8;
     const bed=layout.beds[i%layout.beds.length]!,seat=layout.seats[i%layout.seats.length]!;
     c.flowers=zenPlants(s,settings).some(p=>p.kind==='flower'&&p.x===bed.x&&p.y===bed.y);
     c.flowerX=bed.x;c.flowerY=bed.y+.5;c.seatX=seat.x;c.seatY=seat.y;
     c.groveX=layout.grove.x;c.groveY=layout.grove.y;
    }
    else{const angle=i*2.4;c.x+=Math.cos(angle)*.8;c.y+=Math.sin(angle)*.5;c.timer=5+rng.next()*14;}
    c.capture();a.residents.push(c);
   }
  }return a;
 }
 update(dt:number,e:AgentEnvironment){this.previousClock=this.clock;this.clock+=dt;
  const snapshot=this.residents.map(a=>({id:a.id,kind:a.kind,x:a.x,y:a.y,speed:a.speed,alarm:a instanceof PelicanAgent?a.alarm:0}));
  const env={...e,nearby:(x:number,y:number,r:number)=>snapshot.filter(a=>Math.hypot(a.x-x,a.y-y)<=r)};
  for(const c of this.residents)c.update(dt,env);
 }
 write(w:BinaryWriter){w.string(this.id);w.u32(this.seed);w.u8(this.form);for(const n of [this.x,this.y,this.clock,this.previousClock])w.f64(n);w.u8(this.residents.length);for(const c of this.residents){w.u8(c.type);c.write(w);}}
 static read(r:BinaryReader){const id=r.string(),seed=r.u32(),form=r.u8(),a=new ZenGardenAgent(id,r.f64(),r.f64(),seed,form);a.clock=r.f64();a.previousClock=r.f64();const n=r.u8();if(n>38||form>2)throw new Error('Invalid sanctuary population');
  const ids=new Set<string>();for(let i=0;i<n;i++){const type=r.u8(),C=Object.values(ZEN_CLASSES).find(C=>new C('',0,0,1).type===type);if(!C)throw new Error('Unknown sanctuary resident');const c=C.read(r);if(ids.has(c.id))throw new Error('Duplicate sanctuary resident');ids.add(c.id);a.residents.push(c);}return a;
 }
}
