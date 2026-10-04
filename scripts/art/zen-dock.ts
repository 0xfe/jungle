import { cross, sub, unit, type Mesh, type V3, type RGB } from '../../src/iso/bake/mesh';
import { bakeMesh } from '../../src/iso/bake/rasterize';
import type { BakeSprite } from '../../src/iso/bake/atlas';

function panel(mesh:Mesh,a:V3,b:V3,c:V3,d:V3,color:RGB):void {
 const normal=unit(cross(sub(b,a),sub(c,a))),v=(position:V3)=>({position,normal});
 mesh.push({vertices:[v(a),v(b),v(c)],color},{vertices:[v(c),v(b),v(d)],color});
}
/** Individual planks, supporting beams and handrails; bake once for every sanctuary. */
export function bakeZenDock():BakeSprite {
 const mesh:Mesh=[];
 const beam=(x:number,y:number,z:number,w:number,d:number,h:number,color:RGB)=>{
  panel(mesh,[x-w,y-d,z+h],[x+w,y-d,z+h],[x-w,y+d,z+h],[x+w,y+d,z+h],color);
  panel(mesh,[x-w,y+d,z],[x+w,y+d,z],[x-w,y+d,z+h],[x+w,y+d,z+h],color);
  for(const side of [-1,1])panel(mesh,[x+side*w,y-d,z],[x+side*w,y+d,z],[x+side*w,y-d,z+h],[x+side*w,y+d,z+h],color);
 };
 // The deck runs along -Y, from dry bank to shallow water, at a gentle arch.
 for(let i=0;i<13;i++){
  const y=-.6+i*.1,z=.11+.06*Math.sin(i/12*Math.PI),tone=i%3;
  beam(0,y,z,.3,.047,.035,[139+tone*8,100+tone*6,58+tone*5]);
  for(const x of [-.23,.23])beam(x,y,z+.035,.012,.012,.003,[61,56,40]);
  beam(.04,y+.014,z+.036,.16,.004,.002,[111,78,45]);
 }
 for(const side of [-1,1]){
  beam(side*.245,0,.07,.028,.65,.04,[92,66,40]);
  for(const y of [-.57,0,.57])beam(side*.34,y,-.16,.038,.038,.59,[111,79,45]);
  beam(side*.34,0,.39,.036,.65,.04,[166,123,71]);
  beam(side*.34,0,.26,.024,.63,.028,[125,87,49]);
 }
 // Two shallow steps meet the muddy approach at the dry end.
 beam(0,.73,.015,.31,.085,.055,[138,105,69]);
 beam(0,.64,.06,.31,.06,.055,[155,116,73]);
 return {id:'zen-dock',anchor:[72,91],frames:[bakeMesh(mesh,0,{width:144,height:128,anchor:[72,91],scale:48*Math.SQRT2})]};
}
