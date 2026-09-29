import test from 'node:test';
import assert from 'node:assert/strict';
import {bakeLandscapeAccents} from '../scripts/art/landscape-accents';
import {accentRustlePose} from '../scripts/art/accent-rustle';
import {ACCENT_FORMS,ACCENT_FRAMES} from '../src/jungle/accents';

test('every accent rustles locally with fixed roots, clean margins and an exact looping source pose',async()=>{
 const sprites=await bakeLandscapeAccents();
 for(const [variant,name] of ACCENT_FORMS.entries()){
  const sprite=sprites.find(s=>s.id===`accent-${name}`)!;assert.equal(sprite.frames.length,ACCENT_FRAMES);
  const first=sprite.frames[0]!,unique=new Set(sprite.frames.map(f=>Buffer.from(f.data).toString('base64')));
  assert.ok(unique.size>=6,`${name}: ${unique.size} unique poses`);
  assert.deepEqual(accentRustlePose(first,1,variant),first);
  for(const frame of sprite.frames){
   assert.deepEqual(frame.data.subarray((first.height-4)*first.width*4),first.data.subarray((first.height-4)*first.width*4),`${name} root motion`);
   for(let y=0;y<frame.height;y++)for(const x of [0,frame.width-1])assert.equal(frame.data[(y*frame.width+x)*4+3],0,`${name} side gutter`);
   for(let x=0;x<frame.width;x++)assert.equal(frame.data[x*4+3],0,`${name} upper gutter`);
  }
 }
});
