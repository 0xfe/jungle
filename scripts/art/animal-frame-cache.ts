import { createHash } from 'node:crypto';
import { mkdir,readFile,writeFile,rename } from 'node:fs/promises';
import { serialize,deserialize } from 'node:v8';
import { gzipSync,gunzipSync } from 'node:zlib';
import type { BakeSprite } from '../../src/iso/bake/atlas';
const digest=(data:Uint8Array)=>createHash('sha256').update(data).digest('hex');
/** One replaceable cache entry per rig/form; source keys and payload hashes both validate. */
export async function cachedAnimalFrames(root:string,name:string,key:string,make:()=>BakeSprite[]):Promise<BakeSprite[]>{
 const path=`${root}/${name}.bin`;
 try{
  const envelope=deserialize(await readFile(path)) as {key:string;hash:string;data:Uint8Array};
  if(envelope.key===key&&digest(envelope.data)===envelope.hash)return deserialize(gunzipSync(envelope.data)) as BakeSprite[];
 }catch{/* A missing/corrupt optional cache rebuilds from retained sources. */}
 const result=make(),data=gzipSync(serialize(result),{level:1});
 await mkdir(root,{recursive:true});await writeFile(`${path}.tmp`,serialize({key,hash:digest(data),data}));await rename(`${path}.tmp`,path);
 return result;
}
