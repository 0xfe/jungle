import sharp from 'sharp';
import {mkdir,readFile} from 'node:fs/promises';
import {ACCENT_FORMS} from '../../src/jungle/accents';

/** Review actual packed frames, at one stable root/baseline per row. */
await mkdir('artifacts',{recursive:true});
const atlas=JSON.parse(await readFile('public/assets/jungle.json','utf8'));
const panels:sharp.OverlayOptions[]=[];
for(const [row,name] of ACCENT_FORMS.entries()){
 const sprite=atlas.sprites[`accent-${name}`];
 for(let column=0;column<7;column++){
  const frame=sprite.frames[column*2];
  const input=await sharp('public/assets/jungle.png').extract({left:frame.x,top:frame.y,width:frame.width,height:frame.height}).png().toBuffer();
  panels.push({input,left:column*64+32-sprite.anchor[0],top:row*64+59-sprite.anchor[1]});
 }
}
const png=await sharp({create:{width:448,height:1024,channels:4,background:'#33472f'}}).composite(panels).png().toBuffer();
await sharp(png).resize(896,2048,{kernel:'nearest'}).png().toFile('artifacts/accent-rustle-strip.png');
console.log('Registered leaf and petal phases → artifacts/accent-rustle-strip.png');
