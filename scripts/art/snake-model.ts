import { transformMesh } from './pose-tools';
import { bone,ellipsoid, unit, cross, sub, type Mesh, type RGB, type V3, type Vertex } from '../../src/iso/bake/mesh';
import { SNAKE_SUPPORT_OFFSET } from '../../src/jungle/snake-pose';

/** Articulated continuous tube; +X is the head, with a distance-driven traveling wave. */
export function snakeMesh(kind:'boa'|'smallSnake',clip:string,phase:number,form=0):Mesh {
  const mesh:Mesh=[],boa=kind==='boa',segments=40,sides=8;
  const wrapping=clip==='wrap',coiled=clip==='coil';
  const t=wrapping?phase*phase*(3-2*phase):coiled?1:0;
  const length=(boa?2.5:1.55)*(form===1?1.06:form===2?.92:1),amplitude=boa?.26:.21;
  const body:RGB=(boa?[[159,137,70],[139,112,85],[175,149,95]]:[[78,145,72],[131,111,73],[79,114,151]])[form%3] as unknown as RGB,belly:RGB=boa?[224,201,130]:[200,197,98];
  const center=(u:number):V3=>{
    const x=(u-.5)*length,y=Math.sin(u*Math.PI*3-(clip==='travel'?phase*Math.PI*2:0))*amplitude*Math.sin(u*Math.PI);
    const angle=u*Math.PI*3.6,coil:V3=[-SNAKE_SUPPORT_OFFSET+Math.cos(angle)*.49,Math.sin(angle)*.49,.09+u*.75];
    const bend=clip==='turnLeft'?phase:clip==='turnRight'?-phase:clip==='investigate'?Math.sin(phase*Math.PI*4)*Math.sin(phase*Math.PI)**2*.3:0;
    return [x+(coil[0]-x)*t,y+(coil[1]-y)*t+bend*u*u*.3,.085+(coil[2]-.085)*t+(clip==='investigate'?Math.sin(phase*Math.PI)**2*u*u*.10:0)];
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
    const dorsal=a.normal[2]>.2,color=a.normal[2]<-.3?belly:boa&&dorsal&&(i+form*2)%(9+form)<4+form%2?[88,75,42] as unknown as RGB:!boa&&a.normal[2]>(form===2?.55:.8)?[224,187,72] as unknown as RGB:body;
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
  if(clip==='investigate'&&phase>.25&&phase<.75){
    const flick=Math.max(0,Math.sin(phase*Math.PI*14))*.12,tip:V3=[head[0]+.14+flick,head[1],head[2]];
    bone(mesh,[head[0]+.10,head[1],head[2]],tip,.009,[174,83,76]);
    for(const side of [-1,1])bone(mesh,tip,[tip[0]+.025,tip[1]+side*.018,tip[2]],.006,[174,83,76]);
  }
  // Small, registered head movement differentiates resting frames without crawling in place.
  if(clip==='rest'||clip==='coil')transformMesh(mesh,([x,y,z])=>[x,y,z+Math.max(0,x-(coiled?-1:.7))*.012*Math.sin(phase*Math.PI*2)]);
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
