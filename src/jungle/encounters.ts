import type { Neighbor } from '../agents';
import { noise } from '../iso/math';

/** Food-web relationships are intentionally narrow: insects, scavengers and
 * elephants do not flee every carnivore. A hawk only alarms small ground animals. */
export function threatens(predator:Pick<Neighbor,'kind'|'altitude'>,prey:string):boolean {
 if(predator.kind==='hawk')return (predator.altitude??100)<35&&['squirrel','toad'].includes(prey);
 if(predator.kind==='tiger')return ['deer','zebra','boar','monkey'].includes(prey);
 if(predator.kind==='jaguar')return ['deer','zebra','monkey','squirrel'].includes(prey);
 if(predator.kind==='wolf')return ['deer','zebra','squirrel'].includes(prey);
 if(predator.kind==='blackBear')return ['deer','squirrel'].includes(prey);
 if(predator.kind==='boar')return prey==='deer';
 return false;
}
export function nearestThreat(kind:string,x:number,y:number,neighbors:readonly Neighbor[],radius=2.2):Neighbor|undefined {
 return neighbors.filter(n=>threatens(n,kind)&&Math.hypot(n.x-x,n.y-y)<radius)
  .sort((a,b)=>Math.hypot(a.x-x,a.y-y)-Math.hypot(b.x-x,b.y-y)||a.id.localeCompare(b.id))[0];
}
/** Broad complementary ranges usually separate hunters and prey at generation.
 * The narrow overlap permits occasional encounters without visit-order state. */
export function predatorRange(x:number,y:number,seed:number):number {return noise(x/14,y/14,seed+18371);}
export function populationRange(kind:string,x:number,y:number,seed:number):boolean {
 const range=predatorRange(x,y,seed);
 if(['tiger','jaguar','wolf','blackBear'].includes(kind))return range>.56;
 if(['deer','zebra'].includes(kind))return range<.60;
 return true;
}
