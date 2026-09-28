import { BinaryReader, BinaryWriter, ease, type Agent, type AgentEnvironment } from '../../agents';
import { lerp } from '../../iso/math';
import { PATCH_KINDS, isGrove, pieceSupports, type LandscapePiece, type TreeSupport } from '../patches';
/** One animated compound landscape spanning 16 tiles plus overlapping border vegetation.
 * Components, trunk templates and atlas definitions have no independent simulation clocks. */
export class LandscapePatchAgent implements Agent {
 readonly type=60; readonly kind='landscapePatch'; previousPhase:number; rate=1;
 readonly supports:readonly TreeSupport[];
 readonly pieces:readonly LandscapePiece[];
 constructor(readonly id:string,public x:number,public y:number,pieces:readonly LandscapePiece[],public phase=0){
  if(pieces.length>64)throw new Error('Landscape arrangement exceeds component budget');
  this.pieces=Object.freeze(pieces.map(p=>{
   if(!PATCH_KINDS.includes(p.style)||!Number.isInteger(p.variant)||p.variant<0||p.variant>3||!Number.isInteger(p.tint)||p.tint<0||p.tint>2||p.scale<=0||p.scale>1.5||p.opacity<0||p.opacity>1||!Number.isInteger(p.trees)||p.trees<0||p.trees>7||(!isGrove(p.style)&&p.trees!==0)||[p.x,p.y,p.scale,p.opacity,p.phase].some(n=>!Number.isFinite(n)))throw new Error('Invalid landscape component');
   return Object.freeze({...p});
  }));
  this.previousPhase=phase;this.supports=Object.freeze(this.pieces.flatMap(p=>pieceSupports(p)).map(p=>Object.freeze(p)));
 }
 update(dt:number,e:AgentEnvironment):void {this.previousPhase=this.phase;this.rate=ease(this.rate,e.sample(this.x,this.y).wind,1,dt);this.phase+=dt*this.rate;}
 animationPhase(alpha:number):number{return lerp(this.previousPhase,this.phase,alpha);}
 write(w:BinaryWriter):void {
  w.string(this.id);for(const n of [this.x,this.y,this.phase,this.previousPhase,this.rate])w.f64(n);
  w.u8(this.pieces.length);
  for(const p of this.pieces){w.u8(PATCH_KINDS.indexOf(p.style));w.u8(p.variant);w.u8(p.tint);w.u8(p.trees);for(const n of [p.x,p.y,p.scale,p.opacity,p.phase])w.f64(n);}
 }
 static read(r:BinaryReader):LandscapePatchAgent {
  const id=r.string(),x=r.f64(),y=r.f64(),phase=r.f64(),previous=r.f64(),rate=r.f64(),count=r.u8();
  if(count>64)throw new Error('Landscape arrangement exceeds component budget');
  const pieces:LandscapePiece[]=[];
  for(let i=0;i<count;i++){
   const style=PATCH_KINDS[r.u8()],variant=r.u8(),tint=r.u8(),trees=r.u8();if(!style)throw new Error('Invalid landscape component style');
   pieces.push({style,variant,tint,trees,x:r.f64(),y:r.f64(),scale:r.f64(),opacity:r.f64(),phase:r.f64()});
  }
  const a=new LandscapePatchAgent(id,x,y,pieces,phase);a.previousPhase=previous;a.rate=rate;return a;
 }
}
