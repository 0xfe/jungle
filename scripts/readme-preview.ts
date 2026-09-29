import sharp from 'sharp';
import {readFile,writeFile} from 'node:fs/promises';
import {MemoryRenderer} from '../src/iso/render';
import type {AtlasManifest} from '../src/jungle/scene';
import {InfiniteWorld} from '../src/jungle/infinite';
import {cameraBounds,composeInfinite} from '../src/jungle/infinite-scene';

/** Offline README clip: the real scene/simulation, fixed camera, five seconds at
 * 20 fps. Three 60 Hz ticks per frame keep motion at its normal playback speed.
 * This uses the same committed atlas and painter ordering as the browser.
 */
const width=800,height=530,fps=20,seconds=5,frames=fps*seconds;
const view={width,height,pixelRatio:1,zoom:.58,grid:false,cameraX:6.524,cameraY:1.301};
const world=new InfiniteWorld(2718);
const atlas:AtlasManifest=JSON.parse(await readFile('public/assets/jungle.json','utf8'));
const raw=await sharp('public/assets/jungle.png').ensureAlpha().raw().toBuffer({resolveWithObject:true});
const renderer=new MemoryRenderer({width:raw.info.width,height:raw.info.height,data:raw.data});
world.ensure(cameraBounds(view));
for(let i=0;i<8*60;i++)world.update(1/60);
const pages=Buffer.alloc(width*height*4*frames);
for(let frame=0;frame<frames;frame++){
 renderer.render(composeInfinite(world,atlas,view,1));
 pages.set(renderer.pixels.data,frame*width*height*4);
 for(let tick=0;tick<60/fps;tick++)world.update(1/60);
 if((frame+1)%20===0)console.log(`Rendered ${frame+1}/${frames} frames`);
}
// A restrained palette with no diffusion preserves crisp pixel-art texture.
const gif=await sharp(pages,{raw:{width,height:height*frames,channels:4,pageHeight:height}})
 .gif({loop:0,delay:Array(frames).fill(1000/fps),colours:256,dither:0,effort:7,interFrameMaxError:0})
 .toBuffer();
const metadata=await sharp(gif,{animated:true}).metadata();
const duration=metadata.delay?.reduce((sum,delay)=>sum+delay,0);
if(duration!==seconds*1000||metadata.loop!==0)throw new Error(`Invalid GIF timing: ${duration} ms, loop ${metadata.loop}`);
// Decode every page, not just its metadata, before accepting the artifact.
await sharp(gif,{animated:true}).raw().toBuffer();
await writeFile('docs/preview.gif',gif);
await sharp(pages.subarray(0,width*height*4),{raw:{width,height,channels:4}}).png().toFile('docs/preview.png');
console.log(`README GIF: ${width} × ${height}, ${metadata.pages} frames, ${duration} ms, ${(gif.length/1024/1024).toFixed(2)} MiB`);
