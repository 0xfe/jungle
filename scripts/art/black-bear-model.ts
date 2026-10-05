import { restingPose } from './repose';
import { bone, ellipsoid, type Mesh, type RGB, type V3 } from '../../src/iso/bake/mesh';
const TAU=Math.PI*2;
/** +X-facing plantigrade bear: rounded ears, heavy body, tan muzzle and short tail.
 * .52-unit stance excursion / .68 contact fraction matches the .175-tile stride. */
export function blackBearMesh(clip:string,p:number):Mesh {
 if(clip==='lower')return blackBearMesh('rise',1-p);
 const rest=restingPose(clip,p);
 const m:Mesh=[],walking=clip==='travel'||clip==='crawl',forage=clip==='forage',wave=Math.sin(p*TAU);
 const fur:RGB=[43,47,48],highlight:RGB=[60,61,57],paw:RGB=[29,31,30],muzzle:RGB=[153,122,85];
 const smooth=(t:number)=>t*t*(3-2*t);
 const upright=clip==='rise'?smooth(p):clip==='lower'?1-smooth(p):['stand','pick','rest','travel'].includes(clip)?1:0;
 const tilt=upright*1.12,c=Math.cos(tilt),sn=Math.sin(tilt);
 const liftPoint=(v:V3):V3=>[-.4+upright*.5+(v[0]+.4)*c-(v[2]-.34)*sn,v[1],.34+(v[0]+.4)*sn+(v[2]-.34)*c];
 const bob=-.31*rest.amount+(walking?Math.sin(p*TAU*2)*.014:wave*.006);
 ellipsoid(m,[-.04,0,.59+bob],[.58,.29,.32],fur,undefined,n=>n[2]>.35?highlight:fur,18,10);
 ellipsoid(m,[-.34,0,.56+bob],[.29,.28,.29],fur);
 ellipsoid(m,[.31,0,.59+bob],[.26,.27,.28],fur);
 const head:V3=[.55+(forage?.035*wave:0),forage?wave*.06:rest.head*.25,(forage?.38+.035*Math.cos(p*TAU*2):.65)+bob];
 bone(m,[.31,0,.65+bob],head,.18,fur);
 const headStart=m.length;
 ellipsoid(m,head,[.23,.19,.22],highlight);
 ellipsoid(m,[head[0]+.18,head[1],head[2]-.07],[.16,.115,.09],muzzle);
 ellipsoid(m,[head[0]+.30,head[1],head[2]-.055],[.055,.079,.043],paw);
 for(const side of [-1,1]){
  ellipsoid(m,[head[0]-.07,head[1]+side*.145,head[2]+.18],[.065,.048,.072],fur);
  ellipsoid(m,[head[0]-.046,head[1]+side*.15,head[2]+.19],[.026,.033,.038],[106,94,80]);
  ellipsoid(m,[head[0]+.108,head[1]+side*.158,head[2]+.05],[.022,.013,.022],[18,20,20]);
  ellipsoid(m,[head[0]+.118,head[1]+side*.166,head[2]+.059],[.007,.006,.007],[222,206,158]);
 }
 // Shared mesh vertices must be transformed once, regardless of triangle reuse.
 const transformed=new Set<Mesh[number]['vertices'][number]>();
 for(const [i,tri] of m.entries())for(const v of tri.vertices){
  if(transformed.has(v))continue;transformed.add(v);
  if(i>=headStart){const h=liftPoint(head);v.position=[h[0]+v.position[0]-head[0],h[1]+v.position[1]-head[1],h[2]+v.position[2]-head[2]];}
  else{v.position=liftPoint(v.position);const n=v.normal;v.normal=[n[0]*c-n[2]*sn,n[1],n[0]*sn+n[2]*c];}
 }
 for(let i=0;i<4;i++){
  const side=i<2?-1:1,front=i%2===1,phase=(p+(clip==='travel'?(side<0?0:.5):[0,.25,.5,.75][i]!))%1,stance=.68;
  const u=Math.max(0,(phase-stance)/(1-stance));
  const fore=walking?(phase<stance?.5-phase/stance:-.5+u*u*(3-2*u))*.52:0;
  const x=front?.36:-.4,lift=walking?Math.sin(u*Math.PI)*.095:0;
  let foot:V3=[x+fore,side*.22,.045+lift],knee:V3=[x+fore*.4,side*.225,.26+lift*.3];
  if(rest.amount){
   foot=[foot[0]+((front?.65:-.44)-foot[0])*rest.amount,side*(.22+.10*rest.amount),foot[2]];
   knee=[knee[0],side*.29,knee[2]+(.075-knee[2])*rest.amount];
   if(front)foot=[foot[0]+rest.shift*.12,foot[1],foot[2]];
  }
  const hip=liftPoint([x,side*.18,.59+bob]);
  if(!front&&upright){
   // Hind paws alone carry the upright stride; feet retain the same excursion.
   foot=[foot[0]+upright*.5,foot[1],foot[2]];
   knee=[knee[0]+upright*.5,knee[1],knee[2]];
  }
  if(front&&upright){
   // Reach and rake down the bark. The rising endpoint matches the resting
   // upright pose; the pick cycle begins and ends at that same hand anchor.
   const pick=clip==='pick'?(1-Math.cos(p*TAU))*.5:0;
   foot=[foot[0]+(.32+pick*.72+(clip==='travel'?Math.sin(phase*TAU)*.13:0)-foot[0])*upright,side*.18,foot[2]+(.84+pick*.2-foot[2])*upright];
   knee=[hip[0]+.45*upright,side*.23,.26+upright*.68];
  }
  bone(m,hip,knee,.088,fur);bone(m,knee,foot,.069,fur);
  ellipsoid(m,[foot[0]+.035,foot[1],foot[2]],[.11,.072,.05],paw);
  for(let j=-1;j<=1;j++)bone(m,[foot[0]+.11,foot[1]+j*.035,foot[2]],[foot[0]+.14,foot[1]+j*.035,foot[2]-.013],.008,[153,148,121]);
 }
 ellipsoid(m,liftPoint([-.60,0,.61-.31*rest.amount]),[.09,.08,.08],fur);
 return m;
}
