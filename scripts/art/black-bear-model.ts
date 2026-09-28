import { bone, ellipsoid, type Mesh, type RGB, type V3 } from '../../src/iso/bake/mesh';
const TAU=Math.PI*2;
/** +X-facing plantigrade bear: rounded ears, heavy body, tan muzzle and short tail.
 * .52-unit stance excursion / .68 contact fraction matches the .175-tile stride. */
export function blackBearMesh(clip:string,p:number):Mesh {
 const m:Mesh=[],walking=clip==='travel',forage=clip==='forage',wave=Math.sin(p*TAU);
 const fur:RGB=[43,47,48],highlight:RGB=[60,61,57],paw:RGB=[29,31,30],muzzle:RGB=[153,122,85];
 const bob=walking?Math.sin(p*TAU*2)*.014:wave*.006;
 ellipsoid(m,[-.04,0,.59+bob],[.58,.29,.32],fur,undefined,n=>n[2]>.35?highlight:fur,18,10);
 ellipsoid(m,[-.34,0,.56+bob],[.29,.28,.29],fur);
 ellipsoid(m,[.31,0,.59+bob],[.26,.27,.28],fur);
 const head:V3=[.55+(forage?.035*wave:0),forage?wave*.06:0,(forage?.38+.035*Math.cos(p*TAU*2):.65)+bob];
 bone(m,[.31,0,.65+bob],head,.18,fur);
 ellipsoid(m,head,[.23,.19,.22],highlight);
 ellipsoid(m,[head[0]+.18,head[1],head[2]-.07],[.16,.115,.09],muzzle);
 ellipsoid(m,[head[0]+.30,head[1],head[2]-.055],[.055,.079,.043],paw);
 for(const side of [-1,1]){
  ellipsoid(m,[head[0]-.07,head[1]+side*.145,head[2]+.18],[.065,.048,.072],fur);
  ellipsoid(m,[head[0]-.046,head[1]+side*.15,head[2]+.19],[.026,.033,.038],[106,94,80]);
  ellipsoid(m,[head[0]+.108,head[1]+side*.158,head[2]+.05],[.022,.013,.022],[18,20,20]);
  ellipsoid(m,[head[0]+.118,head[1]+side*.166,head[2]+.059],[.007,.006,.007],[222,206,158]);
 }
 for(let i=0;i<4;i++){
  const side=i<2?-1:1,front=i%2===1,phase=(p+[0,.25,.5,.75][i]!)%1,stance=.68;
  const u=Math.max(0,(phase-stance)/(1-stance));
  const fore=walking?(phase<stance?.5-phase/stance:-.5+u*u*(3-2*u))*.52:0;
  const x=front?.36:-.4,lift=walking?Math.sin(u*Math.PI)*.095:0;
  const foot:V3=[x+fore,side*.22,.045+lift],knee:V3=[x+fore*.4,side*.225,.26+lift*.3];
  bone(m,[x,side*.18,.59+bob],knee,.088,fur);bone(m,knee,foot,.069,fur);
  ellipsoid(m,[foot[0]+.035,foot[1],foot[2]],[.11,.072,.05],paw);
  for(let j=-1;j<=1;j++)bone(m,[foot[0]+.11,foot[1]+j*.035,foot[2]],[foot[0]+.14,foot[1]+j*.035,foot[2]-.013],.008,[153,148,121]);
 }
 ellipsoid(m,[-.60,0,.61],[.09,.08,.08],fur);
 return m;
}
