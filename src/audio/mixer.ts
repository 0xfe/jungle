import { BIRD_KINDS, type BirdKind, type SoundTuning, type SoundKind } from './synthesis';
export type AudioKind=SoundKind|'elephant'|'tiger';
export type BedKind='leaves'|'water'|'rain'|'insects'|'hover'|'zen';
export type CallKind=BirdKind|'elephant'|'tiger'|'alien';
export interface AudioEvent { kind:'step'|CallKind; gain:number; pan:number; rate:number }
export interface SoundFrame { beds:Record<BedKind,number>; events:AudioEvent[]; master:number; hoverPan?:number }
export interface AudioSink { apply(frame:SoundFrame):void; dispose():void }
/** A nearby sound source; loop intensity is normalized, rate is an optional voice pitch multiplier. */
export interface SoundEmitter { id:string; x:number;y:number;speed:number;phase:number;bird:boolean;call?:CallKind; loop?:'hover'|'zen'; intensity?:number; rate?:number }
export interface SoundScene { x:number;y:number;water:number;rain:number;canopy:number;night:number;emitters:readonly SoundEmitter[] }
export interface AudioSettings { master:number; ambience:number; wildlife:number }
export const DEFAULT_AUDIO:Readonly<AudioSettings>=Object.freeze({master:.6,ambience:.05,wildlife:.8});
const clamp=(n:number,a=0,b=1)=>Math.max(a,Math.min(b,n));
interface Caller { phase:number;remaining:number;random:number }
function seed(id:string):number {let n=2166136261;for(const c of id)n=Math.imul(n^c.charCodeAt(0),16777619);return n>>>0;}
function random(c:Caller):number {c.random=(Math.imul(c.random,1664525)+1013904223)>>>0;return c.random/4294967296;}
function caller(id:string):Caller {const c={phase:0,remaining:0,random:seed(id)};c.remaining=.3+random(c)*3.5;return c;}
const CHOIR_PALETTES:readonly (readonly BirdKind[])[]=[['bird','warble'],['trill','chatter'],['woodpecker','bird']];
export interface SoundscapeOptions {
 radius?:number; maxEmitters?:number; maxEvents?:number; callGapMin?:number; callGapMax?:number;
 pitchMin?:number; pitchMax?:number; chorus?:boolean; sounds?:Partial<Record<AudioKind,SoundTuning>>;
}
/** Independent callers share bounded PCM, never simulation RNG or an unbounded event history. */
export class Soundscape {
 constructor(private readonly options:SoundscapeOptions={}){}
 private voices=new Map<string,Caller>();private choir=[caller('canopy-low'),caller('canopy-trill'),caller('canopy-drum')];private eventClock=0;
 update(scene:SoundScene,dt:number,settings:AudioSettings=DEFAULT_AUDIO,active=true):SoundFrame{
  const o=this.options,radius=o.radius??5;
  const events:AudioEvent[]=[],step=active?clamp(dt,0,.5):0;this.eventClock=Math.max(0,this.eventClock-step);
  const nearby=scene.emitters.filter(a=>Math.hypot(a.x-scene.x,a.y-scene.y)<radius).sort((a,b)=>Math.hypot(a.x-scene.x,a.y-scene.y)-Math.hypot(b.x-scene.x,b.y-scene.y)||a.id.localeCompare(b.id)).slice(0,o.maxEmitters??32);
  const next=new Map<string,Caller>(),wildlife=clamp(settings.wildlife);
  const emit=(c:Caller,kind:CallKind,gain:number,pan:number,voiceRate=1)=>{
   const rate=(kind==='elephant'||kind==='tiger')?.92+random(c)*.16:(o.pitchMin??.8)+random(c)*((o.pitchMax??1.24)-(o.pitchMin??.8));
   if(o.sounds?.[kind]?.enabled!==false)events.push({kind,gain:gain*wildlife,pan,rate:rate*voiceRate});
   // Different pauses and pitches on every phrase; rain/dusk leave more space.
   c.remaining=(kind==='tiger'?30:kind==='elephant'?18+random(c)*24:(o.callGapMin??1.5)+random(c)*((o.callGapMax??6)-(o.callGapMin??1.5)))*(1+scene.rain*.45+scene.night*.55)*(o.sounds?.[kind]?.intervalScale??1);
  };
  let hover=0,hoverPan=0,zen=0;
  for(const a of nearby){
   const phase=Math.floor(a.phase*2),old=this.voices.get(a.id),c=old??caller(a.id),distance=Math.hypot(a.x-scene.x,a.y-scene.y);
   const gain=(1-distance/radius)**2,pan=clamp(((a.x-scene.x)-(a.y-scene.y))/6,-1,1);
   if(a.loop==='zen'){zen+=gain*clamp(a.intensity??1);continue;}
   if(a.loop==='hover'){const weight=gain*clamp(a.intensity??1);hover+=weight;hoverPan+=pan*weight;continue;}
   if(!old&&a.call==='tiger')c.remaining=.1;
   c.remaining-=step;
   if(active&&events.length<(o.maxEvents??4)&&wildlife>0){
    if((a.bird||a.call!==undefined)&&c.remaining<=0)emit(c,a.call??BIRD_KINDS[Math.floor(random(c)*4)]!,gain*.55,pan,a.rate);
    else if(!a.bird&&a.speed>.03&&old&&phase!==old.phase&&this.eventClock<=0){if(o.sounds?.step?.enabled!==false)events.push({kind:'step',gain:gain*wildlife*.5,pan,rate:.92+random(c)*.16});this.eventClock=.18*(o.sounds?.step?.intervalScale??1);}
   }
   c.phase=phase;next.set(a.id,c);
  }
  this.voices=next;
  // Three distant canopy callers add a sparse chorus even when visible animals are scarce.
  // They are sound layers, not invisible animal agents, and do not accumulate with travel.
  for(let i=0;i<(o.chorus===false?0:this.choir.length);i++){
   const c=this.choir[i]!;if(scene.canopy>.06)c.remaining-=step;
   if(active&&scene.canopy>.06&&wildlife>0&&c.remaining<=0&&events.length<(o.maxEvents??4)){
    const choices=CHOIR_PALETTES[i]!.filter(kind=>o.sounds?.[kind]?.enabled!==false);if(!choices.length)continue;
    emit(c,choices[Math.floor(random(c)*choices.length)]!, (.12+.2*scene.canopy)*(.8+random(c)*.4), (i-1)*.65+(random(c)-.5)*.3);
    c.remaining*=1.25-.35*clamp(scene.canopy);
   }
  }
  const g=clamp(settings.ambience);
  return {master:active?clamp(settings.master)*.75:0,beds:{zen:active&&o.sounds?.zen?.enabled!==false?clamp(zen)*g*3:0,leaves:g*(.3+.55*clamp(scene.canopy)),water:g*.65*clamp(scene.water),rain:g*.8*clamp(scene.rain),insects:g*.5*clamp(scene.night),hover:active&&o.sounds?.hover?.enabled!==false?clamp(hover)*wildlife*.65:0},hoverPan:hover?hoverPan/hover:0,events};
 }
 get trackedEmitters(){return this.voices.size;}
 reset(){this.voices.clear();this.choir=[caller('canopy-low'),caller('canopy-trill'),caller('canopy-drum')];this.eventClock=0;}
}
/** In-memory sink useful for application tests; keeps only the latest frame. */
export class MemoryAudioSink implements AudioSink {frame?:SoundFrame;apply(frame:SoundFrame){this.frame=structuredClone(frame);}dispose(){this.frame=undefined;}}
export const BED_KINDS:readonly BedKind[]=['leaves','water','rain','insects','hover','zen'];
export const SOUND_KINDS:readonly SoundKind[]=[...BED_KINDS,'step','alien',...BIRD_KINDS];
