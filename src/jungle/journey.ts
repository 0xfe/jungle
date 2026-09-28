import { CONFIG } from '../config';
import { clamp } from '../iso/math';
/** A seed-anchored opening, not camera-dependent spawning. Existing patch noise adds local variety. */
export function journeyDensity(x:number,y:number,origin:{x:number;y:number}) {
 const distance=Math.hypot(x-origin.x,y-origin.y);
 const c=CONFIG.world.opening;
 const t=clamp((distance-c.innerRadius)/(c.outerRadius-c.innerRadius),0,1),growth=t*t*(3-2*t);
 return {plants:c.plants+(1-c.plants)*growth,animals:c.animals+(1-c.animals)*growth};
}
