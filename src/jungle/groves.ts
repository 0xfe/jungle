import { hash, noise } from '../iso/math';
/** Domain-warped stands: shared species/form/scale cross tile and chunk boundaries. */
export function groveAt(x:number,y:number,seed:number) {
 const gx=Math.floor((x+noise(x/9,y/9,seed+613)*2)/5),gy=Math.floor((y+noise(x/9,y/9,seed+947)*2)/5);
 const lean=hash(gx,gy,seed+105)<.09;
 return {species:pickSpecies(hash(gx,gy,seed+93)),morphology:lean?2:hash(gx,gy,seed+314)<.25?1:0,
   scale:.87+hash(gx,gy,seed+816)*.12};
}

function pickSpecies(t:number):number { return t<.60?0:t<.77?1:t<.92?2:3; }
