import { BinaryReader, BinaryWriter, type AgentEnvironment } from '../../agents';
import { clamp } from '../../iso/math';
import { angleDelta, TAU } from '../animation';
import { BEAR_MOTION } from '../bear-motion';
import { EcologicalAgent } from './ecological-base';

/** Mostly quadrupedal woodland forager; solitary adults or a mother with cubs. */
export class BlackBearAgent extends EcologicalAgent {
 readonly kind='blackBear';readonly type=58;
 forageTarget=false;
 /** Actual support coordinates survive the approach, upright pause and lowering. */
 treeTarget=false;supportX=0;supportY=0;
 standCooldown=35;runCooldown=12;
 override update(dt:number,env:AgentEnvironment):void {
  this.standCooldown=Math.max(0,this.standCooldown-dt);
  this.runCooldown=Math.max(0,this.runCooldown-dt);
  super.update(dt,env);
 }
 private supported(env:AgentEnvironment):boolean {
  return this.treeTarget&&(env.perches?.(this.x,this.y,.8)??[]).some(p=>Math.hypot((p.root?.x??p.x)-this.supportX,(p.root?.y??p.y)-this.supportY)<.03);
 }
 private beginAction(state:typeof this.state):void {this.state=state;this.gait=0;this.motor.stop();}
 protected decide(env:AgentEnvironment):void {
  if(['rise','stand','pick','lower','feedDown','feedUp'].includes(this.state))return;
  const family=this.groupId?env.nearby(this.x,this.y,5).filter(n=>n.id!==this.id&&n.groupId===this.groupId).sort((a,b)=>a.id.localeCompare(b.id)):[];
  const mother=family.find(n=>n.id===this.motherId);
  if(mother&&Math.hypot(mother.x-this.x,mother.y-this.y)>.7){
   // Refresh a moving parent's destination; a cub can bound briefly to catch up.
   // Raise a feeding head before departure rather than snapping into a run.
   if(this.state==='forage'){this.beginAction('feedUp');return;}
   const gap=Math.hypot(mother.x-this.x,mother.y-this.y),heading=mother.heading??0;
   for(const offset of [0,.4,-.4,1.8,-1.8,Math.PI]){
    const x=mother.x-Math.cos(heading+offset)*.38,y=mother.y-Math.sin(heading+offset)*.38;
    if(!this.routeClear(x,y,env))continue;
    this.target={x,y};this.forageTarget=false;this.state=gap>1.35||mother.speed>.4?'run':'travel';this.timer=15;this.tripPace=1.12;return;
   }
   // A blocked reunion is a reason to wait and retry, not to wander or play.
   this.motor.stop();this.state='rest';this.timer=1;return;
  }
  if(!this.juvenile&&family.some(n=>n.juvenile&&Math.hypot(n.x-this.x,n.y-this.y)>1.5)){
   if(this.state==='travel'||this.state==='run'){this.motor.stop();this.state='rest';this.timer=1;}return;
  }
  if(this.state==='forage'){if(this.timer<=0)this.beginAction('feedUp');return;}
  if(this.state==='play'){if(this.timer<=0){this.state='rest';this.timer=2;}return;}
  if(this.state!=='rest')return;
  if(this.forageTarget){
   this.forageTarget=false;
   const stand=this.standCooldown===0&&this.supported(env)&&this.random.next()<.35;
   this.beginAction(stand?'rise':'feedDown');return;
  }
  if(this.timer>0)return;
  if(this.repose.cooldown===0&&this.random.next()<.16){this.repose.begin(this.random);this.timer=2;return;}
  if(this.standCooldown===0&&this.random.next()<.10){this.treeTarget=false;this.beginAction('rise');return;}
  if(this.juvenile&&mother&&this.runCooldown===0&&this.random.next()<.18){
   this.beginAction('play');this.timer=3+this.random.next()*2;this.runCooldown=35+this.random.next()*30;return;
  }
  // Seek vegetation to sniff/feed beside, mixed with longer woodland trips.
  // A new trip has its own tempo and heading, never per-tick random jitter.
  const trees=(env.perches?.(this.x,this.y,this.spec.range)??[]).map(p=>p.root??p);
  for(let i=0;i<24;i++){
   const tree=trees.length&&i<12?trees[Math.floor(this.random.next()*trees.length)]:undefined;
   const angle=this.heading+(this.random.next()-.5)*(i<12?Math.PI:TAU),distance=tree?.33*this.size+.04:.45+this.random.next()*1.1;
   const x=(tree?.x??this.x)+Math.cos(angle)*distance,y=(tree?.y??this.y)+Math.sin(angle)*distance;
   if(Math.hypot(x-this.x,y-this.y)<.18||!this.routeClear(x,y,env))continue;
   if(mother&&Math.hypot(x-mother.x,y-mother.y)>1)continue;
   this.target={x,y};this.state='travel';this.timer=18;this.tripPace=.82+this.random.next()*.42;
   this.treeTarget=Boolean(tree);if(tree){this.supportX=tree.x;this.supportY=tree.y;}
   this.forageTarget=this.cooldown===0&&(Boolean(tree)||env.sample(x,y).moisture>.4);
   if(!tree&&!this.forageTarget&&this.runCooldown===0&&this.random.next()<.12){this.state='run';this.tripPace=.90+this.random.next()*.15;this.timer=2.5;this.runCooldown=30+this.random.next()*35;}
   return;
  }
  this.timer=2+this.random.next()*3;
 }
 protected override stationaryAction(dt:number,env:AgentEnvironment):boolean {
  if(['rise','stand','pick','lower'].includes(this.state)){
   this.motor.stop();
   // Losing a support reverses an unfinished rise continuously, or lowers from
   // the upright endpoint. Free-standing sniffing needs no imaginary tree.
   if(this.treeTarget&&!this.supported(env)&&this.state!=='lower'){
    const phase=this.state==='rise'?this.gait:1;this.beginAction('lower');this.gait=1-phase;this.treeTarget=false;
   }
   if(this.treeTarget){
    const delta=angleDelta(this.heading,Math.atan2(this.supportY-this.y,this.supportX-this.x));
    this.heading+=clamp(delta,-dt*2.8,dt*2.8);
    if(this.state==='rise'&&this.gait===0&&Math.abs(delta)>.06)return true;
   }
   if(this.state==='rise'||this.state==='lower'){
    this.gait=Math.min(1,this.gait+dt/BEAR_MOTION.standSeconds);
    if(this.gait===1){
     if(this.state==='rise'){this.state='stand';this.timer=1.5+this.random.next()*2;}
     else{this.state='rest';this.timer=2+this.random.next()*3;this.standCooldown=60+this.random.next()*60;this.cooldown=8;this.treeTarget=false;}
     this.gait=0;
    }
   }else{
    const previous=this.gait;this.gait+=dt*(this.state==='pick'?.6:.35)*this.pace;
    if(this.timer<=0&&(this.state==='stand'||Math.floor(previous)!==Math.floor(this.gait))){
     this.beginAction(this.state==='stand'&&this.treeTarget?'pick':'lower');this.timer=3+this.random.next()*2;
    }
   }
   return true;
  }
  if(this.state==='feedDown'||this.state==='feedUp'){
   this.motor.stop();this.gait=Math.min(1,this.gait+dt/BEAR_MOTION.feedSeconds);
   if(this.gait===1){
    if(this.state==='feedDown'){this.state='forage';this.timer=5+this.random.next()*7;}
    else{this.state='rest';this.timer=1+this.random.next()*2;this.cooldown=10+this.random.next()*15;}
    this.gait=0;
   }
   return true;
  }
  if(this.state!=='forage'&&this.state!=='play')return false;
  this.motor.stop();this.gait+=dt*(this.state==='play'?.7:.55)*this.pace;return true;
 }
 override write(w:BinaryWriter):void {
  super.write(w);w.u8(Number(this.forageTarget));w.u8(Number(this.treeTarget));
  for(const n of [this.supportX,this.supportY,this.standCooldown,this.runCooldown])w.f64(n);
 }
 static read(r:BinaryReader):BlackBearAgent {
  const a=EcologicalAgent.readAs(r,(...args)=>new BlackBearAgent(...args)),target=r.u8(),tree=r.u8();
  if(target>1||tree>1)throw new Error('Invalid bear target');
  a.forageTarget=Boolean(target);a.treeTarget=Boolean(tree);a.supportX=r.f64();a.supportY=r.f64();a.standCooldown=r.f64();a.runCooldown=r.f64();
  if(a.standCooldown<0||a.runCooldown<0)throw new Error('Invalid bear cooldown');return a;
 }
}
