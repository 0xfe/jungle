import type { Mesh, V3 } from '../../src/iso/bake/mesh';
/** Smooth endpoint registration shared by authored posture transitions. */
export const smooth=(t:number):number=>{const u=Math.max(0,Math.min(1,t));return u*u*(3-2*u);};
export function feedingBlend(clip:string,p:number):number {
 return clip==='feedDown'?smooth(p):clip==='feedUp'?smooth(1-p):clip==='forage'||clip==='graze'?1:0;
}
/** Transform each indexed vertex once; callers supply the matching normal transform. */
export function transformMesh(mesh:Mesh,position:(p:V3)=>V3,normal:(n:V3)=>V3=n=>n):Mesh {
 const seen=new Set<Mesh[number]['vertices'][number]>();
 for(const triangle of mesh)for(const vertex of triangle.vertices){
  if(seen.has(vertex))continue;seen.add(vertex);vertex.position=position(vertex.position);
  const n=normal(vertex.normal),length=Math.hypot(...n);vertex.normal=[n[0]/length,n[1]/length,n[2]/length];
 }
 return mesh;
}
