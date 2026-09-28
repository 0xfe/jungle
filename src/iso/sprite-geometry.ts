import type { Vec2 } from './math';
import type { QuadCorners } from './quad';
/** Root-registered billboard variation. Shear changes lean, never the root position.
 * Mirroring also mirrors the anchor, including asymmetric union-trimmed sprites. */
export function rootedQuad(root:Vec2,width:number,height:number,anchor:readonly[number,number],sx:number,sy:number,lean=0,mirror=false):QuadCorners {
  const ax=mirror?width-anchor[0]:anchor[0];
  const point=(x:number,y:number):Vec2=>{
    const dy=(y-anchor[1])*sy;
    return{x:root.x+(x-ax)*sx-dy*lean,y:root.y+dy};
  };
  return[point(0,0),point(width,0),point(0,height),point(width,height)];
}
