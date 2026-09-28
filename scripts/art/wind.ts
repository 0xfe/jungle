import type { PixelImage } from '../../src/iso/render';
import { PLANT_FRAMES, TAU } from '../../src/jungle/animation';

/** Registered pixel wind: sample the painting once, then displace rows without blur.
 * Motion tends smoothly to zero below the foliage mask; root pixels are exact copies.
 */
export function windFrames(source: PixelImage, width: number, height: number, kind: 'tree' | 'plant', variant: number): PixelImage[] {
  const stableLine = kind === 'tree' ? .62 : variant === 3 ? .4 : .85;
  // Register the source texture once. Resampling the high-resolution painting for
  // every subpixel displacement makes its leaf detail boil even when roots align.
  const registered=new Uint8Array(width*height*4);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const sx=Math.floor((x+.5)/width*source.width),sy=Math.floor((y+.5)/height*source.height);
    const src=(sy*source.width+sx)*4;registered.set(source.data.subarray(src,src+4),(y*width+x)*4);
  }
  let crownTop=0;
  while(crownTop<height&&!registered.subarray(crownTop*width*4,(crownTop+1)*width*4).some((v,i)=>i%4===3&&v>0))crownTop++;
  const movingHeight=Math.max(1/height,stableLine-crownTop/height);
  return Array.from({ length: PLANT_FRAMES }, (_, frame) => {
    const phase = frame / PLANT_FRAMES * TAU, data = new Uint8Array(width * height * 4);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const t = Math.min(1,Math.max(0, (stableLine - y / height) / movingHeight)), weight = t * t * (3 - 2 * t);
      const dx = weight * (Math.sin(phase) * .85 + Math.sin(phase + y * .15) * .35);
      const sx = Math.round(x-dx), sy = y;
      if (sx < 0 || sx >= source.width || sy < 0 || sy >= source.height) continue;
      const src = (sy * width + sx) * 4;
      data.set(registered.subarray(src, src + 4), (y * width + x) * 4);
    }
    return { width, height, data };
  });
}
