import { ACCENT_FORMS, ACCENT_SIZES } from '../../src/jungle/accents';
import { isolatePlant } from './foliage';
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
 const variety=await sharp('assets/source/landscape-accent-variety.png').ensureAlpha().raw().toBuffer({resolveWithObject:true});
 for(let i=3;i<variety.data.length;i+=4){if(variety.data[i]!<240)variety.data.fill(0,i-3,i+1);else variety.data[i]=255;}
 // Reviewed generated rows have unequal gutters; do not blindly quarter height.
 const rows=[0,.27,.51,.755,1];
 for(let i=0;i<ACCENT_FORMS.length;i++){
  const left=Math.round(i%4*variety.info.width/4),right=Math.round((i%4+1)*variety.info.width/4);
  const top=Math.round(rows[i>>2]!*variety.info.height),bottom=Math.round(rows[(i>>2)+1]!*variety.info.height);
  const cell=await sharp(variety.data,{raw:{width:variety.info.width,height:variety.info.height,channels:4}}).extract({left,top,width:right-left,height:bottom-top}).raw().toBuffer();
  const clean=isolatePlant({width:right-left,height:bottom-top,data:cell}),size=ACCENT_SIZES[i]!;
  const png=await sharp(clean.data,{raw:{width:clean.width,height:clean.height,channels:4}}).png().toBuffer();
  const pixels=await sharp(png).trim({threshold:10}).resize(size-4,size-4,{fit:'contain',position:'bottom',background:{r:0,g:0,b:0,alpha:0},kernel:'nearest'})
   .extend({top:2,bottom:2,left:2,right:2,background:{r:0,g:0,b:0,alpha:0}}).raw().toBuffer();
  sprites.push({id:`accent-${ACCENT_FORMS[i]}`,anchor:[size/2,size-3],frames:[{width:size,height:size,data:pixels}]});
 }
 return sprites;
}
