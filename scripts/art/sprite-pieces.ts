import { createHash } from 'node:crypto';
import type { BakeSprite } from '../../src/iso/bake/atlas';
/** Lossless registered pieces share stationary pixels across poses and variants.
 * Every piece retains the clip's frame order and common world root. */
export function spritePieces(s:BakeSprite,size=8):BakeSprite[]{
 const {width,height}=s.frames[0]!,out:BakeSprite[]=[];
 for(let y=0;y<height;y+=size)for(let x=0;x<width;x+=size){
  const w=Math.min(size,width-x),h=Math.min(size,height-y);
  let frames=s.frames.map(f=>{const data=new Uint8Array(w*h*4);for(let row=0;row<h;row++)data.set(f.data.subarray(((y+row)*width+x)*4,((y+row)*width+x+w)*4),row*w*4);return{width:w,height:h,data};});
  if(!frames.some(f=>f.data.some((n,i)=>i%4===3&&n)))continue;
  if(new Set(frames.map(f=>createHash('sha256').update(f.data).digest('hex'))).size===1)frames=[frames[0]!];
  out.push({id:`${s.id}:tile:${x}:${y}`,anchor:[s.anchor[0]-x,s.anchor[1]-y],frames,trim:false});
 }return out;
}
