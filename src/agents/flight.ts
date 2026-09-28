import { ease } from './motion';
import { BinaryReader, BinaryWriter, type AgentRandom } from './core';
export interface FlightProfile { beats:number; burst:number; glide:number; }
/** Small deterministic powered/glide controller. A glide begins at a level-wing
 * cycle boundary, so held wings don't freeze halfway through a downstroke. */
export class FlightMotion {
 powered=true; remaining=0; cadence=0; lift=0;
 advance(phase:number,dt:number,climb:number,pace:number,random:AgentRandom,profile:FlightProfile):number {
  this.remaining-=dt;
  if(!this.powered && (this.remaining<=0||climb>8)){
   this.powered=true;this.remaining=profile.burst*(.7+random.next()*.6);
  }
  if(this.powered && this.cadence===0){this.remaining=profile.burst*(.7+random.next()*.6);this.cadence=profile.beats*pace;}
  const target=profile.beats*pace*(climb>3?1.22:1)*(.94+.06*Math.sin(phase*.73));
  this.cadence=ease(this.cadence,target,.25,dt);
  let next=phase;
  if(this.powered){
   next+=dt*this.cadence;
   if(this.remaining<=0&&climb<5&&Math.floor(next)>Math.floor(phase)){
    next=Math.floor(next);this.powered=false;this.remaining=profile.glide*(.65+random.next()*.7);
   }
  }
  this.lift=Math.max(-3,Math.min(10,this.lift+dt*(this.powered?5:-4)));
  return next;
 }
 write(w:BinaryWriter):void {w.u8(Number(this.powered));for(const n of [this.remaining,this.cadence,this.lift])w.f64(n);}
 read(r:BinaryReader):void {const p=r.u8();if(p>1)throw new Error('Invalid flight state');this.powered=!!p;this.remaining=r.f64();this.cadence=r.f64();this.lift=r.f64();}
}
