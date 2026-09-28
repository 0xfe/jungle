import { ellipsoid, unit, cross, sub, type Mesh, type RGB, type V3, type Vertex } from '../../src/iso/bake/mesh';
import { SNAKE_SUPPORT_OFFSET } from '../../src/jungle/snake-pose';

/** Articulated continuous tube; +X is the head, with a distance-driven traveling wave. */
export function snakeMesh(kind:'boa'|'smallSnake',clip:string,phase:number):Mesh {
  const mesh:Mesh=[],boa=kind==='boa',segments=40,sides=8;
  const wrapping=clip==='wrap',coiled=clip==='coil';
  const t=wrapping?phase*phase*(3-2*phase):coiled?1:0;
  const length=boa?2.5:1.55,amplitude=boa?.26:.21;
  const body:RGB=boa?[159,137,70]:[78,145,72],belly:RGB=boa?[224,201,130]:[200,197,98];
  const center=(u:number):V3=>{
    const x=(u-.5)*length,y=Math.sin(u*Math.PI*3-(clip==='travel'?phase*Math.PI*2:0))*amplitude*Math.sin(u*Math.PI);
    const angle=u*Math.PI*3.6,coil:V3=[-SNAKE_SUPPORT_OFFSET+Math.cos(angle)*.49,Math.sin(angle)*.49,.09+u*.75];
    return [x+(coil[0]-x)*t,y+(coil[1]-y)*t,.085+(coil[2]-.085)*t];
  };
  const rings:Vertex[][]=[];
  for(let i=0;i<=segments;i++){
    const u=i/segments,p=center(u),axis=unit(sub(center(Math.min(1,u+.002)),center(Math.max(0,u-.002))));
    const side=unit(cross(axis,[0,0,1])),up=unit(cross(side,axis));
    const radius=(boa?.092:.062)*Math.min(1,.12+u*6)*(1-.2*Math.max(0,(u-.88)/.12));
    rings.push(Array.from({length:sides},(_,j)=>{
      const angle=j/sides*Math.PI*2,c=Math.cos(angle),s=Math.sin(angle);
      const normal=side.map((n,k)=>n*c+up[k]!*s) as unknown as V3;
      return {position:p.map((n,k)=>n+normal[k]!*radius) as unknown as V3,normal};
    }));
  }
  for(let i=0;i<segments;i++)for(let j=0;j<sides;j++){
    const a=rings[i]![j]!,b=rings[i]![(j+1)%sides]!,c=rings[i+1]![j]!,d=rings[i+1]![(j+1)%sides]!;
    // Saddles on the boa; a fine golden dorsal stripe on the small snakes.
    const dorsal=a.normal[2]>.2,color=a.normal[2]<-.3?belly:boa&&dorsal&&i%9<4?[88,75,42] as RGB:!boa&&a.normal[2]>.8?[224,187,72] as RGB:body;
    mesh.push({vertices:[a,b,c],color},{vertices:[c,b,d],color});
  }
  const head=center(1),axis=unit(sub(head,center(.99))),side=unit(cross(axis,[0,0,1])),up=unit(cross(side,axis));
  ellipsoid(mesh,head,[boa?.16:.115,boa?.10:.07,boa?.075:.052],body,[axis,side,up]);
  for(const sign of [-1,1]){
    const eye=head.map((n,i)=>n+axis[i]!*.05+side[i]!*sign*(boa?.085:.06)+up[i]!*.045) as unknown as V3;
    ellipsoid(mesh,eye,[.019,.019,.018],[237,187,60],undefined,undefined,6,4);
    const pupil=eye.map((n,i)=>n+side[i]!*sign*.011) as unknown as V3;
    ellipsoid(mesh,pupil,[.009,.01,.014],[25,34,24],undefined,undefined,6,4);
  }
  // Small, registered head movement differentiates resting frames without crawling in place.
  if(clip==='rest'||clip==='coil')for(const triangle of mesh)for(const v of triangle.vertices){
    const lift=Math.max(0,(v.position[0]-(coiled?-1:.7)))*.012*Math.sin(phase*Math.PI*2);
    v.position=[v.position[0],v.position[1],v.position[2]+lift];
  }
  return mesh;
}

/** Split at the real trunk's painter plane; front/back frames share one root registration. */
export function snakeSide(mesh:Mesh,heading:number,front:boolean):Mesh {
  const c=Math.cos(heading),s=Math.sin(heading);
  return mesh.filter(triangle=>{
    const depth=triangle.vertices.reduce((sum,v)=>{
      const x=v.position[0]+SNAKE_SUPPORT_OFFSET,y=v.position[1];
      return sum+x*(c+s)+y*(c-s);
    },0);
    return (depth>=0)===front;
  });
}
