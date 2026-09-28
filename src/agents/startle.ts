import {BinaryReader,BinaryWriter,type Neighbor} from './core';
import type {Vec2} from '../iso/math';
/** A localized stimulus carried in a neighbor snapshot, never a direct mutation. */
export interface LocalStimulus extends Vec2 { kind:'splash'; radius:number }
/** Small reusable response memory; callers own species-specific escape mechanics. */
export class StartleResponse {
 remaining=0;cooldown=0;heading=0;
 update(dt:number):void {this.remaining=Math.max(0,this.remaining-dt);this.cooldown=Math.max(0,this.cooldown-dt);}
 sense(self:Vec2&{id:string},neighbors:readonly Neighbor[]):boolean {
  if(this.cooldown>0)return false;
  let source:Neighbor|undefined;
  for(const n of neighbors){const s=n.stimulus;
   if(n.id!==self.id&&s?.kind==='splash'&&Math.hypot(s.x-self.x,s.y-self.y)<=s.radius&&(!source||n.id<source.id))source=n;
  }
  if(!source)return false;
  this.heading=Math.atan2(self.y-source.y,self.x-source.x);this.remaining=3;this.cooldown=9;return true;
 }
 write(w:BinaryWriter):void {w.f64(this.remaining);w.f64(this.cooldown);w.f64(this.heading);}
 read(r:BinaryReader):void {this.remaining=r.f64();this.cooldown=r.f64();this.heading=r.f64();}
}
