import type { PixelImage } from '../../src/iso/render';
import { PLANT_FRAMES, TAU } from '../../src/jungle/animation';
/** Hanging lianas: authored curve grammar, fixed canopy attachment, freely swaying tips.
 * Baked once and shared by trees; no per-leaf runtime objects or extra textures. */
export function vineFrames(variant:number):PixelImage[] {
  const width=32,height=88;
  return Array.from({length:PLANT_FRAMES},(_,frame)=>{
    const data=new Uint8Array(width*height*4),phase=frame/PLANT_FRAMES*TAU;
    const pixel=(x:number,y:number,c:readonly number[])=>{x=Math.round(x);y=Math.round(y);if(x>0&&x<width-1&&y>0&&y<height-1)data.set(c,(y*width+x)*4);};
    for(let strand=0;strand<2;strand++){
      const length=27+variant*3+strand*5,startX=10+strand*12,startY=16+strand*5;
      for(let i=0;i<=length;i++){
        const t=i/length,bend=Math.sin(t*3+variant)*3*t+Math.sin(phase+strand*.8+t*2)*1.5*t*t;
        const x=startX+bend,y=startY+i;
        pixel(x,y,[42,84,36,255]);pixel(x+1,y,[85,123,47,235]);
        if(i>3&&i%6===0){const side=(i/6|0)%2?1:-1;
          for(let l=1;l<=3;l++){pixel(x+l*side,y+l*.5,[60,117,48,255]);pixel(x+l*side,y+l*.5-1,[116,151,63,255]);}
        }
      }
    }
    return{width,height,data};
  });
}
