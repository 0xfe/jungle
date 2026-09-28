import { clamp, noise } from '../iso/math';
/** Shared palette ramp: deep water, shallows, sand, dry grass, forest. */
export const GROUND_PALETTE = [[40,124,133],[91,179,164],[184,167,109],[137,158,83],[99,132,64]] as const;
/** Eight small color steps per material retain pixel grain without hard biome outlines. */
export const GROUND_STEPS = 32;
const smooth = (a:number,b:number,x:number) => {const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
/** Appearance only: physical water remains at lake=0. Grass thins over a wider shore. */
export function groundBlend(fields:readonly number[],x:number,y:number,seed:number):number {
 const lake=fields[0]!,dry=fields[2]!,meadow=fields[3]!;
 const land=Math.min(4-2*smooth(-.055,.04,dry),4-smooth(-.04,.04,meadow));
 const water=lake<-.018?smooth(-.10,-.025,lake):lake<.016?1+smooth(-.018,.016,lake):2+2*smooth(.016,.105,lake);
 const value=Math.min(water,land);
 // Noise fades at material centers, preserving stable interiors and continuous borders.
 return clamp(value+(noise(x*2.1,y*2.1,seed+701)-.5)*.16*Math.sin(Math.PI*value)**2,0,4);
}
/** Vegetation density follows the same shore gradient as ground color. */
export function groundVegetation(fields:readonly number[]):number {
 return smooth(.016,.105,fields[0]!)*(1-.92*smooth(-.055,.04,fields[2]!))*(1-.72*smooth(-.04,.04,fields[3]!));
}
