import { CONFIG } from '../config';
import { clamp, hash, lerp } from '../iso/math';

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
/** Fixed downhill lobes branch at the foot; pulse fronts cool into a persistent black crust. */
export function lavaPoint(v:Volcano,branch:number,t:number,time:number):LavaPoint {
  const angle=v.heading+(branch-1)*.67;
  const d=v.radius*.35+t*(5.1+hash(branch,v.form,8131)*1.5);
  const bend=Math.sin(t*5+v.phase+branch)*t*.5;
  // A shared analytic tangent welds ribbon edges between adjacent segments.
  const bendSlope=Math.sin(t*5+v.phase+branch)*.5+Math.cos(t*5+v.phase+branch)*t*2.5;
  const length=5.1+hash(branch,v.form,8131)*1.5;
  const dx=Math.cos(angle)*length-Math.sin(angle)*bendSlope,dy=Math.sin(angle)*length+Math.cos(angle)*bendSlope,n=Math.hypot(dx,dy);
  const cycle=(time+v.phase+branch*8)%CONFIG.world.volcanoes.surgePeriod;
  const front=clamp(cycle/9,0,1),age=cycle-t*9;
  const heat=t<.18?Math.max(.8,clamp(1-Math.max(0,age-7)/24,.06,1)):t<front?clamp(1-Math.max(0,age-7)/24,.06,1):.04;
  return{x:v.x+Math.cos(angle)*d-Math.sin(angle)*bend,y:v.y+Math.sin(angle)*d+Math.cos(angle)*bend,width:lerp(.21,.085,t)*(1+.22*Math.sin(t*13+branch)),heat,normalX:-dy/n,normalY:dx/n};
}
export const LAVA_SEGMENTS=32;
interface LavaSegment { a:LavaPoint; b:LavaPoint }
// Geometry is shared across perception calls in one tick, capped across sites/time.
const lavaCache=new Map<string,{time:number;segments:LavaSegment[]}>();
export function lavaSegments(v:Volcano,time:number):readonly LavaSegment[] {
  const key=v.id+':'+v.phase;const cached=lavaCache.get(key);if(cached?.time===time)return cached.segments;
  const segments:LavaSegment[]=[];
  for(let branch=0;branch<3;branch++)for(let i=0;i<LAVA_SEGMENTS;i++)segments.push({a:lavaPoint(v,branch,i/LAVA_SEGMENTS,time),b:lavaPoint(v,branch,(i+1)/LAVA_SEGMENTS,time)});
  if(lavaCache.size>=8)lavaCache.delete(lavaCache.keys().next().value!);
  lavaCache.set(key,{time,segments});return segments;
}
/** Segment distance is shared by visible ribbon geometry and physical contact. */
export function lavaDanger(v:Volcano,x:number,y:number,time:number):{heat:number;distance:number;away:number} {
  let distance=Infinity,heat=0,away=Math.atan2(y-v.y,x-v.x);
  for(const {a,b} of lavaSegments(v,time)){
    const dx=b.x-a.x,dy=b.y-a.y,t=clamp(((x-a.x)*dx+(y-a.y)*dy)/(dx*dx+dy*dy),0,1),px=a.x+dx*t,py=a.y+dy*t;
    const d=Math.hypot(x-px,y-py)-lerp(a.width,b.width,t);
    if(Math.max(a.heat,b.heat)>.35&&d<distance){distance=d;heat=lerp(a.heat,b.heat,t);away=Math.atan2(y-py,x-px);}
  }
  return{heat,distance,away};
}
export function nearestVolcano(seed:number,x=0,y=0):Volcano {
  const s=CONFIG.world.volcanoes.spacing,cx=Math.floor(x/s),cy=Math.floor(y/s);let best:Volcano|undefined;
  for(let r=0;r<=8;r++){
    for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++)if(Math.max(Math.abs(dx),Math.abs(dy))===r){const v=volcanoSite(cx+dx,cy+dy,seed);if(v&&(!best||Math.hypot(v.x-x,v.y-y)<Math.hypot(best.x-x,best.y-y)))best=v;}
    if(best&&r*s>Math.hypot(best.x-x,best.y-y)+s)return best;
  }
  if(!best)throw new Error('No volcano found within the bounded landmark search');return best;
}
