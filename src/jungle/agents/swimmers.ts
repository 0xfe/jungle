import { BinaryReader,herdIntent,type AgentEnvironment } from '../../agents';
import { EcologicalAgent } from './ecological-base';

/** School members blend a moving lead, separation and a bounded aquatic escape. */
export class FishAgent extends EcologicalAgent {
 readonly kind='fish';readonly type=46;
 get alarm(){return this.startle.remaining;}
 protected decide(env:AgentEnvironment):void {
  const peers=env.nearby(this.x,this.y,3),school=peers.filter(n=>n.id!==this.id&&n.kind==='fish'&&n.groupId===this.groupId);
  const danger=peers.find(n=>n.id!==this.id&&((n.stimulus?.kind==='splash')||(['kingfisher','pelican'].includes(n.kind)&&(n.altitude??0)<6&&n.speed>.1))&&Math.hypot(n.x-this.x,n.y-this.y)<.8);
  if(danger){
   this.startle.remaining=2;const angle=Math.atan2(this.y-danger.y,this.x-danger.x);
   for(const d of [.7,.4,.2]){const x=this.x+Math.cos(angle)*d,y=this.y+Math.sin(angle)*d;if(this.routeClear(x,y,env)){this.target={x,y};this.state='travel';this.timer=4;this.tripPace=1.8;return;}}
  }
  if(this.startle.remaining>0||this.state==='feed')return;
  const guide=school.find(n=>n.id===(this.motherId||this.leaderId));
  if(guide){
   let x=guide.x+Math.cos(guide.heading??0)*.28,y=guide.y+Math.sin(guide.heading??0)*.28;
   for(const peer of school){const d=Math.hypot(peer.x-this.x,peer.y-this.y);if(d>0&&d<.22){x+=(this.x-peer.x)*(.22-d)/d;y+=(this.y-peer.y)*(.22-d)/d;}}
   if(Math.hypot(x-this.x,y-this.y)>.18&&this.routeClear(x,y,env)){this.target={x,y};this.state='travel';this.timer=12;this.tripPace=.85+Math.min(.35,Math.hypot(x-this.x,y-this.y)*.3);return;}
  }
  if(this.state==='rest'&&this.timer<=0&&this.cooldown===0&&(!guide||guide.speed<.05)){
   this.beginActivity('feed',2.5);this.cooldown=18+this.random.next()*20;return;
  }
  if(this.state==='rest'||Math.hypot(this.target.x-this.x,this.target.y-this.y)<.2||this.timer<=0)this.journey(env);
 }
 protected override stationaryAction(_dt:number,_env:AgentEnvironment):boolean {
  this.altitude=this.state==='feed'?-2+Math.sin(this.gait*Math.PI)**2*1.5:-2;return false;
 }
 static read(r:BinaryReader){return EcologicalAgent.readAs(r,(...a)=>new FishAgent(...a));}
}
/** Deep-water courses turn well ahead of arrival; strokes are aquatic, not foot strides. */
export class WhaleAgent extends EcologicalAgent {
 readonly kind='whale';readonly type=47;
 protected decide(env:AgentEnvironment):void {
  if(this.timer<=0||this.state==='rest'||Math.hypot(this.target.x-this.x,this.target.y-this.y)<.25)this.journey(env);
 }
 static read(r:BinaryReader){return EcologicalAgent.readAs(r,(...a)=>new WhaleAgent(...a));}
}
