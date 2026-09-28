import test from 'node:test';
import assert from 'node:assert/strict';
import {synthesize,Soundscape,MemoryAudioSink,SOUND_KINDS,type SoundScene} from '../src/audio';

test('synthesized layers are deterministic stereo PCM with headroom and continuous loop seams',()=>{
 for(const kind of SOUND_KINDS){const pcm=synthesize(kind),again=synthesize(kind);assert.deepEqual(pcm,again);assert.equal(pcm.channels.length,2);
  for(const samples of pcm.channels){let peak=0,sum=0,energy=0;for(const n of samples){assert.ok(Number.isFinite(n));peak=Math.max(peak,Math.abs(n));sum+=n;energy+=n*n;}
   assert.ok(peak<.8&&energy/samples.length>1e-6,kind);assert.ok(Math.abs(sum/samples.length)<.015,`${kind} DC`);
   if(pcm.loop){const seam=Math.abs(samples[0]!-samples.at(-1)!);let typical=0;for(let i=1;i<1000;i++)typical=Math.max(typical,Math.abs(samples[i]!-samples[i-1]!));assert.ok(seam<=typical*1.5+.005,`${kind} seam`);}
   else assert.equal(samples[0]!+samples.at(-1)!,0);
  }
 }
});
const scene:SoundScene={x:0,y:0,water:0,rain:0,canopy:1,night:0,emitters:[]};
test('weather and proximity layer independently; pause/mute suppress events and history stays bounded',()=>{
 const mixer=new Soundscape(),sink=new MemoryAudioSink();
 const quiet=mixer.update(scene,.1),wet=mixer.update({...scene,rain:1,water:.8,night:1},.1);assert.equal(quiet.beds.leaves,wet.beds.leaves);assert.ok(wet.beds.rain>quiet.beds.rain&&wet.beds.water>quiet.beds.water);
 const a={id:'deer',x:1,y:0,speed:.2,phase:0,bird:false};mixer.update({...scene,emitters:[a]},.2);
 const steps=mixer.update({...scene,emitters:[{...a,phase:1}]},.2);assert.equal(steps.events[0]?.kind,'step');assert.ok(steps.events[0]!.pan>0);
 const pause=mixer.update({...scene,emitters:[{...a,phase:2}]},.3,undefined,false);assert.equal(pause.master,0);assert.equal(pause.events.length,0);
 mixer.update({...scene,emitters:Array.from({length:300},(_,i)=>({...a,id:String(i),x:1}))},.1);assert.equal(mixer.trackedEmitters,32);
 mixer.update(scene,.1);assert.equal(mixer.trackedEmitters,0);sink.apply(wet);assert.deepEqual(sink.frame,wet);sink.dispose();assert.equal(sink.frame,undefined);
});

test('Web Audio adapter starts only on enable, shares loops, ramps gains and caps overlapping effects',async()=>{
 const {WebAudioSink}=await import('../src/audio/web-audio');
 const ramps:number[]=[];let created=0,started=0,closed=0,disconnected=0;
 const sources:{onended?:()=>void;stop:()=>void}[]=[];
 const param=()=>({value:0,setTargetAtTime:(n:number)=>ramps.push(n)});
 const node=()=>({connect:()=>{},disconnect:()=>{disconnected++;}});
 const context={currentTime:10,state:'running',destination:{},resume:async()=>{},close:async()=>{closed++;},
  createGain:()=>({...node(),gain:param()}),createStereoPanner:()=>({...node(),pan:param()}),
  createDynamicsCompressor:()=>({...node(),threshold:param(),knee:param(),ratio:param(),attack:param(),release:param()}),
  createBuffer:(channels:number,length:number)=>({length,numberOfChannels:channels,copyToChannel:()=>{}}),
  createBufferSource:()=>{const s={...node(),playbackRate:param(),onended:undefined as undefined|(()=>void),start:()=>{started++;},stop:()=>s.onended?.()};sources.push(s);return s;}};
 const sink=new WebAudioSink(()=>{created++;return context as unknown as AudioContext;});
 assert.equal(created,0);await sink.enable();await sink.enable();assert.equal(created,1);assert.equal(started,4);
 const mixer=new Soundscape(),frame=mixer.update({...scene,rain:1},.1);frame.events=Array.from({length:40},()=>({kind:'step',gain:.2,pan:0,rate:1}));
 sink.apply(frame);assert.equal(sink.voiceCount,12);assert.equal(started,16);assert.ok(ramps.includes(frame.master)&&ramps.includes(frame.beds.rain));assert.ok(sink.bytes<10*1048576);
 sources[4]!.onended?.();assert.equal(sink.voiceCount,11);sink.apply({...frame,master:0,events:[]});assert.equal(ramps.at(-1),0);
 sink.dispose();assert.equal(closed,1);assert.equal(sink.voiceCount,0);assert.equal(sink.bytes,0);assert.ok(disconnected>12);
});
