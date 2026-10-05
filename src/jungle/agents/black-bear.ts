import { BinaryReader, BinaryWriter, type AgentEnvironment } from '../../agents';
import { clamp } from '../../iso/math';
import { angleDelta, TAU } from '../animation';
import type { WildlifeSample } from './wildlife';
import { EcologicalAgent } from './ecological-base';

/** Solitary woodland forager, or a mother with dependent cubs. No hunting/pack behavior. */
export class BlackBearAgent extends EcologicalAgent {
 readonly kind='blackBear';readonly type=58;
 forageTarget=false;
 /** Brief ground bouts alternate with the usual upright walking posture. */
 grounded=false;groundTime=0;
 override sample():WildlifeSample {
  const s=super.sample();
  if(this.grounded)s.state=s.state==='travel'?'crawl':s.state==='rest'?'groundRest':s.state;
  return s;
 }
 override update(dt:number,env:AgentEnvironment):void {
  this.groundTime=Math.max(0,this.groundTime-dt);super.update(dt,env);
 }
 /** Real support coordinates persist throughout approach, standing and lowering. */
 treeTarget=false;supportX=0;supportY=0;
 protected decide(env:AgentEnvironment):void {
  if(['rise','stand','pick','lower'].includes(this.state))return;
  if(this.grounded&&this.groundTime===0){this.state='rise';this.gait=0;this.motor.stop();return;}
  const family=this.groupId?env.nearby(this.x,this.y,5).filter(n=>n.id!==this.id&&n.groupId===this.groupId).sort((a,b)=>a.id.localeCompare(b.id)):[];
  const mother=family.find(n=>n.id===this.motherId);
  if(mother&&Math.hypot(mother.x-this.x,mother.y-this.y)>.6){
   // Refresh during travel too; smaller cubs must not chase an obsolete waypoint.
   const heading=mother.heading??0;
   for(const offset of [0,.4,-.4]){
    const x=mother.x-Math.cos(heading+offset)*.32,y=mother.y-Math.sin(heading+offset)*.32;
    if(!this.routeClear(x,y,env))continue;
    this.target={x,y};this.forageTarget=false;this.state='travel';this.timer=20;this.tripPace=1.3;return;
   }
  }
  if(!this.juvenile&&family.some(n=>n.juvenile&&Math.hypot(n.x-this.x,n.y-this.y)>1.2)){
   this.motor.stop();this.state='rest';this.timer=1;return;
  }
  if(this.state==='forage'){
   if(this.timer<=0){this.state='rest';this.timer=3+this.random.next()*5;this.cooldown=45+this.random.next()*40;}
   return;
  }
  if(this.state!=='rest')return;
  if(this.forageTarget){
   this.forageTarget=false;
   const support=this.treeTarget&&Math.hypot(this.supportX-this.x,this.supportY-this.y)<=.45*this.size&&(env.perches?.(this.x,this.y,.5)??[]).some(p=>Math.hypot((p.root?.x??p.x)-this.supportX,(p.root?.y??p.y)-this.supportY)<.03);
   this.treeTarget=Boolean(support);this.state=support?'stand':this.grounded?'forage':'lower';this.gait=0;this.timer=5+this.random.next()*7;if(!support)this.groundTime=16+this.random.next()*8;return;
  }
  if(this.timer>0)return;
  if(!this.grounded&&!this.cooldown&&this.random.next()<.16){this.treeTarget=false;this.state='lower';this.gait=0;this.groundTime=16+this.random.next()*8;return;}
  // Search beside actual trunks, preferring nearby supports; never target their
  // solid root. Bounded probes retain dry-footed routes and owner territory.
  const trees=(env.perches?.(this.x,this.y,this.spec.range)??[]).map(p=>p.root??p);
  for(let i=0;i<24;i++){
   const tree=trees.length&&i<16?trees[Math.floor(this.random.next()*trees.length)]:undefined;
   const angle=this.random.next()*TAU,distance=tree?.435*this.size:.3+this.random.next()*.9;
   const x=(tree?.x??this.x)+Math.cos(angle)*distance,y=(tree?.y??this.y)+Math.sin(angle)*distance;
   if(Math.hypot(x-this.x,y-this.y)<.15||!this.routeClear(x,y,env))continue;
   if(mother&&Math.hypot(x-mother.x,y-mother.y)>.85)continue;
   this.target={x,y};this.state='travel';this.timer=25;this.tripPace=.75+this.random.next()*.3;
   this.treeTarget=Boolean(tree);if(tree){this.supportX=tree.x;this.supportY=tree.y;}
   this.forageTarget=!this.grounded&&this.cooldown===0&&(Boolean(tree)||env.sample(x,y).moisture>.45);return;
  }
  this.timer=2+this.random.next()*3;
 }
 protected override stationaryAction(dt:number,env:AgentEnvironment):boolean {
  if(['rise','stand','pick','lower'].includes(this.state)){
   this.motor.stop();
   if(this.state==='stand'||this.state==='pick'){
    const delta=angleDelta(this.heading,Math.atan2(this.supportY-this.y,this.supportX-this.x));
    this.heading+=clamp(delta,-dt*2,dt*2);
    const supported=(env.perches?.(this.x,this.y,.7)??[]).some(p=>Math.hypot((p.root?.x??p.x)-this.supportX,(p.root?.y??p.y)-this.supportY)<.03);
    if(!supported){this.state='rest';this.timer=3;this.treeTarget=false;return true;}
    if(Math.abs(delta)>.06)return true;
   }
   if(this.state==='rise'||this.state==='lower'){
    this.gait=Math.min(1,this.gait+dt/1.4);
    if(this.gait===1){
     if(this.state==='rise'){this.grounded=false;this.state='rest';this.timer=2;this.cooldown=45+this.random.next()*40;}
     else{this.grounded=true;this.state='forage';this.timer=6+this.random.next()*4;this.treeTarget=false;}
     this.gait=0;
    }
   }else{
    const prior=this.gait;this.gait+=dt*.3*this.pace;
    if(this.timer<=0&&(this.state==='stand'||Math.floor(prior)!==Math.floor(this.gait))){this.state=this.state==='stand'?'pick':'rest';this.gait=0;this.timer=4+this.random.next()*5;if(this.state==='rest'){this.treeTarget=false;this.cooldown=30+this.random.next()*30;}}
   }
   return true;
  }
  if(this.state!=='forage')return false;
  this.motor.stop();this.gait+=dt*.28*this.pace;return true;
 }
 override write(w:BinaryWriter):void {super.write(w);w.u8(Number(this.forageTarget));w.u8(Number(this.treeTarget));w.f64(this.supportX);w.f64(this.supportY);w.u8(Number(this.grounded));w.f64(this.groundTime);}
 static read(r:BinaryReader):BlackBearAgent {
  const a=EcologicalAgent.readAs(r,(...args)=>new BlackBearAgent(...args)),target=r.u8();
  if(target>1)throw new Error('Invalid bear forage target');a.forageTarget=Boolean(target);const tree=r.u8();if(tree>1)throw new Error('Invalid bear tree target');a.treeTarget=Boolean(tree);a.supportX=r.f64();a.supportY=r.f64();const grounded=r.u8();if(grounded>1)throw new Error('Invalid bear posture');a.grounded=Boolean(grounded);a.groundTime=r.f64();if(a.groundTime<0)throw new Error('Invalid bear ground timer');return a;
 }
}
