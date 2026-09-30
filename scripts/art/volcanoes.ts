import sharp from 'sharp';
import { hash, noise } from '../../src/iso/math';
import type { BakeSprite } from '../../src/iso/bake/atlas';
/** Four reviewed equal source cells; a single registered pose plus runtime flow/effects. */
export async function bakeVolcanoes():Promise<BakeSprite[]> {
  const source=await sharp('assets/source/volcano-forms.png').ensureAlpha().raw().toBuffer({resolveWithObject:true}),result:BakeSprite[]=[];
  if(source.info.width!==1254||source.info.height!==1254)throw new Error('Volcano source must match the reviewed 1254×1254 four-cell registration');
  for(let form=0;form<4;form++){
    const left=(form%2)*627,top=Math.floor(form/2)*627;
    const crop=await sharp(source.data,{raw:{width:source.info.width,height:source.info.height,channels:4}}).extract({left,top,width:627,height:627}).png().toBuffer();
    const cell=await sharp(crop).trim({threshold:16}).resize(96,80,{fit:'contain',position:'bottom',kernel:'nearest',background:{r:0,g:0,b:0,alpha:0}}).extend({top:4,bottom:4,left:4,right:4,background:{r:0,g:0,b:0,alpha:0}}).raw().toBuffer();
    for(let i=0;i<cell.length;i+=4)if(cell[i+3]!<32)cell.fill(0,i,i+4);
    result.push({id:`volcano-${form}`,anchor:[52,71.5],frames:[{width:104,height:88,data:cell}]});
  }
  for(const kind of ['smoke','ash','flame'] as const){
    const width=32,height=32,data=new Uint8Array(width*height*4);
    for(let y=0;y<height;y++)for(let x=0;x<width;x++){
      const dx=(x-16)/14,dy=(y-16)/14,d=dx*dx+dy*dy,grain=hash(x>>1,y>>1,8171);
      if(kind==='smoke'&&d<.82+grain*.18)data.set([145+Math.floor(grain*28),142+Math.floor(grain*25),137+Math.floor(grain*22),Math.round((1-d)*180)],(y*width+x)*4);
      if(kind==='ash'&&dx*dx+dy*dy*5<.8&&grain>.3)data.set([59+Math.floor(grain*35),55+Math.floor(grain*35),54+Math.floor(grain*35),Math.round((1-d)*240)],(y*width+x)*4);
      if(kind==='flame'&&Math.abs(dx)<(.15+(y/32)*.65)*(1+Math.sin(y*.7)*.3)&&y>3)data.set([255,y>18?170:85,y>22?40:16,Math.round((1-y/45)*255)],(y*width+x)*4);
    }
    result.push({id:`volcano-${kind}`,anchor:[16,kind==='smoke'?16:26],frames:[{width,height,data}]});
  }
  // A continuous, irregular molten surface in the source art's orange/yellow palette.
  // Domain-warped rock islands and branching hot seams replace repeated square cells.
  for(const kind of ['molten','crust'] as const){
    const width=kind==='molten'?32:16,height=kind==='molten'?96:16,data=new Uint8Array(width*height*4);
    for(let y=0;y<height;y++)for(let x=0;x<width;x++){
      const warp=noise(x/13,y/19,8180)*9,u=x+warp,v=y+noise(x/17,y/11,8181)*12;
      const field=noise(u/8,v/12,8182)*.7+noise(u/3,v/5,8183)*.3;
      const edge=Math.abs(x-width/2)/(width/2),grain=hash(x,y,8184);
      const seam=Math.abs(field-.5),plate=seam>.105+(.95-edge)*.07;
      const c=kind==='crust'?[43+grain*35,35+grain*27,34+grain*26]:
        (edge>.87&&field>.42)||plate?[67+grain*38,36+grain*17,29+grain*14]:
        seam<.035?[255,218+grain*32,39+grain*25]:seam<.085?[255,130+grain*60,8]:[229+grain*26,48+grain*40,6];
      data.set([...c.map(Math.round),255],(y*width+x)*4);
    }
    result.push({id:`volcano-${kind}`,anchor:[0,0],trim:false,frames:[{width,height,data}]});
  }
  return result;
}
