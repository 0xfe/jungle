import { bone, ellipsoid, type Mesh, type RGB, type V3 } from '../../src/iso/bake/mesh';
const TAU=Math.PI*2,ink:RGB=[30,28,24],ivory:RGB=[235,223,190];
/** Four rooted articulated legs. Excursion / stance agrees with species stride metadata. */
function legs(m:Mesh,p:number,moving:boolean,run:boolean,hip:number,width:number,height:number,excursion:number,color:RGB,thickness:number,hoof=false):void {
 for(let i=0;i<4;i++){
  const front=i%2===1,side=i<2?-1:1,phase=(p+(run?[0,.48,.08,.56]:[0,.25,.5,.75])[i]!)%1,stance=run?.36:.66;
  const u=Math.max(0,(phase-stance)/(1-stance));
  const fore=moving?(phase<stance?.5-phase/stance:-.5+u*u*(3-2*u))*excursion:0,lift=moving?Math.sin(u*Math.PI)*(run?.17:.065):0;
  const x=front?hip:-hip,foot:V3=[x+fore,side*width,.065+lift],knee:V3=[x+fore*.38,side*width,height*.46+lift*.4];
  bone(m,[x,side*width*.9,height],knee,thickness,color);bone(m,knee,foot,thickness*.73,color);
  ellipsoid(m,foot,[thickness*1.3,thickness,hoof?.055:.075],hoof?ink:color);
  if(!hoof)for(let j=-1;j<=1;j++)ellipsoid(m,[foot[0]+thickness,foot[1]+j*thickness*.5,foot[2]-.012],[.025,.022,.018],ivory);
 }
}
/** +X-facing tiger: striped muscular cat, white cheek ruff, paws and articulated tail. */
export function tigerMesh(clip:string,p:number):Mesh {
 const m:Mesh=[],wave=Math.sin(p*TAU),run=clip==='chase',moving=['travel','stalk','chase'].includes(clip),low=clip==='stalk'?.13:0;
 const fur:RGB=[217,126,43],white:RGB=[237,222,185],bob=run?Math.cos(p*TAU*2)*.055:moving?wave*.014:wave*.007;
 const stripe=(n:V3):RGB=>n[2]<-.38?white:Math.sin(n[0]*27+Math.sin(n[2]*8)*1.8)>.45?ink:fur;
 ellipsoid(m,[0,0,.62-low+bob],[.72,.245,.27],fur,undefined,stripe,36,18);
 ellipsoid(m,[.41,0,.67-low+bob],[.27,.27,.3],fur,undefined,stripe,28,14);
 legs(m,p,moving,run,.45,.19,.61-low+bob,run?.50:.482,fur,.073);
 const head:V3=[.77,0,.83-low+bob],roar=clip==='roar'?Math.max(0,Math.sin(p*TAU))*.13:0;
 ellipsoid(m,head,[.225,.22,.205],fur,undefined,n=>Math.sin(n[0]*20+n[2]*5)>.4?ink:fur,28,14);
 for(const side of [-1,1]){
  ellipsoid(m,[.81,side*.17,.75-low+bob],[.18,.085,.14],white);
  ellipsoid(m,[.96,side*.072,.78-low+bob],[.105,.08,.067],white);
  ellipsoid(m,[.87,side*.174,.9-low+bob],[.035,.026,.028],[230,190,69]);
  ellipsoid(m,[.891,side*.189,.9-low+bob],[.018,.012,.023],ink);
  ellipsoid(m,[.66,side*.15,1-low+bob],[.076,.055,.086],ink);
  ellipsoid(m,[.678,side*.15,1.019-low+bob],[.037,.036,.036],white);
  for(let j=0;j<3;j++)bone(m,[.94,side*.12,.77-low+bob-j*.025],[1.04,side*(.22+j*.018),.78-low+bob-j*.025],.006,ivory);
 }
 ellipsoid(m,[1.035,0,.812-low+bob],[.047,.065,.035],[77,48,40]);
 ellipsoid(m,[.95,0,.71-low+bob-roar],[.13,.14,.047],white);
 if(roar>.015){ellipsoid(m,[.96,0,.73-low+bob-roar*.5],[.09,.1,roar*.5],ink);for(const side of [-1,1])bone(m,[1,side*.055,.753-low+bob],[1,side*.055,.70-low+bob],.014,ivory);}
 let last:V3=[-.62,0,.69-low+bob];
 for(let i=1;i<=12;i++){const t=i/12,next:V3=[-.62-t*.72,Math.sin(t*2.8+p*TAU)*.12*t,.69-low+bob-t*.22+Math.sin(t*Math.PI)*.08];bone(m,last,next,.042*(1-t*.45),i%3===0?ink:fur);last=next;}
 return m;
}
/** Clip submerged geometry against one water plane, keeping eyes/nostrils above it. */
function waterline(mesh:Mesh,z:number):Mesh {
 const out:Mesh=[];
 for(const t of mesh){
  let points=[...t.vertices],cut:typeof points=[];
  for(let i=0;i<points.length;i++){
   const a=points[i]!,b=points[(i+1)%points.length]!,inside=a.position[2]>=z,next=b.position[2]>=z;
   if(inside)cut.push(a);
   if(inside!==next){const u=(z-a.position[2])/(b.position[2]-a.position[2]);cut.push({position:a.position.map((v,k)=>v+(b.position[k]!-v)*u) as unknown as V3,normal:a.normal});}
  }
  for(let i=1;i<cut.length-1;i++)out.push({color:t.color,vertices:[cut[0]!,cut[i]!,cut[i+1]!].map(v=>({...v,position:[v.position[0],v.position[1],v.position[2]-z] as V3})) as typeof t.vertices});
 }
 return out;
}
/** Barrel-shaped hippo with high eyes/ears, broad muzzle, folds and small toes. */
export function hippoMesh(clip:string,p:number):Mesh {
 const m:Mesh=[],wave=Math.sin(p*TAU),wet=clip==='wallow'||clip==='wade',moving=clip==='travel'||clip==='wade',graze=clip==='graze';
 const skin:RGB=[132,123,128],pink:RGB=[172,135,140],bob=moving?Math.cos(p*TAU*2)*.01:wave*.009;
 ellipsoid(m,[-.1,0,.63+bob],[.79,.40,.41],skin,undefined,n=>n[2]<-.3?pink:skin,28,16);
 legs(m,p,moving,false,.45,.29,.55,.346,skin,.13);
 const h:V3=[.69,0,(graze?.32:.63)+bob];
 ellipsoid(m,h,[.43,.30,.28],skin);ellipsoid(m,[1.01,0,h[2]-.04],[.30,.32,.19],pink);
 bone(m,[.92,-.29,h[2]-.1],[1.21,0,h[2]-.13],.012,[93,75,81]);bone(m,[1.21,0,h[2]-.13],[.92,.29,h[2]-.1],.012,[93,75,81]);
 for(const side of [-1,1]){
  ellipsoid(m,[.62,side*.24,h[2]+.26],[.085,.071,.076],skin);
  ellipsoid(m,[.65,side*.278,h[2]+.277],[.024,.022,.021],ink);
  ellipsoid(m,[.40,side*.29,h[2]+.31],[.07,.057,.085],skin);
  ellipsoid(m,[.42,side*.307,h[2]+.32],[.037,.029,.046],pink);
  ellipsoid(m,[1.15,side*.17,h[2]+.117],[.047,.035,.03],[79,68,73]);
  for(let j=0;j<3;j++)bone(m,[-.12+j*.09,side*.389,.61],[-.14+j*.09,side*.36,.49],.008,[104,92,99]);
 }
 bone(m,[-.8,0,.67],[-1.04,wave*.09,.57],.033,skin);
 return wet?waterline(m,.57+Math.sin(p*TAU)*.016):m;
}
/** Humped bison: shaggy shoulders/beard, short curved horns and narrow hindquarters. */
export function bisonMesh(clip:string,p:number):Mesh {
 const m:Mesh=[],wave=Math.sin(p*TAU),run=clip==='run',moving=clip==='travel'||run,graze=clip==='graze';
 const fur:RGB=[103,66,38],dark:RGB=[62,43,30],bob=run?Math.cos(p*TAU*2)*.045:moving?wave*.012:wave*.008;
 ellipsoid(m,[-.18,0,.78+bob],[.66,.29,.33],fur);
 ellipsoid(m,[.28,0,.94+bob],[.48,.35,.49],dark);
 legs(m,p,moving,run,.43,.23,.7+bob,run?.50:.458,fur,.083,true);
 // Coarse locks are rooted in the shoulder, not per-instance runtime objects.
 for(let i=0;i<18;i++){
  const a=i*2.4,z=.62+(i%4)*.16,x=.15+Math.cos(a)*.32,y=Math.sin(a)*.29;
  bone(m,[x,y,z+bob],[x-.04,y*1.06,z-.12+bob],.046,i%3?dark:fur);
 }
 const h:V3=[.78,0,(graze?.37:.75)+bob];
 ellipsoid(m,h,[.30,.27,.29],dark);ellipsoid(m,[h[0]+.23,0,h[2]-.12],[.19,.20,.13],[75,55,39]);
 bone(m,[.77,0,h[2]-.17],[.68,0,h[2]-.37],.12,dark);
 for(const side of [-1,1]){
  ellipsoid(m,[.91,side*.21,h[2]+.05],[.027,.022,.028],ink);
  ellipsoid(m,[.58,side*.31,h[2]+.08],[.11,.09,.045],fur);
  bone(m,[.66,side*.22,h[2]+.19],[.67,side*.40,h[2]+.29],.046,ivory);
  bone(m,[.67,side*.40,h[2]+.29],[.74,side*.39,h[2]+.43],.025,ivory);
 }
 bone(m,[-.77,0,.86],[-.94,wave*.06,.39],.025,fur);ellipsoid(m,[-.94,wave*.06,.34],[.06,.047,.095],dark);
 return m;
}
