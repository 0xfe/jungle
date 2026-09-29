import type {PixelImage} from '../../src/iso/render';
import {ACCENT_FRAMES} from '../../src/jungle/accents';

/** Deform registered artwork locally: flower heads nod and leaf fans flutter
 * out of phase, while the lowest four rows remain exact copies of the source.
 * Inverse nearest-neighbor sampling avoids holes, blur and resampling shimmer.
 */
export function accentRustlePose(source:PixelImage,phase:number,variant:number):PixelImage {
 const {width,height}=source,data=new Uint8Array(source.data.length),angle=phase*Math.PI*2;
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const t=Math.max(0,Math.min(1,(height-5-y)/Math.max(1,height-9))),weight=t*t*(3-2*t);
  // Broad leaf fans alternate across the crown; a second shorter wave nods
  // petal clusters vertically without moving the whole plant as a rigid card.
  const fan=x/width*Math.PI*2+y/height*2.1+variant*.73;
  const nod=x/width*3.4-y/height*4.2+variant*.41;
  const dx=weight*.72*(Math.sin(angle+fan)-Math.sin(fan));
  const dy=weight*.48*(Math.sin(angle*2+nod)-Math.sin(nod));
  const sx=Math.round(x-dx),sy=Math.round(y-dy);
  if(sx<0||sx>=width||sy<0||sy>=height)continue;
  const from=(sy*width+sx)*4;
  data.set(source.data.subarray(from,from+4),(y*width+x)*4);
 }
 return {width,height,data};
}
export function accentRustleFrames(source:PixelImage,variant:number):PixelImage[] {
 return Array.from({length:ACCENT_FRAMES},(_,i)=>accentRustlePose(source,i/ACCENT_FRAMES,variant));
}
