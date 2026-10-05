import type { AtlasManifest,Sprite } from './scene';
import type { Region } from '../iso/render';
/** Numeric references share immutable UV objects across clips after decompression. */
export interface RuntimeAtlas {
 format:'jungle-atlas-1';meta:Omit<AtlasManifest,'sprites'|'animalClips'|'spacecraftParts'|'zenParts'>;
 regions:number[];sprites:[string,number,number,number,number,number[],number[]?][];
 animals?:[string,number,number[]][];ships?:[string,number[]][];zen?:[string,number[]][];
}
export function decodeRuntimeAtlas(data:RuntimeAtlas):AtlasManifest {
 if(data.format!=='jungle-atlas-1'||data.regions.length%4)throw new Error('Unsupported sprite manifest encoding');
 const regions:Region[]=[];
 for(let i=0;i<data.regions.length;i+=4)regions.push({x:data.regions[i]!,y:data.regions[i+1]!,width:data.regions[i+2]!,height:data.regions[i+3]!});
 const sprites:Record<string,Sprite>={},names=data.sprites.map(s=>s[0]);
 for(const [name,width,height,x,y,frames,frameIndices] of data.sprites){
  if(sprites[name])throw new Error(`Duplicate sprite: ${name}`);
  const resolved=frames.map(i=>{const r=regions[i];if(!r)throw new Error(`Invalid atlas region for ${name}`);return r;});
  sprites[name]={width,height,anchor:[x,y],frames:resolved,...(frameIndices?{frameIndices}: {})};
 }
 const parts=(list:number[])=>list.map(i=>{const name=names[i];if(name===undefined)throw new Error('Invalid atlas part reference');return name;});
 return {...data.meta,sprites,
  ...(data.animals?{animalClips:Object.fromEntries(data.animals.map(([name,frames,p])=>[name,{parts:parts(p),frames}]))}:{}),
  ...(data.ships?{spacecraftParts:Object.fromEntries(data.ships.map(([name,p])=>[name,parts(p)]))}:{}),
  ...(data.zen?{zenParts:Object.fromEntries(data.zen.map(([name,p])=>[name,parts(p)]))}:{})};
}
