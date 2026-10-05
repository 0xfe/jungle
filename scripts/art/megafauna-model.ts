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
export function hippoMesh(clip:string,p:number,form=0):Mesh {
 const m:Mesh=[],wave=Math.sin(p*TAU),wet=clip==='wallow'||clip==='wade',moving=clip==='travel'||clip==='wade',graze=clip==='graze';
 const skin:RGB=form?[149,133,125]:[113,124,133],pink:RGB=form?[181,143,137]:[158,133,150],bob=moving?Math.cos(p*TAU*2)*.01:wave*.009;
 ellipsoid(m,[-.1,0,.63+bob],[.79,.40,.41],skin,undefined,n=>{
  if(n[2]<-.3)return pink;
  const pore=Math.sin(n[0]*79+n[1]*31)*Math.cos(n[2]*67-n[1]*19);
  return skin.map(c=>c+(pore>.7?10:pore<-.75?-9:0)) as unknown as RGB;
 },40,24);
 legs(m,p,moving,false,.45,.29,.55,.346,skin,.13);
 const h:V3=[.69,0,(graze?.32:.63)+bob];
 ellipsoid(m,h,[.43,.30,.28],skin);ellipsoid(m,[1.01,0,h[2]-.04],[.30,.32,.19],pink);
 bone(m,[.92,-.29,h[2]-.1],[1.21,0,h[2]-.13],.012,[93,75,81]);bone(m,[1.21,0,h[2]-.13],[.92,.29,h[2]-.1],.012,[93,75,81]);
 for(const side of [-1,1]){
  ellipsoid(m,[.62,side*.24,h[2]+.26],[.085,.071,.076],skin);
  ellipsoid(m,[.65,side*.278,h[2]+.277],[.024,.022,.021],ink);
  ellipsoid(m,[.40,side*.29,h[2]+.31],[.07,.057,.085],skin);
  ellipsoid(m,[.42,side*.307,h[2]+.32],[.037,.029,.046],pink);
  // Raised nostril rims, dark openings, cheek folds and a glint in each eye.
  ellipsoid(m,[1.15,side*.17,h[2]+.13],[.065,.047,.041],skin);
  ellipsoid(m,[1.17,side*.17,h[2]+.154],[.030,.024,.017],[58,57,61]);
  ellipsoid(m,[.66,side*.291,h[2]+.284],[.009,.007,.008],[233,221,199]);
  for(let j=0;j<3;j++){
   const x=.30+j*.045;
   bone(m,[x,side*(.29+j*.009),h[2]+.14],[x-.025,side*(.32+j*.008),h[2]-.12],.009,[94,95,108]);
  }
  for(let j=0;j<4;j++)ellipsoid(m,[1.1-j*.045,side*(.275+j*.004),h[2]-.045],[.012,.012,.01],skin);
  for(let j=0;j<3;j++)bone(m,[-.12+j*.09,side*.389,.61],[-.14+j*.09,side*.36,.49],.008,[104,92,99]);
 }
 bone(m,[-.8,0,.67],[-1.04,wave*.09,.57],.033,skin);
 // A round slate form and a slimmer warm form share exactly calibrated strides.
 if(form)reshape(m,.90,.94);
 return wet?waterline(m,(form?.53:.57)+Math.sin(p*TAU)*.016):m;
}
/** Humped bison: shaggy shoulders/beard, short curved horns and narrow hindquarters. */
export function bisonMesh(clip:string,p:number,form=0):Mesh {
 const m:Mesh=[],wave=Math.sin(p*TAU),run=clip==='run',moving=clip==='travel'||run,graze=clip==='graze';
 const fur:RGB=form?[110,78,53]:[74,57,45],dark:RGB=form?[65,44,32]:[40,33,29],mane:RGB=form?[137,93,53]:[111,77,51];
 const bob=run?Math.cos(p*TAU*2)*.045:moving?wave*.012:wave*.008;
 // Smoother, tapered hindquarters contrast with the high woolly shoulder mass.
 ellipsoid(m,[-.24,0,.77+bob],[.64,.28,.34],fur,undefined,n=>n[2]>.35?fur.map(c=>c+9) as unknown as RGB:fur,28,16);
 const wool=(n:V3):RGB=>{
  const curl=Math.sin(n[0]*47+n[2]*13)*Math.cos(n[1]*39-n[2]*29);
  return mane.map(c=>Math.max(0,c+(curl>.35?17:curl<-.25?-24:0))) as unknown as RGB;
 };
 ellipsoid(m,[.23,0,.98+bob],[.51,.37,form?.44:.52],mane,undefined,wool,44,28);
 ellipsoid(m,[.48,0,.64+bob],[.32,.34,.39],dark,undefined,n=>n[2]>.3?mane:dark,28,18);
 legs(m,p,moving,run,.43,.23,.7+bob,run?.50:.458,dark,.091,true);
 // Layered locks hang off the shoulders and dewlap, following the body's pose.
 for(let i=0;i<54;i++){
  const a=i*2.399963,z=.58+(i%6)*.125,x=.23+Math.cos(a)*(.38-(z-.7)*.1),y=Math.sin(a)*.32;
  bone(m,[x,y,z+bob],[x-.055,y*1.1,z-.15-(i%3)*.015+bob],.035,i%4===0?mane:dark);
 }
 const h:V3=[.80,0,(graze?.38:.68)+bob];
 ellipsoid(m,h,[.31,.275,.31],dark);
 // A broad curly forehead, long face, wet nose and drooping chin beard.
 ellipsoid(m,[.85,0,h[2]+.16],[.25,.28,.20],mane,undefined,n=>{
  const tuft=Math.sin(n[0]*39+n[2]*12)*Math.cos(n[1]*43);
  return dark.map(c=>c+(tuft>.1?16:0)) as unknown as RGB;
 },36,22);
 ellipsoid(m,[h[0]+.20,0,h[2]-.13],[.19,.19,.19],fur);
 ellipsoid(m,[1.145,0,h[2]-.17],[.066,.15,.069],[37,34,30]);
 for(let j=0;j<7;j++)bone(m,[.86+(j%2)*.025,(j-3)*.029,h[2]-.21],[.76,(j-3)*.038,h[2]-.40-(j%3)*.022],.026,dark);
 for(const side of [-1,1]){
  ellipsoid(m,[.976,side*.205,h[2]+.016],[.052,.029,.039],fur);
  ellipsoid(m,[.99,side*.226,h[2]+.019],[.024,.016,.020],ink);
  ellipsoid(m,[1.001,side*.235,h[2]+.027],[.008,.005,.007],[205,177,117]);
  ellipsoid(m,[1.183,side*.08,h[2]-.153],[.019,.034,.016],ink);
  ellipsoid(m,[.59,side*.34,h[2]+.11],[.105,.09,.045],fur);
  // Horns sweep sideways then upward, tapering to dark tips.
  const points:V3[]=[[.71,side*.23,h[2]+.20],[.71,side*.36,h[2]+.25],[.75,side*.41,h[2]+.34],[.81,side*.40,h[2]+.47]];
  for(let j=1;j<points.length;j++)bone(m,points[j-1]!,points[j]!,[.052,.037,.019][j-1]!,j===3?[100,101,91]:ivory);
 }
 bone(m,[-.77,0,.86],[-.94,wave*.06,.39],.025,fur);ellipsoid(m,[-.94,wave*.06,.34],[.06,.047,.095],dark);
 if(form)reshape(m,.92,.94);
 return m;
}
/** Alter body build without changing fore/aft foot excursion or the ground root. */
function reshape(mesh:Mesh,width:number,height:number):void {
 const seen=new Set<Mesh[number]['vertices'][number]>();
 for(const triangle of mesh)for(const vertex of triangle.vertices){
  if(seen.has(vertex))continue;seen.add(vertex);
  const [x,y,z]=vertex.position;vertex.position=[x,y*width,z*height];
  const [nx,ny,nz]=vertex.normal,length=Math.hypot(nx,ny/width,nz/height);
  vertex.normal=[nx/length,ny/width/length,nz/height/length];
 }
}
