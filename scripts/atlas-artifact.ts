import { createHash } from 'node:crypto';
import { readFile,writeFile,mkdir } from 'node:fs/promises';
import { resolve,dirname } from 'node:path';
import { gunzipSync } from 'node:zlib';
const digest=(data:Uint8Array)=>createHash('sha256').update(data).digest('hex');
/** Restore the inspectable JSON from its retained, lossless compressed artifact. */
export async function restoreAtlasManifest(root:string,archiveHash:string,manifestHash:string){
 const archive=await readFile(resolve(root,'assets/jungle-manifest.json.gz'));
 if(digest(archive)!==archiveHash)throw new Error('Retained sprite manifest archive hash mismatch');
 const path=resolve(root,'public/assets/jungle.json');
 let json;
 try{json=await readFile(path);}catch(error){
  if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;
  json=gunzipSync(archive);
  if(digest(json)!==manifestHash)throw new Error('Restored sprite manifest hash mismatch');
  await mkdir(dirname(path),{recursive:true});await writeFile(path,json);
 }
 if(digest(json)!==manifestHash)throw new Error('Generated sprite manifest hash mismatch');
 return json;
}
