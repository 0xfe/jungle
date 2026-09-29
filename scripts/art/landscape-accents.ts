import sharp from 'sharp';
import type { BakeSprite } from '../../src/iso/bake/atlas';
/** Four retained source cells. Keep a single registered pose and animate geometry.
 * Alpha threshold removes generated translucent fringes before nearest sampling. */
export async function bakeLandscapeAccents():Promise<BakeSprite[]> {
 const {data,info}=await sharp('assets/source/landscape-accents.png').ensureAlpha().raw().toBuffer({resolveWithObject:true});
 for(let i=3;i<data.length;i+=4){if(data[i]!<240)data.fill(0,i-3,i+1);else data[i]=255;}
 const sprites:BakeSprite[]=[];
 for(let i=0;i<4;i++){
  const width=info.width/2,height=info.height/2,plant=i<2,size=plant?32:i===2?14:12;
  const cell=await sharp(data,{raw:{width:info.width,height:info.height,channels:4}})
   .extract({left:(i%2)*width,top:Math.floor(i/2)*height,width,height}).png().toBuffer();
  const pixels=await sharp(cell).trim({threshold:10})
   .resize(size,size,{fit:'contain',position:plant?'bottom':'centre',background:{r:0,g:0,b:0,alpha:0},kernel:'nearest'}).raw().toBuffer();
  sprites.push({id:`accent-${['flowers','bush','butterfly','leaf'][i]}`,anchor:[size/2,plant?size-1:size/2],frames:[{width:size,height:size,data:pixels}]});
 }
 return sprites;
}
