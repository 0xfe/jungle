import { unproject } from '../iso/math';
import { TILE } from './geometry';

/** Registered pixels in the retained pagoda painting, shared by art and navigation. */
export const ZEN_TEMPLE = {
 width:192, height:280, anchor:[96,244] as [number,number], size:2.1,
 rootX:-1.2, rootY:.2, door:[117,232] as const, landing:[128,245] as const, steps:[138,245] as const,
};
export function zenPixelPosition(x:number,y:number,pixel:readonly [number,number]) {
 const offset=unproject({x:(pixel[0]-ZEN_TEMPLE.anchor[0])*ZEN_TEMPLE.size,y:(pixel[1]-ZEN_TEMPLE.anchor[1])*ZEN_TEMPLE.size},TILE);
 return {x:x+ZEN_TEMPLE.rootX+offset.x,y:y+ZEN_TEMPLE.rootY+offset.y};
}
export function zenEntrance(x:number,y:number) {
 const door=zenPixelPosition(x,y,ZEN_TEMPLE.door),steps=zenPixelPosition(x,y,ZEN_TEMPLE.steps);
 const landing=zenPixelPosition(x,y,ZEN_TEMPLE.landing);
 return {door,landing,steps,apron:{x:steps.x+.55,y:steps.y}};
}
/** Ground-plane corners traced around the broad stone terrace, with a planting margin. */
export const ZEN_HEDGE_RING = [[5,237],[96,203],[187,237],[96,269]] as const;

/** Reviewed free-hanging corner ornaments in the normalized painting. */
export const ZEN_BELLS = [
 {x:42,y:111,width:4,height:7},{x:146,y:111,width:4,height:7},
 {x:37,y:145,width:4,height:6},{x:151,y:145,width:4,height:6},
 {x:26,y:183,width:4,height:6},{x:162,y:183,width:4,height:6},
] as const;
