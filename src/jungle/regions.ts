import { CONFIG } from '../config';
import { clamp, noise } from '../iso/math';

const ramp=(lo:number,hi:number,value:number)=>{const t=clamp((value-lo)/(hi-lo),0,1);return t*t*(3-2*t);};
/** Recurrent world-space regions, independent of the opening, camera and visit order. */
export function regionalWetness(x:number,y:number,seed:number):number {
 const size=CONFIG.world.regions.scale;
 return ramp(.46,.78,noise(x/size,y/size,seed+7300));
}
export function forestRegion(x:number,y:number,seed:number){
 const c=CONFIG.world.regions,size=c.scale;
 const open=ramp(.5,.8,noise(x/size,y/size,seed+7301));
 return {canopy:1-open*(1-c.openCanopy),
  flowers:ramp(.43,.73,noise(x/(size*.7),y/(size*.7),seed+7302)),
  fruit:ramp(.5,.77,noise(x/(size*.8),y/(size*.8),seed+7303))};
}
