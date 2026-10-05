import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,rm,writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync,gunzipSync } from 'node:zlib';
import { packRuntimeAtlas } from '../scripts/atlas-pack.mjs';
import { decodeRuntimeAtlas } from '../src/jungle/atlas-codec.ts';
import { cachedAnimalFrames } from '../scripts/art/animal-frame-cache.ts';

test('delivery manifest preserves every region, timing index, group and metadata field',async()=>{
 const region={x:1,y:2,width:3,height:4},sprite={width:4.5,height:6,anchor:[2.5,5],frames:[region],frameIndices:[0,0,0]};
 const atlas={version:3,width:64,height:64,sprites:{one:sprite,two:{...sprite,frames:[region,{...region,x:8}]}},animalClips:{walk:{parts:['one','two'],frames:3}},spacecraftParts:{ship:['two']},zenParts:{pond:['one']},volcanoLava:[{test:'retained'}],stats:{frames:6,uniqueFrames:2,rgbaBytes:16384,occupiedPixels:24}};
 const packed=packRuntimeAtlas(atlas),bytes=gzipSync(JSON.stringify(packed));
 const restored=decodeRuntimeAtlas(JSON.parse(gunzipSync(bytes)));
 assert.deepEqual(restored,atlas);assert.equal(restored.sprites.one.frames[0],restored.sprites.two.frames[0]);assert.equal(packed.regions.length,8);
 const browser=await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).json();assert.deepEqual(decodeRuntimeAtlas(browser),atlas);
 const corrupt=structuredClone(packed);corrupt.sprites[0][5]=[99];assert.throws(()=>decodeRuntimeAtlas(corrupt),/Invalid atlas region/);
 assert.throws(()=>decodeRuntimeAtlas({...packed,format:'future'}),/Unsupported/);
});

test('offline animal frame caches invalidate on source keys and corrupted payloads',async t=>{
 const root=await mkdtemp(join(tmpdir(),'jungle-frames-'));t.after(()=>rm(root,{recursive:true,force:true}));let calls=0;
 const make=()=>{calls++;return[{id:'rig',anchor:[1,1],frames:[{width:1,height:1,data:new Uint8Array([1,2,3,255])}]}];};
 const a=await cachedAnimalFrames(root,'rig','source-a',make),b=await cachedAnimalFrames(root,'rig','source-a',make);assert.deepEqual(a,b);assert.equal(calls,1);
 await cachedAnimalFrames(root,'rig','source-b',make);assert.equal(calls,2);
 await writeFile(join(root,'rig.bin'),'truncated');assert.deepEqual(await cachedAnimalFrames(root,'rig','source-b',make),a);assert.equal(calls,3);
});

test('a clean checkout restores inspectable atlas JSON and rejects corrupt retained artifacts',async t=>{
 const { mkdir,readFile }=await import('node:fs/promises'),{createHash}=await import('node:crypto');
 const {restoreAtlasManifest}=await import('../scripts/atlas-artifact.ts');
 const root=await mkdtemp(join(tmpdir(),'jungle-atlas-'));t.after(()=>rm(root,{recursive:true,force:true}));
 await mkdir(join(root,'assets'));const json=Buffer.from('{"sprites":{}}\n'),archive=gzipSync(json),hash=b=>createHash('sha256').update(b).digest('hex');
 await writeFile(join(root,'assets/jungle-manifest.json.gz'),archive);
 assert.deepEqual(await restoreAtlasManifest(root,hash(archive),hash(json)),json);
 assert.deepEqual(await readFile(join(root,'public/assets/jungle.json')),json);
 await writeFile(join(root,'assets/jungle-manifest.json.gz'),'corrupt');
 await assert.rejects(()=>restoreAtlasManifest(root,hash(archive),hash(json)),/archive hash mismatch/);
});
