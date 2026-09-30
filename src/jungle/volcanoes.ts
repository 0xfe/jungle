import { CONFIG } from '../config';
import { TILE } from './geometry';
import { clamp, hash, lerp, unproject } from '../iso/math';

/** Stateless landmarks: one eligible site per widely separated ownership cell. */
export interface Volcano { id:string; x:number; y:number; form:number; radius:number; phase:number; heading:number }
export interface LavaPoint { x:number; y:number; width:number; heat:number; normalX:number; normalY:number }
export const VOLCANO_REACH=11;
export function volcanoSite(cx:number,cy:number,seed:number):Volcano|undefined {
  const c=CONFIG.world.volcanoes;
  if(hash(cx,cy,seed+8101)>c.frequency)return;
  const x=(cx+.5)*c.spacing+(hash(cx,cy,seed+8102)-.5)*c.spacing*.3;
  const y=(cy+.5)*c.spacing+(hash(cx,cy,seed+8103)-.5)*c.spacing*.3;
  if(Math.hypot(x,y)<40)return;
  return{id:`volcano:${cx}:${cy}`,x,y,form:Math.floor(hash(cx,cy,seed+8104)*4),radius:2.2+hash(cx,cy,seed+8105)*.65,phase:hash(cx,cy,seed+8106)*100,heading:Math.PI/4+(hash(cx,cy,seed+8107)-.5)*.7};
}
export function volcanoesIn(bounds:{minX:number;minY:number;maxX:number;maxY:number},seed:number,halo=VOLCANO_REACH):Volcano[] {
  const size=CONFIG.world.volcanoes.spacing,result:Volcano[]=[];
  for(let cy=Math.floor((bounds.minY-halo)/size);cy<=Math.floor((bounds.maxY+halo)/size);cy++)for(let cx=Math.floor((bounds.minX-halo)/size);cx<=Math.floor((bounds.maxX+halo)/size);cx++){
    const v=volcanoSite(cx,cy,seed);
    if(v&&v.x>=bounds.minX-halo&&v.x<=bounds.maxX+halo&&v.y>=bounds.minY-halo&&v.y<=bounds.maxY+halo)result.push(v);
  }
  return result;
}
/** The same signed-coordinate radial scar controls ground, vegetation and clearance. */
export function volcanicGround(x:number,y:number,seed:number):{scar:number;core:boolean} {
  const sites=volcanoesIn({minX:x,minY:y,maxX:x,maxY:y},seed,9);
  let scar=0,core=false;
  for(const v of sites){const d=Math.hypot(x-v.x,y-v.y);scar=Math.max(scar,clamp((8.5-d)/4.5,0,1));core ||= d<v.radius+.3;}
  return{scar,core};
}
/** Reviewed outlets in the baker's 104 × 88 registered images, before logical scaling.
 * Each channel begins on the painted lava, with the same width and downhill direction.
 */
export const VOLCANO_OUTLETS = [
  {x:64,y:77,width:.13,heading:1.35},
  {x:62,y:76,width:.12,heading:1.2},
  {x:46,y:74,width:.14,heading:1.25},
  {x:68,y:79,width:.16,heading:.6},
] as const;
export const VOLCANO_ART_SCALE=512/104;
export const LAVA_SEGMENTS=48;

/** A permanently filled channel widens into a short, rounded terminal pool. */
export function lavaPoint(v:Volcano,t:number,_time=0):LavaPoint {
  const outlet=VOLCANO_OUTLETS[v.form]!,offset=unproject({x:(outlet.x-52)*VOLCANO_ART_SCALE,y:(outlet.y-71.5)*VOLCANO_ART_SCALE},TILE);
  const angle=outlet.heading,length=1.9+hash(v.form,0,v.phase)*.35;
  const bend=.22*Math.sin(t*6)*t,derivative=.22*(Math.sin(t*6)+6*t*Math.cos(t*6));
  const dx=Math.cos(angle)*length-Math.sin(angle)*derivative,dy=Math.sin(angle)*length+Math.cos(angle)*derivative,n=Math.hypot(dx,dy);
  const bank=1+t*(.12*Math.sin(t*39+v.phase)+.08*Math.sin(t*73));
  const channel=lerp(outlet.width,.22,Math.min(1,t*3));
  const pool=t>.55?.36*Math.sqrt(Math.max(0,1-((t-.77)/.23)**2)):0;
  const cap=t>.93?Math.sqrt(Math.max(0,1-((t-.93)/.07)**2)):1;
  return{x:v.x+offset.x+Math.cos(angle)*length*t-Math.sin(angle)*bend,
    y:v.y+offset.y+Math.sin(angle)*length*t+Math.cos(angle)*bend,
    width:Math.max(channel*cap,pool)*bank,heat:1,normalX:-dy/n,normalY:dx/n};
}
export interface LavaSegment { a:LavaPoint; b:LavaPoint }
// Static geometry is shared by every tick, presentation frame and movement probe.
// Capped across streamed sites; time never invalidates it.
const lavaCache=new Map<string,readonly LavaSegment[]>();
export function lavaSegments(v:Volcano,_time=0):readonly LavaSegment[] {
  const key=`${v.id}:${v.x}:${v.y}:${v.form}:${v.phase}`,cached=lavaCache.get(key);if(cached)return cached;
  const points=Array.from({length:LAVA_SEGMENTS+1},(_,i)=>lavaPoint(v,i/LAVA_SEGMENTS));
  const segments=points.slice(1).map((b,i)=>({a:points[i]!,b}));
  if(lavaCache.size>=8)lavaCache.delete(lavaCache.keys().next().value!);
  lavaCache.set(key,segments);return segments;
}
/** Signed bank distance; both molten channel and pooled end stay hazardous. */
export function lavaDanger(v:Volcano,x:number,y:number,_time=0):{heat:number;distance:number;away:number} {
  let distance=Infinity,away=Math.atan2(y-v.y,x-v.x);
  for(const {a,b} of lavaSegments(v)){
    const dx=b.x-a.x,dy=b.y-a.y,t=clamp(((x-a.x)*dx+(y-a.y)*dy)/(dx*dx+dy*dy),0,1),px=a.x+dx*t,py=a.y+dy*t;
    const d=Math.hypot(x-px,y-py)-lerp(a.width,b.width,t);
    if(d<distance){distance=d;away=Math.atan2(y-py,x-px);}
  }
  return{heat:1,distance,away};
}
/** Avoid the inner ash bed as well as the river; the sparse outer belt stays usable. */
export function volcanicClearance(v:Volcano,x:number,y:number):number {
  const radial=Math.hypot(x-v.x,y-v.y)-(v.radius*.7+.3);
  // The entire short flow is within five tiles; distant probes need no segment scan.
  if(radial>4)return radial;
  return Math.min(radial,lavaDanger(v,x,y).distance-.5);
}
export function nearestVolcano(seed:number,x=0,y=0):Volcano {
  const s=CONFIG.world.volcanoes.spacing,cx=Math.floor(x/s),cy=Math.floor(y/s);let best:Volcano|undefined;
  for(let r=0;r<=8;r++){
    for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++)if(Math.max(Math.abs(dx),Math.abs(dy))===r){const v=volcanoSite(cx+dx,cy+dy,seed);if(v&&(!best||Math.hypot(v.x-x,v.y-y)<Math.hypot(best.x-x,best.y-y)))best=v;}
    if(best&&r*s>Math.hypot(best.x-x,best.y-y)+s)return best;
  }
  if(!best)throw new Error('No volcano found within the bounded landmark search');return best;
}
