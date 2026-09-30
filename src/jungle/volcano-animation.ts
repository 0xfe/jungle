import { clamp, lerp, type Vec2 } from '../iso/math';

/** Offline registrations in the original 104 × 88 mountain coordinate system. */
export interface VolcanoLavaArt { trails:Vec2[][]; glow:Vec2[] }

/** Short source-pixel paths have approximately uniform spacing and always descend. */
export function slopeParticle(trail:readonly Vec2[],phase:number):Vec2 {
  const index=clamp(phase,0,1)*(trail.length-1),i=Math.min(trail.length-2,Math.floor(index));
  const a=trail[i]!,b=trail[i+1]!;
  return {x:lerp(a.x,b.x,index-i),y:lerp(a.y,b.y,index-i)};
}

/** Positive wrap also supports negative checkpoint/preview times. */
export function flowPhase(time:number,offset:number,speed:number):number {
  return ((time*speed+offset)%1+1)%1;
}

/** Reds, oranges and hot yellow-white pixels share the painted lava's palette. */
export const FIRE_COLORS = [[224,49,8],[255,91,9],[255,151,13],[255,210,38],[255,241,114]] as const;
