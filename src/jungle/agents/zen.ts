import { AgentRandom, BinaryReader, BinaryWriter, type Agent, type AgentEnvironment } from '../../agents';
import { clamp, lerp } from '../../iso/math';
import { CONFIG } from '../../config';
import { zenPlants, type ZenSite } from '../zen-sites';
import type { WorldSettings } from '../settings';

export const ZEN_KINDS=['monk','koi','duck','pelican'] as const;
export type ZenKind=typeof ZEN_KINDS[number];
const TAU=Math.PI*2;
const angleDelta=(a:number,b:number)=>Math.atan2(Math.sin(b-a),Math.cos(b-a));
/** Shared motion/codec only; each resident owns a separate behavior implementation. */
export abstract class ZenResident implements Agent {
 abstract readonly kind:ZenKind;abstract readonly type:number;
 rng:AgentRandom;heading=0;gait=0;speed=0;clock=0;timer=0;state=0;variant=0;index=0;visibility=1;
 homeX:number;homeY:number;previous={x:0,y:0,heading:0,gait:0,clock:0,visibility:1};
 constructor(readonly id:string,public x:number,public y:number,seed:number){this.homeX=x;this.homeY=y;this.rng=new AgentRandom(seed);this.variant=Math.floor(this.rng.next()*3);this.capture();}
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
  this.x=nx;this.y=ny;this.speed=speed;this.gait+=step/(this.kind==='monk'?.12:.18);return false;
 }
 abstract update(dt:number,e:AgentEnvironment):void;
 write(w:BinaryWriter):void{
  w.string(this.id);w.u32(this.rng.state);w.u8(this.state);w.u8(this.variant);w.u8(this.index);
  for(const n of [this.x,this.y,this.homeX,this.homeY,this.heading,this.gait,this.speed,this.clock,this.timer,this.visibility,...Object.values(this.previous)])w.f64(n);
 }
 static restore<T extends ZenResident>(a:T,r:BinaryReader):T{
  a.rng.state=r.u32();a.state=r.u8();a.variant=r.u8();a.index=r.u8();
  [a.x,a.y,a.homeX,a.homeY,a.heading,a.gait,a.speed,a.clock,a.timer,a.visibility]=Array.from({length:10},()=>r.f64()) as [number,number,number,number,number,number,number,number,number,number];
  a.previous={x:r.f64(),y:r.f64(),heading:r.f64(),gait:r.f64(),clock:r.f64(),visibility:r.f64()};
  if(a.variant>2||a.state>7||a.visibility<0||a.visibility>1)throw new Error('Invalid sanctuary resident');return a;
 }
}
/** Enter/leave, seated meditation, watering and a common slow circular procession. */
export class ZenMonkAgent extends ZenResident {
 readonly type=71;readonly kind='monk';flowers=true;flowerX=0;flowerY=0;formation=0;
 update(dt:number,e:AgentEnvironment):void{
  this.capture();this.clock+=dt;const t=this.clock%220,delay=this.index*2.2;
  const door={x:this.homeX-.45,y:this.homeY+.2},court={x:this.homeX+.7,y:this.homeY+1.5};
  let target=door,pace=.18;
  if(t<10+delay){this.state=0;this.speed=0;this.visibility=Math.max(0,this.visibility-dt*2);return;}
  if(t<65){target={x:court.x+Math.cos(this.formation*TAU)*.85,y:court.y+Math.sin(this.formation*TAU)*.65};this.state=1;
   if(Math.hypot(target.x-this.x,target.y-this.y)<.04){this.state=2;this.speed=0;this.heading=Math.PI/4;}
  }else if(t<105&&this.flowers){target={x:this.flowerX,y:this.flowerY};this.state=1;
   if(Math.hypot(target.x-this.x,target.y-this.y)<.04){this.state=3;this.speed=0;this.heading=-Math.PI/2;}
  }else if(t<180){const angle=(t-105)*.075+this.formation*TAU;target={x:court.x+Math.cos(angle)*.9,y:court.y+Math.sin(angle)*.9};this.state=4;pace=.11;
  }else {this.state=5;if(Math.hypot(this.x-door.x,this.y-door.y)<.04){this.visibility=Math.max(0,this.visibility-dt*1.8);this.speed=0;return;}}
  if(this.state!==2&&this.state!==3)this.move(target.x,target.y,pace,dt,(x,y)=>!e.sample(x,y).water);
  this.visibility=Math.min(1,this.visibility+dt*2);
 }
 override write(w:BinaryWriter){super.write(w);w.u8(Number(this.flowers));w.f64(this.flowerX);w.f64(this.flowerY);w.f64(this.formation);}
 static read(r:BinaryReader){const a=ZenResident.restore(new ZenMonkAgent(r.string(),0,0,1),r);a.flowers=!!r.u8();a.flowerX=r.f64();a.flowerY=r.f64();a.formation=r.f64();if(a.formation<0||a.formation>=1)throw new Error('Invalid monk formation');return a;}
}
/** Koi follow loose, individually phased ellipses and dart away from bill splashes. */
export class KoiAgent extends ZenResident {
 readonly type=72;readonly kind='koi';
 update(dt:number,e:AgentEnvironment){this.capture();this.clock+=dt;this.timer=Math.max(0,this.timer-dt);
  if(e.nearby(this.x,this.y,.6).some(n=>n.kind==='pelican'&&n.alarm===1))this.timer=1.8;
  const a=this.clock*(.13+this.index*.007)+this.index*2.4,r=.35+(this.index%3)*.14;this.state=this.timer>0?1:0;
  this.move(this.homeX+Math.cos(a)*r*2.1,this.homeY+Math.sin(a)*r*1.5,this.state?.4:.16,dt,(x,y)=>e.sample(x,y).water);
 }
 static read(r:BinaryReader){return ZenResident.restore(new KoiAgent(r.string(),0,0,1),r);}
}
/** Ducks paddle, dabble, then preen; each has its own seeded pause schedule. */
export class DuckAgent extends ZenResident {
 readonly type=73;readonly kind='duck';
 update(dt:number,e:AgentEnvironment){this.capture();this.clock+=dt;this.timer-=dt;
  if(this.timer<=0){this.state=(this.state+1)%3;this.timer=this.state?3+this.rng.next()*4:12+this.rng.next()*12;}
  if(this.state){this.speed=0;return;}const a=this.clock*.09+this.index*2.1;
  this.move(this.homeX+Math.cos(a)*1.4,this.homeY+Math.sin(a)*.8,.13,dt,(x,y)=>e.sample(x,y).water);
 }
 static read(r:BinaryReader){return ZenResident.restore(new DuckAgent(r.string(),0,0,1),r);}
}
/** Pelicans patrol the pond edge, pause to watch koi, and dip their long bills. */
export class PelicanAgent extends ZenResident {
 readonly type=74;readonly kind='pelican';get alarm(){return this.state===2?1:0;}
 update(dt:number,e:AgentEnvironment){this.capture();this.clock+=dt;this.timer-=dt;
  if(this.timer<=0){this.state=(this.state+1)%3;this.timer=this.state===0?18+this.rng.next()*20:this.state===1?3+this.rng.next()*3:1.3;}
  if(this.state){this.speed=0;return;}
  const fish=e.nearby(this.x,this.y,4).filter(n=>n.kind==='koi');const nearest=fish.sort((a,b)=>Math.hypot(a.x-this.x,a.y-this.y)-Math.hypot(b.x-this.x,b.y-this.y))[0];
  const a=this.clock*.055+this.index*Math.PI;
  this.move(nearest?.x??this.homeX+Math.cos(a)*1.5,nearest?.y??this.homeY+Math.sin(a)*.9,.1,dt,(x,y)=>e.sample(x,y).water);
 }
 static read(r:BinaryReader){return ZenResident.restore(new PelicanAgent(r.string(),0,0,1),r);}
}
export const ZEN_CLASSES={monk:ZenMonkAgent,koi:KoiAgent,duck:DuckAgent,pelican:PelicanAgent};
/** One bounded sanctuary owner keeps its procession and pond snapshot synchronized. */
export class ZenGardenAgent implements Agent {
 readonly type=70;readonly kind='zenGarden';residents:ZenResident[]=[];clock=0;previousClock=0;
 constructor(readonly id:string,public x:number,public y:number,public seed:number,public form:number){}
 static create(s:ZenSite,settings:Readonly<WorldSettings>){
  const a=new ZenGardenAgent(s.id,s.x,s.y,s.seed,s.form),rng=new AgentRandom(s.seed);
  for(const kind of ZEN_KINDS){if(kind!=='monk'&&!settings.water)continue;const base=({monk:CONFIG.world.zen.monks,koi:CONFIG.world.zen.koi,duck:CONFIG.world.zen.ducks,pelican:CONFIG.world.zen.pelicans})[kind];
   const count=Math.min(kind==='koi'?16:kind==='monk'?7:5,Math.floor(base*settings[`chance_${kind}`]));
   for(let i=0;i<count;i++){
    const C=ZEN_CLASSES[kind],home=kind==='monk'?{x:s.x,y:s.y}:{x:s.pondX,y:s.pondY};
    const c=new C(`${s.id}:${kind}:${i}`,home.x,home.y,Math.floor(rng.next()*0xffffffff));c.index=i;
    if(c instanceof ZenMonkAgent){c.x-=.45;c.y+=.2;c.visibility=0;c.formation=i/count;const beds=zenPlants(s,settings).filter(p=>p.kind==='flower'&&p.y===s.y+2.8);c.flowers=beds.length>0;const bed=beds[i%beds.length];c.flowerX=(bed?.x??s.x)+Math.floor(i/Math.max(1,beds.length))*.15;c.flowerY=(bed?.y??s.y)+.5;}
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
 static read(r:BinaryReader){const id=r.string(),seed=r.u32(),form=r.u8(),a=new ZenGardenAgent(id,r.f64(),r.f64(),seed,form);a.clock=r.f64();a.previousClock=r.f64();const n=r.u8();if(n>33||form>2)throw new Error('Invalid sanctuary population');
  const ids=new Set<string>();for(let i=0;i<n;i++){const type=r.u8(),C=Object.values(ZEN_CLASSES).find(C=>new C('',0,0,1).type===type);if(!C)throw new Error('Unknown sanctuary resident');const c=C.read(r);if(ids.has(c.id))throw new Error('Duplicate sanctuary resident');ids.add(c.id);a.residents.push(c);}return a;
 }
}
