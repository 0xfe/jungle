import type {PixelImage} from '../../src/iso/render';
/** Isolate the central connected plant from neighboring-cell fragments. Keep a
 * two-pixel fringe so alpha edges and small detached leaf pixels survive. Build only. */
export function isolatePlant(image:PixelImage):PixelImage {
 const {width,height,data}=image,n=width*height,labels=new Int32Array(n),queue=new Int32Array(n);
 let label=0,best=0,bestSize=0;
 for(let p=0;p<n;p++){
  if(labels[p]||data[p*4+3]!<32)continue;
  label++;let head=0,tail=1;queue[0]=p;labels[p]=label;
  while(head<tail){const i=queue[head++]!,x=i%width,y=(i/width)|0;
   for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
    const nx=x+dx,ny=y+dy,j=ny*width+nx;
    if(nx>=0&&nx<width&&ny>=0&&ny<height&&!labels[j]&&data[j*4+3]!>=32){labels[j]=label;queue[tail++]=j;}
   }
  }
  if(tail>bestSize){best=label;bestSize=tail;}
 }
 const keep=new Uint8Array(n);
 for(let i=0;i<n;i++)if(labels[i]===best&&best){const x=i%width,y=(i/width)|0;
  for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++)if(x+dx>=0&&x+dx<width&&y+dy>=0&&y+dy<height)keep[(y+dy)*width+x+dx]=1;
 }
 const clean=data.slice();for(let i=0;i<n;i++)if(!keep[i])clean.fill(0,i*4,i*4+4);
 return{width,height,data:clean};
}
