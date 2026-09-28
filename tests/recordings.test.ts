import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { decodePcmWav, Soundscape } from '../src/audio';
import { CONFIG } from '../src/config';
import { InfiniteWorld } from '../src/jungle/infinite';
import { jungleSound } from '../src/jungle/sound';

test('bundled elephant recording has retained provenance, valid bounded PCM and gentle endpoints',async()=>{
  const meta=JSON.parse(await readFile('assets/source/audio/provenance.json','utf8'));
  for(const [file,hash] of [['assets/source/audio/elephant-trumpet.ogg',meta.sourceSha256],['public/assets/audio/elephant-trumpet.wav',meta.derivedSha256]]){
    assert.equal(createHash('sha256').update(await readFile(file)).digest('hex'),hash);
  }
  assert.equal(meta.license,'CC0-1.0');
  const bytes=await readFile('public/assets/audio/elephant-trumpet.wav'),pcm=decodePcmWav(bytes),samples=pcm.channels[0]!;
  assert.equal(pcm.sampleRate,24000);assert.equal(pcm.channels.length,1);assert.ok(samples.length>24000&&samples.length<48000);
  assert.ok(Math.abs(samples[0]!)<.001&&Math.abs(samples.at(-1)!)<.001);
  let peak=0;for(const sample of samples){assert.ok(Number.isFinite(sample));peak=Math.max(peak,Math.abs(sample));}assert.ok(peak>.02&&peak<.6);
  assert.throws(()=>decodePcmWav(bytes.subarray(0,bytes.length-20)),/truncated/i);
  assert.throws(()=>decodePcmWav(new Uint8Array(40)),/Invalid/);
});

test('elephant calls follow nearby elephants, remain infrequent and honor wildlife mute and pause',()=>{
  const world=new InfiniteWorld(),p=world.wildlifeLandmark('elephant');world.ensure({minX:p.x-2,minY:p.y-2,maxX:p.x+2,maxY:p.y+2});
  const scene=jungleSound(world,p.x,p.y);assert.ok(scene.emitters.some(a=>a.call==='elephant'));
  const elephant=scene.emitters.find(a=>a.call==='elephant')!;
  const nearby={...scene,canopy:0,emitters:[elephant]},planner=new Soundscape({...CONFIG.audio,chorus:false});
  let calls=0,last=-Infinity;
  for(let i=0;i<1800;i++)for(const event of planner.update(nearby,.1,CONFIG.audio.levels).events)if(event.kind==='elephant'){
    assert.ok(i*.1-last>=17.9);last=i*.1;calls++;assert.ok(event.rate>=.92&&event.rate<=1.08);
  }
  assert.ok(calls>=4&&calls<=11);
  for(let i=0;i<1000;i++)assert.equal(planner.update(nearby,.1,CONFIG.audio.levels,false).events.length,0);
  for(let i=0;i<1000;i++)assert.equal(planner.update(nearby,.1,{...CONFIG.audio.levels,wildlife:0}).events.length,0);
  const disabled=new Soundscape({...CONFIG.audio,chorus:false,sounds:{...CONFIG.audio.sounds,elephant:{...CONFIG.audio.sounds.elephant,enabled:false}}});
  for(let i=0;i<1000;i++)assert.equal(disabled.update(nearby,.1).events.filter(e=>e.kind==='elephant').length,0);
});
