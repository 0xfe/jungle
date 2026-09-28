import type { SoundKind } from './synthesis';
export type BedKind='leaves'|'water'|'rain'|'insects';
export interface AudioEvent { kind:'step'|'bird'; gain:number; pan:number; rate:number }
export interface SoundFrame { beds:Record<BedKind,number>; events:AudioEvent[]; master:number }
export interface AudioSink { apply(frame:SoundFrame):void; dispose():void }
export interface SoundEmitter { id:string; x:number;y:number;speed:number;phase:number;bird:boolean }
export interface SoundScene { x:number;y:number;water:number;rain:number;canopy:number;night:number;emitters:readonly SoundEmitter[] }
export interface AudioSettings { master:number; ambience:number; wildlife:number }
export const DEFAULT_AUDIO:Readonly<AudioSettings>=Object.freeze({master:.5,ambience:.7,wildlife:.55});
const clamp=(n:number,a=0,b=1)=>Math.max(a,Math.min(b,n));
/** Content-independent listener and event planner; bounded history, no DOM or audio nodes. */
export class Soundscape {
 private phase=new Map<string,number>();private chirp=4;private eventClock=0;
 update(scene:SoundScene,dt:number,settings:AudioSettings=DEFAULT_AUDIO,active=true):SoundFrame{
  const events:AudioEvent[]=[];this.chirp-=dt;this.eventClock=Math.max(0,this.eventClock-dt);
  const nearby=scene.emitters.filter(a=>Math.hypot(a.x-scene.x,a.y-scene.y)<5).sort((a,b)=>Math.hypot(a.x-scene.x,a.y-scene.y)-Math.hypot(b.x-scene.x,b.y-scene.y)).slice(0,32);
  const next=new Map<string,number>();
  for(const a of nearby){
   const phase=Math.floor(a.phase*2),old=this.phase.get(a.id),distance=Math.hypot(a.x-scene.x,a.y-scene.y);
   next.set(a.id,phase);
   const step=!a.bird&&a.speed>.03&&old!==undefined&&phase!==old&&this.eventClock<=0;
   const bird=a.bird&&this.chirp<=0;
   if(active&&(step||bird)&&events.length<2){
    const gain=(1-distance/5)**2*clamp(settings.wildlife)*(bird?.7:.5);
    events.push({kind:bird?'bird':'step',gain,pan:clamp(((a.x-scene.x)-(a.y-scene.y))/6,-1,1),rate:bird?.85+(a.id.length%7)*.05:1});
    if(bird)this.chirp=4+(a.id.length%7);else this.eventClock=.18;
   }
  }
  this.phase=next;
  const g=clamp(settings.ambience);
  return {master:active?clamp(settings.master)*.75:0,beds:{leaves:g*(.3+.55*clamp(scene.canopy)),water:g*.65*clamp(scene.water),rain:g*.8*clamp(scene.rain),insects:g*.5*clamp(scene.night)},events};
 }
 get trackedEmitters(){return this.phase.size;}
 reset(){this.phase.clear();this.chirp=4;this.eventClock=0;}
}
/** In-memory sink useful for application tests; keeps only the latest frame. */
export class MemoryAudioSink implements AudioSink {frame?:SoundFrame;apply(frame:SoundFrame){this.frame=structuredClone(frame);}dispose(){this.frame=undefined;}}
export const BED_KINDS:readonly BedKind[]=['leaves','water','rain','insects'];
export const SOUND_KINDS:readonly SoundKind[]=[...BED_KINDS,'step','bird'];
