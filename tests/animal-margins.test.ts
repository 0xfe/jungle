import test from 'node:test';
import assert from 'node:assert/strict';
import { ECO_KINDS,ECO_SPECS,ecoClips } from '../src/jungle/ecology';
import { animalForms } from '../src/jungle/animal-appearance';
import { animalOneShot } from '../src/jungle/animal-actions';
import { BEAR_MOTION,BEAR_SETTLE_SAMPLES,bearSettleClip } from '../src/jungle/bear-motion';
import { ecologyMesh } from '../scripts/art/ecology-model';
import { blackBearMesh } from '../scripts/art/black-bear-model';
import { bakeMesh } from '../src/iso/bake/rasterize';

test('every ecological form and authored pose has margins at all possible headings',()=>{
 for(const kind of ECO_KINDS)for(const form of animalForms(kind))for(const [clip,count] of Object.entries(ecoClips(kind))){
  const scale=kind==='blackBear'?BEAR_MOTION.bakeScale:kind==='elephant'?17.5:ECO_SPECS[kind].cameraScale;
  for(let i=0;i<count;i++){
   const mesh=ecologyMesh(kind,clip,i/(animalOneShot(kind,clip)?count-1:count),form);
   let left=Infinity,right=-Infinity,top=Infinity,bottom=-Infinity;
   // A rotated point has horizontal radius r and vertical radius r/2 in this camera.
   // These analytic extrema cover every angle, including between quantized headings.
   for(const tri of mesh)for(const v of tri.vertices){const [x,y,z]=v.position,r=Math.hypot(x,y)*scale,cy=87-z*Math.sqrt(.75)*scale;left=Math.min(left,56-r);right=Math.max(right,56+r);top=Math.min(top,cy-r/2);bottom=Math.max(bottom,cy+r/2);}
   assert.ok(left>1&&right<111&&top>1&&bottom<111,`${kind}/${form}/${clip}/${i}: ${[left,right,top,bottom]}`);
  }
 }
});

test('bear stopping clips begin at their sampled stride and finish at planted rest',()=>{
 const camera={width:112,height:112,anchor:[56,87] as [number,number],scale:BEAR_MOTION.bakeScale};
 for(const form of animalForms('blackBear'))for(const run of [false,true])for(let phase=0;phase<BEAR_SETTLE_SAMPLES;phase++)for(const heading of [0,Math.PI*.625,Math.PI*1.4]){
  const name=bearSettleClip(run,phase/BEAR_SETTLE_SAMPLES);
  for(const [p,clip,q] of [[0,run?'run':'travel',phase/BEAR_SETTLE_SAMPLES],[1,'rest',0]] as const){
   assert.deepEqual(bakeMesh(blackBearMesh(name,p,form),heading,camera).data,bakeMesh(blackBearMesh(clip,q,form),heading,camera).data,`${form}/${name}/${p}/${heading}`);
  }
 }
});

test('legacy wildlife and pond forms retain full silhouettes through every action',async()=>{
 const {deerMesh}=await import('../scripts/art/deer-model'),{wildlifeMesh,WILDLIFE_CLIPS}=await import('../scripts/art/wildlife-model'),{zenMesh}=await import('../scripts/art/zen'),{DEER_CLIPS}=await import('../src/jungle/animation');
 for(const kind of ['deer','toucan','orangutan','jaguar','koi','duck','pelican'] as const){
  const pond=['koi','duck','pelican'].includes(kind),width=pond||kind==='deer'?72:80,anchor=pond||kind==='deer'?[36,55]:[40,65],scale=pond?kind==='pelican'?25:23:kind==='deer'?21:kind==='jaguar'?25:28;
  const clips=kind==='deer'?DEER_CLIPS:pond?Object.fromEntries((kind==='koi'?['swim','feed']:kind==='duck'?['swim','dip','preen','walk']:['swim','dip','preen','settle']).map(k=>[k,24])):Object.fromEntries((kind==='toucan'?['rest','travel','takeoff','land','preen','feed']:kind==='orangutan'?['rest','travel','climb','feed','groom']:['rest','travel','chase','stalk','crouch','uncrouch','groom','feed']).map(k=>[k,WILDLIFE_CLIPS[k as keyof typeof WILDLIFE_CLIPS]]));
  for(const form of [0,1,2])for(const [clip,count] of Object.entries(clips))for(let i=0;i<count;i++){
   const p=i/(animalOneShot(kind,clip)||['dip','preen','feed','settle'].includes(clip)?count-1:count);
   const mesh=kind==='deer'?deerMesh(clip as 'walk',p,form):pond?zenMesh(kind as 'koi',clip,p,form):wildlifeMesh(kind as 'toucan',clip as 'feed',p,form);
   let margin=Infinity;
   for(const tri of mesh)for(const v of tri.vertices){const [x,y,z]=v.position,r=Math.hypot(x,y)*scale,cy=anchor[1]!-z*Math.sqrt(.75)*scale;margin=Math.min(margin,anchor[0]!-r,width-anchor[0]!-r,cy-r/2,width-cy-r/2);}
   assert.ok(margin>1,`${kind}/${form}/${clip}/${i}: ${margin}`);
  }
 }
});
