export const REPOSE_CLIPS={lieDown:16,lying:8,shift:16} as const;
export const REPOSE_DIRECTIONS=16;
import { AgentRandom, BinaryReader, BinaryWriter } from './core';
import { lerp } from '../iso/math';

/** Quiet ground rest, independent of a species' travel state. All time is injected. */
export class Repose {
  mode: 'awake'|'down'|'lying'|'shift'|'up' = 'awake';
  amount=0;previousAmount=0;phase=0;previousPhase=0;
  remaining=0;shiftIn=12;cooldown=25;
  get active():boolean {return this.mode!=='awake';}
  begin(random:AgentRandom):void {
    if(this.active)return;
    this.mode='down';this.amount=this.previousAmount=0;this.phase=this.previousPhase=0;
    this.remaining=30+random.next()*65;this.shiftIn=12+random.next()*18;
  }
  /** Rising can interrupt lowering continuously; never teleport a lying body upright. */
  update(dt:number,random:AgentRandom,wake=false):boolean {
    this.previousAmount=this.amount;this.previousPhase=this.phase;
    this.cooldown=Math.max(0,this.cooldown-dt);
    if(!this.active)return false;
    if(wake)this.mode='up';
    if(this.mode==='down'||this.mode==='up'){
      this.amount=Math.max(0,Math.min(1,this.amount+dt/1.3*(this.mode==='down'?1:-1)));
      if(this.mode==='down'&&this.amount===1){this.mode='lying';this.phase=this.previousPhase=0;}
      else if(this.mode==='up'&&this.amount===0){this.mode='awake';this.cooldown=35+random.next()*50;}
    }else{
      this.remaining-=dt;this.shiftIn-=dt;this.phase+=dt/(this.mode==='shift'?3.5:6);
      if(this.mode==='shift'&&this.phase>=1){this.mode='lying';this.phase=this.previousPhase=0;this.shiftIn=14+random.next()*20;}
      if(this.remaining<=0){this.mode='up';}
      else if(this.mode==='lying'&&this.shiftIn<=0){this.mode='shift';this.phase=this.previousPhase=0;}
    }
    return true;
  }
  pose(alpha:number):{clip:'lieDown'|'lying'|'shift';phase:number} {
    return this.mode==='down'||this.mode==='up'||this.mode==='awake'
      ?{clip:'lieDown',phase:lerp(this.previousAmount,this.amount,alpha)}
      :{clip:this.mode,phase:lerp(this.previousPhase,this.phase,alpha)%1};
  }
  write(w:BinaryWriter):void {
    w.u8(['awake','down','lying','shift','up'].indexOf(this.mode));
    for(const n of [this.amount,this.previousAmount,this.phase,this.previousPhase,this.remaining,this.shiftIn,this.cooldown])w.f64(n);
  }
  read(r:BinaryReader):void {
    const mode=(['awake','down','lying','shift','up'] as const)[r.u8()];if(!mode)throw new Error('Invalid repose state');this.mode=mode;
    this.amount=r.f64();this.previousAmount=r.f64();this.phase=r.f64();this.previousPhase=r.f64();this.remaining=r.f64();this.shiftIn=r.f64();this.cooldown=r.f64();
    if(this.amount<0||this.amount>1||this.previousAmount<0||this.previousAmount>1||this.cooldown<0)throw new Error('Invalid repose progress');
  }
}
