/** Shared pose geometry keeps the baked trunk and the runtime water nozzle registered. */
export type ElephantPoint=readonly[number,number,number];
export const ELEPHANT_DRINK_SECONDS=5.4, ELEPHANT_SPRAY_SECONDS=2.8;
export const ELEPHANT_MODEL_TO_TILE=21*1.65*Math.SQRT1_2/96;
const smooth=(t:number)=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
const mix=(a:ElephantPoint,b:ElephantPoint,t:number):ElephantPoint=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t];
const root:ElephantPoint=[.94,0,1.53];
const relaxed:readonly ElephantPoint[]=[root,[1.15,0,1.02],[1.04,.015,.24],[1.28,.03,.18]];
const dip:readonly ElephantPoint[]=[root,[1.18,0,1.02],[1.59,0,.04],[1.95,0,-.02]];
const mouth:readonly ElephantPoint[]=[root,[1.74,0,1.34],[1.62,0,.66],[.99,0,1.16]];
const raised:readonly ElephantPoint[]=[root,[1.27,0,1.65],[1.62,0,1.66],[1.88,0,1.55]];
export function elephantTrunk(clip:string,phase:number):readonly ElephantPoint[]{
 if(clip==='drink'){
  const a=phase<.42?relaxed:phase<.8?dip:mouth,b=phase<.42?dip:phase<.8?mouth:relaxed;
  const t=phase<.42?smooth(phase/.2):phase<.8?smooth((phase-.42)/.26):smooth((phase-.8)/.2);
  return a.map((p,i)=>mix(p,b[i]!,t));
 }
 if(clip==='spray'){
  const t=phase<.28?smooth(phase/.28):phase<.73?1:1-smooth((phase-.73)/.27);
  return (phase<.28?dip:relaxed).map((p,i)=>mix(p,raised[i]!,t));
 }
 return relaxed.map((p,i)=>[p[0]+Math.sin(phase*Math.PI*2)*.035*i/3,p[1]+Math.sin(phase*Math.PI*2+.6)*.045*i/3,p[2]] as ElephantPoint);
}
export function trunkPoint(points:readonly ElephantPoint[],t:number):ElephantPoint {
 const a=points[0]!,b=points[1]!,c=points[2]!,d=points[3]!,u=1-t;
 return [0,1,2].map(i=>u*u*u*a[i]!+3*u*u*t*b[i]!+3*u*t*t*c[i]!+t*t*t*d[i]!) as unknown as ElephantPoint;
}
