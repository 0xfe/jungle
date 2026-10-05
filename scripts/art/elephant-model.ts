import {bone,ellipsoid,unit,cross,add,mul,sub,type Mesh,type RGB,type V3,type Vertex} from '../../src/iso/bake/mesh';
import {elephantTrunk,trunkPoint} from '../../src/jungle/elephant-pose';
const TAU=Math.PI*2,skin:RGB=[143,146,138],fold:RGB=[111,116,108],nail:RGB=[184,178,156],dark:RGB=[45,44,37];
/** Connected tapered tube avoids a chain of disconnected ellipsoids at trunk bends. */
function tube(m:Mesh,curve:readonly V3[],start:number,end:number,color:RGB){
 const rings:Vertex[][]=[];
 for(let i=0;i<curve.length;i++){
  const tangent=unit(sub(curve[Math.min(curve.length-1,i+1)]!,curve[Math.max(0,i-1)]!)),u=unit(cross(tangent,[0,1,0])),v=cross(tangent,u),radius=start+(end-start)*i/(curve.length-1);
  rings.push(Array.from({length:10},(_,j)=>{const a=j/10*TAU,n=add(mul(u,Math.cos(a)),mul(v,Math.sin(a)));return {position:add(curve[i]!,mul(n,radius)),normal:n};}));
 }
 for(let i=0;i<rings.length-1;i++)for(let j=0;j<10;j++){
  const a=rings[i]![j]!,b=rings[i]![(j+1)%10]!,c=rings[i+1]![j]!,d=rings[i+1]![(j+1)%10]!;
  m.push({vertices:[a,b,c],color},{vertices:[c,b,d],color});
 }
}
/** Asian-inspired silhouette: domed back/head, smaller lobed ears, weight-bearing feet. */
export function elephantMesh(clip:string,p:number,form=0):Mesh {
 const m:Mesh=[],walk=clip==='travel',beat=Math.sin(p*TAU),bob=walk?Math.cos(p*TAU*2)*.013:Math.sin(p*TAU)*.004;
 ellipsoid(m,[-.10,0,1.16+bob],[.88,form===1?.48:form===2?.41:.44,.58],skin,undefined,n=>n[2]>.45?[153,154,143]:n[2]<-.45?[127,132,124]:skin,20,12);
 ellipsoid(m,[.34,0,1.3+bob],[.49,.43,.52],skin,undefined,undefined,16,10);
 ellipsoid(m,[-.64,0,1.12+bob],[.37,.40,.46],skin);
 // A four-beat, nearly straight-legged walk with wide padded feet and small toenails.
 for(let i=0;i<4;i++){
  const side=i<2?-1:1,front=i%2===1,phase=(p+[0,.5,.25,.75][i]!)%1,stance=.72,t=Math.max(0,(phase-stance)/(1-stance));
  const stride=walk?(phase<stance?.5-phase/stance:-.5+t*t*(3-2*t))*.49:0,lift=walk&&phase>stance?Math.sin(t*Math.PI)*.065:0;
  const x=front?.47:-.61,y=side*.30,foot:V3=[x+stride,y,.115+lift];
  const knee:V3=[x+stride*.34+(front?-.035:.055),y,.47+lift*.25];
  bone(m,[x,y,.94+bob],knee,.145,skin);bone(m,knee,foot,.13,skin);
  ellipsoid(m,foot,[.17,.145,.13],skin,undefined,undefined,12,8);
  for(let toe=-1;toe<=1;toe++)ellipsoid(m,[foot[0]+.145,y+toe*.07,.10+lift],[.032,.038,.037],nail,undefined,undefined,6,4);
  bone(m,[x-.08,y+side*.125,.36+lift],[x+.06,y+side*.125,.34+lift],.012,fold);
 }
 // Forehead and cheeks join the trunk instead of a round head perched on a neck.
 ellipsoid(m,[.69,0,1.48+bob],[.37,.31,.41],skin,undefined,undefined,18,12);
 for(const side of [-1,1]){
  ellipsoid(m,[.68,side*.12,1.75+bob],[.20,.19,.21],[150,151,140]);
  const earScale=form===1?1.12:form===2?1.08:1;
  const flap=Math.sin(p*TAU+(side===1?.3:0))*.055,hinge:V3=[.49,side*.245,1.54+bob];
  const rim:V3[]=[[.46,side*.29,1.77+bob],[.12,side*(.51+flap)*earScale,1.69+bob],[.05,side*(.55+flap)*earScale,1.42+bob],[.15,side*(.48+flap)*earScale,1.15+bob],[.31,side*.31,1.21+bob],[.52,side*.25,1.39+bob]];
  for(let i=0;i<rim.length;i++)m.push({vertices:[hinge,rim[i]!,rim[(i+1)%rim.length]!].map(position=>({position,normal:unit([.15,side,.12])})) as [Vertex,Vertex,Vertex],color:i%2?[142,139,127]:[151,146,133]});
  bone(m,rim[1]!,rim[2]!, .018,fold);bone(m,hinge,rim[3]!, .011,fold);
  ellipsoid(m,[.895,side*.237,1.58+bob],[.043,.022,.036],fold);
  ellipsoid(m,[.919,side*.246,1.586+bob],[.02,.016,.022],dark);
  bone(m,[.85,side*.235,1.64+bob],[.96,side*.215,1.62+bob],.018,[165,161,147]);
  // Short curved tusks keep the trunk readable at all 16 headings.
  tube(m,Array.from({length:7},(_,i)=>{const t=i/6*(form===2?.15:form===1?.6:1);return [.94+t*.4,side*(.17+t*.025),1.20-t*.15+t*t*.20] as V3;}),.041,.007,[220,211,175]);
  for(let j=0;j<3;j++)bone(m,[.39-j*.045,side*.405,1.49-j*.14+bob],[.25-j*.045,side*.427,1.40-j*.14+bob],.012,fold);
 }
 ellipsoid(m,[.99,0,1.17+bob],[.12,.14,.055],fold);
 const controls=elephantTrunk(clip,p),curve=Array.from({length:19},(_,i)=>trunkPoint(controls,i/18));
 tube(m,curve,.125,.038,skin);
 for(let i=3;i<17;i+=3){const q=curve[i]!;bone(m,[q[0]-.025,q[1]-.07,q[2]+.02],[q[0]-.025,q[1]+.07,q[2]+.02],.01,fold);}
 const tip=curve.at(-1)!;ellipsoid(m,tip,[.039,.034,.03],fold,undefined,undefined,8,6);
 const tail:V3[]=[[-.91,0,1.35],[-1.02,beat*.06,.97],[-1.01,beat*.09,.65]];tube(m,tail,.027,.014,fold);ellipsoid(m,tail[2]!,[.04,.035,.075],dark);
 return m;
}
