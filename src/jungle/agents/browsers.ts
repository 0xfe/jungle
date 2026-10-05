import { BinaryReader, type AgentEnvironment, herdIntent } from '../../agents';
import { clamp } from '../../iso/math';
import { angleDelta } from '../animation';
import { EcologicalAgent } from './ecological-base';

/** High browser: approaches real foliage, raises its neck, then chews independently. */
export class GiraffeAgent extends EcologicalAgent {
 readonly kind='giraffe';readonly type=42;
 protected decide(env:AgentEnvironment):void {
  const peers=env.nearby(this.x,this.y,4).filter(n=>n.id!==this.id&&n.groupId===this.groupId);
  const guide=peers.find(n=>n.id===(this.motherId||this.leaderId));
  const gap=guide?Math.hypot(guide.x-this.x,guide.y-this.y):0;
  if(gap>1.25&&this.state==='forage'){this.timer=0;return;}
  if(this.state!=='rest')return;
  if(this.routeHeight>0){
   this.routeHeight=0;
   if((env.perches?.(this.x,this.y,.7)??[]).some(p=>Math.hypot((p.root?.x??p.x)-this.routeX,(p.root?.y??p.y)-this.routeY)<.05)){
    this.beginFeeding(8+this.random.next()*10);return;
   }
  }
  if(guide&&gap>.8){
   const intent=herdIntent(this,peers);
   if(intent&&this.routeClear(intent.target.x,intent.target.y,env)){
    this.target={...intent.target};this.state=gap>1.6?'run':'travel';this.timer=20;this.tripPace=.85+this.random.next()*.3;return;
   }
  }
  if(!this.juvenile&&peers.some(n=>n.juvenile&&Math.hypot(n.x-this.x,n.y-this.y)>1.6)){this.timer=1;return;}
  if(this.timer>0)return;
  if(this.cooldown===0){
   const roots=(env.perches?.(this.x,this.y,1.7)??[]).slice(0,32).map(p=>p.root??p);
   for(const root of roots){
    const angle=Math.atan2(this.y-root.y,this.x-root.x),distance=.25*this.size;
    const x=root.x+Math.cos(angle)*distance,y=root.y+Math.sin(angle)*distance;
    if(!this.routeClear(x,y,env)||peers.some(n=>Math.hypot(n.x-x,n.y-y)<.3))continue;
    this.routeX=root.x;this.routeY=root.y;this.routeHeight=1;this.target={x,y};
    this.state='travel';this.timer=20;this.tripPace=.85+this.random.next()*.3;return;
   }
  }
  this.journey(env);
 }
 protected override stationaryAction(dt:number,_env:AgentEnvironment):boolean {
  if(this.state==='feedDown'&&this.gait===0){
   const delta=angleDelta(this.heading,Math.atan2(this.routeY-this.y,this.routeX-this.x));
   this.heading+=clamp(delta,-dt*2,dt*2);this.motor.stop();if(Math.abs(delta)>.06)return true;
  }
  return this.feedingAction(dt,.9,.7);
 }
 static read(r:BinaryReader):GiraffeAgent{return EcologicalAgent.readAs(r,(...a)=>new GiraffeAgent(...a));}
}
