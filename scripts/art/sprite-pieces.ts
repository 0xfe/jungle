import { createHash } from 'node:crypto';
import type { BakeSprite } from '../../src/iso/bake/atlas';
import type { PixelImage } from '../../src/iso/render';
/** Build-scoped interning avoids retaining millions of identical tiny RGBA arrays. */
export type PixelPiecePool=Map<string,PixelImage>;
/** Lossless registered pieces share stationary pixels across poses and variants.
 * Every piece retains the clip's frame order and common world root. */
export function spritePieces(s:BakeSprite,size=8,pool?:PixelPiecePool):BakeSprite[]{
 const {width,height}=s.frames[0]!,out:BakeSprite[]=[];
 for(let y=0;y<height;y+=size)for(let x=0;x<width;x+=size){
  const w=Math.min(size,width-x),h=Math.min(size,height-y);
  let frames=s.frames.map(f=>{
   const data=new Uint8Array(w*h*4);for(let row=0;row<h;row++)data.set(f.data.subarray(((y+row)*width+x)*4,((y+row)*width+x+w)*4),row*w*4);
   const image={width:w,height:h,data};if(!pool)return image;
   const key=`${w},${h}:${Buffer.from(data).toString('base64')}`,existing=pool.get(key);if(existing)return existing;
   pool.set(key,image);return image;
  });
  if(!frames.some(f=>f.data.some((n,i)=>i%4===3&&n)))continue;
  if(new Set(frames.map(f=>createHash('sha256').update(f.data).digest('hex'))).size===1)frames=[frames[0]!];
  out.push({id:`${s.id}:tile:${x}:${y}`,anchor:[s.anchor[0]-x,s.anchor[1]-y],frames,trim:false});
 }return out;
}

/** Keep invariant pixels in one registered layer; tile only pixels that actually change.
 * Static and moving layers never overlap, so reconstruction preserves every RGBA byte. */
export function stationarySpritePieces(source:BakeSprite,size=3,pool?:PixelPiecePool):BakeSprite[]{
 const first=source.frames[0]!;
 if(source.frames.length===1)return[{...source,id:`${source.id}:still`}];
 const still=new Uint8Array(first.data.length),mask=new Uint8Array(first.width*first.height);
 let count=0;
 for(let pixel=0;pixel<mask.length;pixel++){
  const at=pixel*4;if(!first.data[at+3])continue;
  if(source.frames.every(f=>f.data[at]===first.data[at]&&f.data[at+1]===first.data[at+1]&&f.data[at+2]===first.data[at+2]&&f.data[at+3]===first.data[at+3])){
   mask[pixel]=1;still.set(first.data.subarray(at,at+4),at);count++;
  }
 }
 if(count<12)return spritePieces(source,size,pool);
 const moving=source.frames.map(f=>{
  const data=f.data.slice();for(let pixel=0;pixel<mask.length;pixel++)if(mask[pixel])data.fill(0,pixel*4,pixel*4+4);
  return{width:f.width,height:f.height,data};
 });
 return[{id:`${source.id}:still`,anchor:source.anchor,frames:[{width:first.width,height:first.height,data:still}]},...spritePieces({...source,frames:moving},size,pool)];
}
