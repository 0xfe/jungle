import sharp from 'sharp';
import type { BakeSprite } from '../../src/iso/bake/atlas';
import { GROVE_ANCHOR, GROVE_ROOTS, GROVE_SOURCE_SCALE, PATCH_KINDS, isGrove } from '../../src/jungle/patches';

/** Shared logical scale factors retain the reviewed source-to-world trunk registration. */
export const patchLogicalScale=(id:string)=>/^patch-(grove|bloom|fruit)-/.test(id)?384/128*GROVE_SOURCE_SCALE:id.startsWith('patch-bush-')?2:id.startsWith('patch-wet-')?2.4:id.startsWith('patch-flowers-')?2.4:id.startsWith('patch-mud-')?3.2:id.startsWith('patch-grass-')?3.4:384/96;
/** Build-time registered semantic masks for continuous runtime wind. Source art never loads in the browser. */
export async function bakeLandscapePatches():Promise<BakeSprite[]> {
 const inputs:BakeSprite[]=[];
 for(const style of PATCH_KINDS){
  const grove=isGrove(style),bush=style==='bush',colorTrees=style==='bloom'||style==='fruit',colorGround=style==='flowers'||style==='mud',rows=grove||bush||colorGround?2:3;
  const file=colorTrees?'landscape-color-groves':colorGround?'landscape-color-ground':grove||bush?'landscape-groves':'landscape-ground';
  const source=await sharp(`assets/source/${file}.png`).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const row=colorTrees?(style==='bloom'?0:1):colorGround?(style==='flowers'?0:1):grove?0:bush?1:style==='grass'?0:style==='wet'?1:2;
  const width=grove?128:96,top=Math.round(row*source.info.height/rows),bottom=Math.round((row+1)*source.info.height/rows);
  const height=Math.round((bottom-top)*width/384),factor=width/384;
  const anchor:[number,number]=grove?[GROVE_ANCHOR[0]*factor,GROVE_ANCHOR[1]*factor]:[width/2,(colorGround?325:bush?310:style==='grass'?240:style==='wet'?225:160)*factor];
  for(let variant=0;variant<4;variant++){
   const decoded=await sharp(source.data,{raw:{width:source.info.width,height:source.info.height,channels:4}})
    .extract({left:variant*384,top,width:384,height:bottom-top}).resize(width,height,{kernel:'nearest'}).raw().toBuffer();
   // The alpha supplied by ImageGen is authoritative. Clear invisible RGB and the
   // faint sub-32 alpha fringe, so resampling does not produce colored rectangles.
   for(let i=0;i<decoded.length;i+=4)if(decoded[i+3]!<32)decoded.fill(0,i,i+4);
   const parts=grove?4:1;
   for(let part=0;part<parts;part++)for(const mask of (style==='flowers'?['base','leaves','petals']:['base','leaves'])){
    const foliage=mask==='leaves';
    const pixels=new Uint8Array(width*height*4),roots=GROVE_ROOTS[variant]!;
    for(let y=0;y<height;y++)for(let x=0;x<width;x++){
     const i=(y*width+x)*4;if(!decoded[i+3])continue;
     let owner=0;
     if(grove){
      let best=Infinity;
      for(let k=0;k<3;k++){const r=roots[k]!,d=(x/factor-r[0])**2+(y/factor-(r[1]-120))**2*.35;if(d<best){best=d;owner=k;}}
      if(y/factor>roots[owner]![1]-12)owner=3;
      if(owner!==part)continue;
     }
     const r=decoded[i]!,g=decoded[i+1]!,b=decoded[i+2]!;
     const leaf=g>r*1.06&&g>b*1.15;
     // Colorful flower heads move with their stems; earthy pixels retain a
     // stationary base. Keep the source colors rather than tinting petals green.
     const petal=style==='flowers'&&!leaf&&r>110&&(
      (r>g*1.12&&b>g*.72)||(r>150&&r>g*1.3&&r>b*1.3)||
      (r>g*.9&&g>100&&g>b*1.8)||Math.min(r,g,b)>165);
     if(mask!==(leaf?'leaves':petal?'petals':'base'))continue;
     if(foliage){const value=Math.min(255,Math.round(g*255/174));pixels.set([value,value,value,decoded[i+3]!],i);}
     else pixels.set(decoded.subarray(i,i+4),i);
    }
    if(!pixels.some((n,i)=>i%4===3&&n>0))throw new Error(`Empty landscape mask: ${style}/${variant}/${part}/${foliage?'leaves':'base'}`);
    // Keep one registered pose. Display-time rooted shear supplies smooth wind
    // at any refresh rate, without the former two-poses-per-second pixel jumps.
    const frames=[{width,height,data:pixels}];
    inputs.push({id:`patch-${style}-${variant}-${part}-${mask}`,anchor,frames});
   }
  }
 }
 return inputs;
}
