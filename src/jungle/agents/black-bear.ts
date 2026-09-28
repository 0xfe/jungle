import { BinaryReader, BinaryWriter, type AgentEnvironment } from '../../agents';
import { TAU } from '../animation';
import { EcologicalAgent } from './ecological-base';

/** Solitary woodland forager, or a mother with dependent cubs. No hunting/pack behavior. */
export class BlackBearAgent extends EcologicalAgent {
 readonly kind='blackBear';readonly type=58;
 forageTarget=false;
 protected decide(env:AgentEnvironment):void {
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
   if(this.timer<=0){this.state='rest';this.timer=3+this.random.next()*5;this.cooldown=8+this.random.next()*10;}
   return;
  }
  if(this.state!=='rest')return;
  if(this.forageTarget){this.forageTarget=false;this.state='forage';this.gait=0;this.timer=5+this.random.next()*7;return;}
  if(this.timer>0)return;
  // Search beside actual trunks, preferring nearby supports; never target their
  // solid root. Bounded probes retain dry-footed routes and owner territory.
  const trees=env.perches?.(this.x,this.y,this.spec.range)??[];
  for(let i=0;i<24;i++){
   const tree=trees.length?trees[Math.floor(this.random.next()*trees.length)]:undefined;
   const angle=this.random.next()*TAU,distance=tree?.33:.3+this.random.next()*.9;
   const x=(tree?.x??this.x)+Math.cos(angle)*distance,y=(tree?.y??this.y)+Math.sin(angle)*distance;
   if(Math.hypot(x-this.x,y-this.y)<.15||!this.routeClear(x,y,env))continue;
   if(mother&&Math.hypot(x-mother.x,y-mother.y)>.85)continue;
   this.target={x,y};this.state='travel';this.timer=25;this.tripPace=.75+this.random.next()*.3;
   this.forageTarget=this.cooldown===0&&(Boolean(tree)||env.sample(x,y).moisture>.45);return;
  }
  this.timer=2+this.random.next()*3;
 }
 protected override stationaryAction(dt:number,_env:AgentEnvironment):boolean {
  if(this.state!=='forage')return false;
  this.motor.stop();this.gait+=dt*.28*this.pace;return true;
 }
 override write(w:BinaryWriter):void {super.write(w);w.u8(Number(this.forageTarget));}
 static read(r:BinaryReader):BlackBearAgent {
  const a=EcologicalAgent.readAs(r,(...args)=>new BlackBearAgent(...args)),target=r.u8();
  if(target>1)throw new Error('Invalid bear forage target');a.forageTarget=Boolean(target);return a;
 }
}
