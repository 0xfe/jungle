import { BinaryReader, BinaryWriter, type Agent, type AgentEnvironment } from '../../agents';
import type { LocalStimulus } from '../../agents/startle';
import { hash } from '../../iso/math';
import { CONFIG } from '../../config';
import { lavaDanger, volcanicClearance, type Volcano } from '../volcanoes';
import { DeerAgent } from './deer';
import { WildlifeAgent } from './wildlife';
import { EcologicalAgent } from './ecological-base';
import { habitatAllows } from '../ecology';
import type { AgentRegistry } from '../../agents';

export type VolcanicAnimal=DeerAgent|WildlifeAgent;
export interface VolcanoEnvironment extends AgentEnvironment { spawnHidden?(x:number,y:number):boolean }
/** One owned lifecycle record replaces a mobile record near a volcano. No global tombstones. */
export class VolcanicWildlifeAgent implements Agent {
  /** Supplied once by the content registry, avoiding an initialization cycle. */
  static registry:AgentRegistry;
  readonly type=63;
  phase:'alive'|'burn'|'waiting'='alive';
  elapsed=0;previousElapsed=0;exposure=0;cycles=0;
  ashX=0;ashY=0;ashRemaining=0;
  /** Failed searches back off instead of repeating at 60 Hz. Both clocks survive sleep. */
  escapeRetry=0;respawnRetry=0;
  readonly template:Uint8Array;
  private readonly dangerSeed:number;
  constructor(public animal:VolcanicAnimal,readonly volcano:Volcano,template?:Uint8Array){this.template=template??VolcanicWildlifeAgent.registry.encode([animal]);this.dangerSeed=[...animal.id].reduce((n,c)=>(Math.imul(n,31)+c.charCodeAt(0))>>>0,0);}
  get id(){return this.animal.id;}
  get kind(){return this.animal.kind;}
  get x(){return this.animal.x;} get y(){return this.animal.y;}
  get speed(){return this.phase==='alive'?this.animal.speed:undefined;}
  get heading(){return this.animal.heading;}get altitude(){return this.animal instanceof WildlifeAgent?this.animal.altitude:0;}
  get groupId(){return this.animal.groupId;}get juvenile(){return this.animal.juvenile;}
  get alarm(){return this.animal instanceof DeerAgent?this.animal.alarm:0;}
  get stimulus():LocalStimulus|undefined {return this.phase==='alive'?(this.animal as Agent).stimulus:undefined;}
  update(dt:number,environment:AgentEnvironment):void {
    const env=environment as VolcanoEnvironment,a=this.animal;
    this.escapeRetry=Math.max(0,this.escapeRetry-dt);this.respawnRetry=Math.max(0,this.respawnRetry-dt);
    this.previousElapsed=this.elapsed;this.elapsed+=dt;this.ashRemaining=Math.max(0,this.ashRemaining-dt);
    if(this.phase==='burn'){
      if(this.elapsed>=CONFIG.world.volcanoes.burnSeconds){this.phase='waiting';this.elapsed=0;this.previousElapsed=0;this.ashX=a.x;this.ashY=a.y;this.ashRemaining=60;}
      return;
    }
    if(this.phase==='waiting'){
      if(this.elapsed<CONFIG.world.volcanoes.respawnSeconds||this.respawnRetry>0)return;
      this.respawnRetry=2+hash(this.dangerSeed,this.cycles,8187);
      // Stable candidates stay within a bounded expanded home territory. Admission
      // requires a full screen margin, so a camera arriving early keeps them asleep.
      for(let i=0;i<32;i++){
        const angle=hash(i,this.cycles,this.volcano.phase)*Math.PI*2,r=6.5+hash(i,1,this.volcano.phase)*2;
        const x=this.volcano.x+Math.cos(angle)*r,y=this.volcano.y+Math.sin(angle)*r;
        if(!env.spawnHidden?.(x,y)||!env.canMove(x,y)||volcanicClearance(this.volcano,x,y)<.25)continue;
        if(a instanceof EcologicalAgent&&!habitatAllows(a.kind,env.sample(x,y)))continue;
        const radius=a instanceof EcologicalAgent?(a.kind==='elephant'?.23*a.size:a.kind==='giraffe'?.14:.15*a.size):.13*a.size;
        if([[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy])=>!env.canMove(x+dx!*radius,y+dy!*radius)))continue;
        const replacement=VolcanicWildlifeAgent.decodeAnimal(this.template);
        const home={x:replacement.x,y:replacement.y};
        this.animal=replacement;replacement.x=x;replacement.y=y;replacement.motor.stop();
        replacement.territory=[Math.min(replacement.territory[0],this.volcano.x-10),Math.min(replacement.territory[1],this.volcano.y-10),Math.max(replacement.territory[2],this.volcano.x+10),Math.max(replacement.territory[3],this.volcano.y+10)];
        // The original destination leads back toward the pre-loss home belt.
        replacement.target=home;replacement.heading=Math.atan2(replacement.target.y-y,replacement.target.x-x);
        replacement.timer=45;
        if(replacement instanceof DeerAgent){replacement.state='turn';replacement.locomotion='walk';replacement.senseTimer=1;}
        else{replacement.state='travel';replacement.decision=1;replacement.altitude=0;replacement.targetAltitude=0;}
        replacement.previous=replacement.sample();
        this.phase='alive';this.elapsed=0;this.previousElapsed=0;this.exposure=0;this.cycles++;return;
      }
      return;
    }
    const danger=lavaDanger(this.volcano,a.x,a.y,env.time);
    const clearance=volcanicClearance(this.volcano,a.x,a.y);
    const reckless=hash(this.dangerSeed,this.cycles,this.volcano.phase)<.025;
    // Ordinary target selection AND every motor step reject lava and the inner ash.
    // An animal already inside the exclusion may move outward, never farther in.
    const safe:AgentEnvironment={...env,canMove:(x,y)=>env.canMove(x,y)&&(this.altitude>=8||reckless||
      volcanicClearance(this.volcano,x,y)>=Math.min(.12,clearance-.001))};
    if(this.altitude<8&&(danger.distance<.9||clearance<.12)){
      const hesitate=reckless&&this.exposure<CONFIG.world.volcanoes.contactSeconds;
      if(!hesitate){
        const away=clearance<danger.distance-.5?Math.atan2(a.y-this.volcano.y,a.x-this.volcano.x):danger.away;
        this.escape(safe,away);
      }
    }
    a.update(dt,safe);
    const contact=lavaDanger(this.volcano,a.x,a.y,env.time);
    this.exposure=this.altitude<8&&contact.distance<0&&contact.heat>.55?this.exposure+dt:Math.max(0,this.exposure-dt*2);
    if(this.exposure>CONFIG.world.volcanoes.contactSeconds){a.motor.stop();this.phase='burn';this.elapsed=0;this.previousElapsed=0;}
  }
  /** Turn/brake/stride remain the species motor's responsibility; only danger intent changes. */
  private escape(env:AgentEnvironment,away:number):void {
    const a=this.animal;
    if(a.startle.remaining>0&&Math.hypot(a.target.x-a.x,a.target.y-a.y)>.2&&env.canMove(a.target.x,a.target.y)&&volcanicClearance(this.volcano,a.target.x,a.target.y)>.15){
      a.startle.remaining=.5;
      if(a instanceof DeerAgent)a.senseTimer=1;else a.decision=1;
      return;
    }
    if(this.escapeRetry>0)return;
    this.escapeRetry=.6+hash(this.dangerSeed,this.cycles,8188)*.4;
    for(const distance of [1.6,.9,.4])for(const offset of [0,.6,-.6,1.2,-1.2]){
      const angle=away+offset,x=a.x+Math.cos(angle)*distance,y=a.y+Math.sin(angle)*distance,b=a.territory;
      if(x<b[0]+.2||y<b[1]+.2||x>b[2]-.2||y>b[3]-.2)continue;
      let clear=true;
      for(let k=1;k<=16;k++){
        const px=a.x+(x-a.x)*k/16,py=a.y+(y-a.y)*k/16;
        if(!env.canMove(px,py)||(a instanceof EcologicalAgent&&!habitatAllows(a.kind,env.sample(px,py)))){clear=false;break;}
      }
      if(!clear||volcanicClearance(this.volcano,x,y)<.15)continue;
      a.target={x,y};a.timer=8;a.tripPace=1.5;a.startle.remaining=.5;a.startle.heading=angle;
      if(a instanceof DeerAgent){a.fear=1;a.locomotion='run';a.state=Math.abs(Math.atan2(Math.sin(angle-a.heading),Math.cos(angle-a.heading)))>.2?'turn':'run';a.senseTimer=1;}
      else{a.state=['jaguar','wolf','boar','zebra'].includes(a.kind)?'run':'travel';a.decision=1;}
      return;
    }
  }
  write(w:BinaryWriter):void {
    w.blob(VolcanicWildlifeAgent.registry.encode([this.animal]));w.blob(this.template);
    w.string(this.volcano.id);for(const n of [this.volcano.x,this.volcano.y,this.volcano.form,this.volcano.radius,this.volcano.phase,this.volcano.heading])w.f64(n);
    w.u8(['alive','burn','waiting'].indexOf(this.phase));
    for(const n of [this.elapsed,this.previousElapsed,this.exposure,this.cycles,this.ashX,this.ashY,this.ashRemaining,this.escapeRetry,this.respawnRetry])w.f64(n);
  }
  /** A nested record must contain exactly one ordinary animal, never another lifecycle. */
  private static decodeAnimal(bytes:Uint8Array):VolcanicAnimal {
    if(bytes.length<6||bytes[5]===63||new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength).getUint32(1,true)!==1)throw new Error('Invalid volcanic animal record');
    const animal=VolcanicWildlifeAgent.registry.decode(bytes)[0];
    if(!(animal instanceof DeerAgent||animal instanceof WildlifeAgent))throw new Error('Invalid volcanic animal');return animal;
  }
  static read(r:BinaryReader):VolcanicWildlifeAgent {
    const animal=VolcanicWildlifeAgent.decodeAnimal(r.blob()),template=r.blob();
    const saved=VolcanicWildlifeAgent.decodeAnimal(template);if(saved.id!==animal.id||saved.type!==animal.type)throw new Error('Invalid replacement template');
    const volcano={id:r.string(),x:r.f64(),y:r.f64(),form:r.f64(),radius:r.f64(),phase:r.f64(),heading:r.f64()};
    const a=new VolcanicWildlifeAgent(animal,volcano,template),phase=(['alive','burn','waiting'] as const)[r.u8()];
    if(!phase||!Number.isInteger(volcano.form)||volcano.form<0||volcano.form>3||volcano.radius<2||volcano.radius>3)throw new Error('Invalid volcano state');
    a.phase=phase;a.elapsed=r.f64();a.previousElapsed=r.f64();a.exposure=r.f64();a.cycles=r.f64();a.ashX=r.f64();a.ashY=r.f64();a.ashRemaining=r.f64();a.escapeRetry=r.f64();a.respawnRetry=r.f64();
    if(a.escapeRetry<0||a.escapeRetry>1||a.respawnRetry<0||a.respawnRetry>3||a.elapsed<0||a.exposure<0||a.ashRemaining<0||a.cycles<0||!Number.isInteger(a.cycles))throw new Error('Invalid volcanic lifecycle');return a;
  }
}
