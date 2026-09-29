import {bone,ellipsoid,type Mesh,type RGB,type V3} from '../../src/iso/bake/mesh';
const TAU=Math.PI*2,ivory:RGB=[236,232,213],ink:RGB=[40,43,42];
/** +X-facing equid with an upright mane and individually painted transverse bands.
 * .585 excursion / .68 stance matches .19 tiles at the shared camera/body scale. */
export function zebraMesh(clip:string,p:number):Mesh {
 const m:Mesh=[],walk=clip==='travel',graze=clip==='graze',wave=Math.sin(p*TAU),bob=walk?Math.cos(p*TAU*2)*.012:wave*.006;
 const stripes=(n:V3):RGB=>Math.sin(n[0]*24+n[2]*2)>.15?ink:ivory;
 ellipsoid(m,[0,0,.84+bob],[.59,.23,.30],ivory,undefined,stripes,32,16);
 for(let i=0;i<4;i++){
  const front=i%2===1,side=i<2?-1:1,phase=(p+[0,.25,.5,.75][i]!)%1,u=Math.max(0,(phase-.68)/.32);
  const fore=walk?(phase<.68?.5-phase/.68:-.5+u*u*(3-2*u))*.585:0;
  const x=front?.39:-.40,lift=walk?Math.sin(u*Math.PI)*.085:0,foot:V3=[x+fore,side*.17,.055+lift];
  const knee:V3=[x+fore*.4,side*.18,.39+lift*.3];
  bone(m,[x,side*.15,.82+bob],knee,.061,ivory);bone(m,knee,foot,.036,ivory);
  for(let j=0;j<4;j++){const t=j/4;ellipsoid(m,[x+fore*(1-t*.6),side*.18,.14+j*.12+lift*(1-t)],[.042,.042,.025],ink);}
  ellipsoid(m,foot,[.076,.054,.048],ink);
 }
 const head:V3=graze?[.85+wave*.025,0,.32]:[.64,0,1.46+bob];
 const base:V3=[.35,0,.91+bob];bone(m,base,head,.14,ivory);
 for(let j=0;j<8;j++){
  const t=j/8,x=base[0]+(head[0]-base[0])*t,z=base[2]+(head[2]-base[2])*t;
  ellipsoid(m,[x,0,z],[.14,.143,.028],ink);
  bone(m,[x-.11,0,z],[x-.18,0,z+.08],.034,ink);
 }
 ellipsoid(m,head,[.20,.115,.17],ivory,undefined,n=>Math.sin(n[0]*15)>.2?ink:ivory,20,10);
 const nose:V3=[head[0]+.17,0,head[2]-.13];ellipsoid(m,nose,[.135,.104,.11],ink);
 for(const side of [-1,1]){
  ellipsoid(m,[head[0]+.09,side*.11,head[2]+.035],[.02,.012,.026],ink);
  bone(m,[head[0]-.04,side*.08,head[2]+.12],[head[0]-.08,side*.12,head[2]+.35],.045,ivory);
  bone(m,[head[0]-.041,side*.091,head[2]+.19],[head[0]-.07,side*.12,head[2]+.31],.021,ink);
 }
 bone(m,[-.54,0,.88],[-.73,wave*.055,.43],.025,ivory);bone(m,[-.73,wave*.055,.43],[-.75,wave*.07,.28],.048,ink);
 return m;
}
