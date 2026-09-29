import {bone,ellipsoid,type Mesh,type RGB,type V3} from '../../src/iso/bake/mesh';
const TAU=Math.PI*2;
/** Large articulated wings, distinct pointed hawk / broad fingered vulture silhouettes. */
export function raptorMesh(kind:'hawk'|'vulture',clip:string,p:number):Mesh {
 const m:Mesh=[],vulture=kind==='vulture',ground=clip==='forage'||clip==='rest',dive=clip==='dive';
 const brown:RGB=vulture?[68,61,48]:[131,85,47],dark:RGB=[39,38,33],cream:RGB=[220,207,164];
 const bodyZ=ground?.46:.34,flap=ground?-.8:dive?.18:Math.sin(p*TAU)*.7;
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
  const wrist:V3=[-.12,side*(ground?.20:dive?.48:.80),.40+flap*(ground?.08:.32)];
  bone(m,[.12,side*.12,.43],wrist,.11,brown);
  for(let i=0;i<6;i++){
   const tip:V3=[-.40-i*.055,wrist[1]+side*(ground?.025:(vulture?.32:.23)-i*.025),wrist[2]-.06-i*.025];
   bone(m,[wrist[0]+.06-i*.04,wrist[1],wrist[2]],tip,.035,i%2?brown:dark);
  }
  const foot:V3=[ground?.10:-.10,side*.10,ground?.035:.18];
  bone(m,[-.06,side*.10,.25],foot,.025,[168,139,64]);
  for(const toe of [-1,0,1])bone(m,foot,[foot[0]+.08,foot[1]+toe*.03,foot[2]-.01],.012,dark);
 }
 for(let i=-2;i<=2;i++)bone(m,[-.28,i*.03,.29],[-.70,i*.065,.20],.038,i%2?cream:brown);
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
