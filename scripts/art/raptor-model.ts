import { smooth,transformMesh } from './pose-tools';
import {bone,ellipsoid,type Mesh,type RGB,type V3} from '../../src/iso/bake/mesh';
const TAU=Math.PI*2;
/** Large articulated wings, distinct pointed hawk / broad fingered vulture silhouettes. */
export function raptorMesh(kind:'hawk'|'vulture',clip:string,p:number,form=0):Mesh {
 const m:Mesh=[],vulture=kind==='vulture',ground=clip==='forage'||clip==='rest'?1:clip==='takeoff'?smooth(1-p):clip==='land'?smooth(p):0,dive=clip==='dive';
 const brown:RGB=vulture?(form?[101,88,69]:[68,61,48]):form?[153,124,85]:[131,85,47],dark:RGB=[39,38,33],cream:RGB=[220,207,164];
 const bodyZ=.34+ground*.12,flap=['takeoff','land'].includes(clip)?-.8*ground:ground?-.8:dive?Math.sin(p*Math.PI)*.18:Math.sin(p*TAU)*.7;
 ellipsoid(m,[0,0,bodyZ],[.42,.21,.25],brown,undefined,n=>n[2]<0?cream:brown);
 const peck=clip==='forage'?(1-Math.cos(p*TAU))*.5:0;
 const head:V3=[.38+peck*.13,0,(vulture?.65:.53)-peck*.48];
 bone(m,[.20,0,.49],head,vulture?.055:.12,vulture?[155,120,103]:brown);
 if(vulture)ellipsoid(m,[.22,0,.51],[.14,.16,.10],cream);
 ellipsoid(m,head,[vulture?.11:.15,.10,.13],vulture?[151,118,103]:brown);
 bone(m,[head[0]+.1,0,head[2]],[head[0]+.23,0,head[2]-.04],.037,[204,170,76]);
 bone(m,[head[0]+.22,0,head[2]-.02],[head[0]+.22,0,head[2]-.09],.018,dark);
 for(const side of [-1,1]){
  ellipsoid(m,[head[0]+.05,side*.094,head[2]+.03],[.02,.012,.022],dark);
  const wrist:V3=[-.12,side*(.8-.6*ground)*(dive?1-Math.sin(p*Math.PI)**2*.55:1),.40+flap*(.32-.24*ground)];
  bone(m,[.12,side*.12,.43],wrist,.11,brown);
  for(let i=0;i<6;i++){
   const tip:V3=[-.40-i*.055,wrist[1]+side*(.025*ground+((vulture?.32:.23)+form*.035-i*.025)*(1-ground)),wrist[2]-.06-i*.025];
   bone(m,[wrist[0]+.06-i*.04,wrist[1],wrist[2]],tip,.035,i%2?brown:dark);
  }
  const foot:V3=[-.10+.20*ground,side*.10,.18-.145*ground];
  bone(m,[-.06,side*.10,.25],foot,.025,[168,139,64]);
  for(const toe of [-1,0,1])bone(m,foot,[foot[0]+.08,foot[1]+toe*.03,foot[2]-.01],.012,dark);
 }
 for(let i=-2;i<=2;i++)bone(m,[-.28,i*.03,.29],[-.70,i*.065,.20],.038,i%2?cream:brown);
 if(dive){const pitch=-Math.sin(p*TAU)*.65,c=Math.cos(pitch),s=Math.sin(pitch);transformMesh(m,([x,y,z])=>[x*c-(z-.3)*s,y,.3+x*s+(z-.3)*c]);}
 return m;
}
/** A small weathered rib cage and hide; static authored scenery, never a kill effect. */
export function scavengingRemains():Mesh {
 const m:Mesh=[],boneColor:RGB=[204,194,156];
 ellipsoid(m,[0,0,.025],[.31,.17,.025],[106,87,60]);
 bone(m,[-.28,0,.08],[.27,0,.08],.025,boneColor);
 for(let i=0;i<5;i++)for(const side of [-1,1]){
  const x=-.18+i*.08;bone(m,[x,0,.1],[x,side*.12,.17],.018,boneColor);bone(m,[x,side*.12,.17],[x+.03,side*.16,.04],.018,boneColor);
 }
 ellipsoid(m,[.32,0,.075],[.08,.065,.05],boneColor);return m;
}
