import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../src/config';
import { InfiniteWorld,faunaPlan } from '../src/jungle/infinite';
import { journeyDensity } from '../src/jungle/journey';
import { DEFAULT_SETTINGS } from '../src/jungle/settings';
import { Soundscape, synthesize } from '../src/audio';

test('application defaults feed the world and tuning probabilities changes actual generation plans',()=>{
 const w=new InfiniteWorld();assert.equal(w.seed,CONFIG.startup.seed);assert.equal(w.habitat,CONFIG.startup.habitat);assert.equal(w.weather,CONFIG.startup.weather);
 assert.deepEqual(w.settings,DEFAULT_SETTINGS);assert.deepEqual(w.cache.budget,CONFIG.world.cache);
 const p=CONFIG.world.population,old=p.deer,opening=CONFIG.world.opening,oldPlants=opening.plants;
 try{
  p.deer=0;for(let i=0;i<100;i++)assert.equal(faunaPlan(i,-i,w.seed).deer,false);
  p.deer=1;for(let i=0;i<100;i++)assert.equal(faunaPlan(i,-i,w.seed,1).deer,true);
  opening.plants=.5;assert.equal(journeyDensity(w.origin.x,w.origin.y,w.origin).plants,.5);
 }finally{p.deer=old;opening.plants=oldPlants;}
});

test('configured mix removes warble even when an emitter requests it; individual mute and chorus options work',()=>{
 const sound=new Soundscape(CONFIG.audio),scene={x:0,y:0,water:0,rain:0,canopy:1,night:0,emitters:[{id:'warbler',x:0,y:0,bird:true,call:'warble' as const,phase:0,speed:0}]};
 let calls=0;for(let i=0;i<600;i++){const f=sound.update(scene,.1,CONFIG.audio.levels);for(const e of f.events){assert.notEqual(e.kind,'warble');calls++;}}
 assert.ok(calls>10);
 const disabled=Object.fromEntries(Object.entries(CONFIG.audio.sounds).map(([kind,v])=>[kind,{...v,enabled:false}]));
 const quiet=new Soundscape({...CONFIG.audio,chorus:false,sounds:disabled});
 for(let i=0;i<100;i++)assert.deepEqual(quiet.update(scene,.1).events,[]);
});

test('sound synthesis exposes independent length, pitch, rhythm and texture controls',()=>{
 const base=synthesize('bird',8000,123),long=synthesize('bird',8000,123,{duration:2});
 assert.equal(long.channels[0]!.length,16000);
 for(const tuning of [{pitch:1.4},{rhythm:1.4}]){const tuned=synthesize('bird',8000,123,tuning);assert.equal(tuned.channels[0]!.length,base.channels[0]!.length);assert.notDeepEqual(tuned.channels,base.channels);}
 const silentNoise=synthesize('rain',8000,123,{texture:0});assert.ok(silentNoise.channels.every(c=>c.every(n=>n===0)));
 assert.throws(()=>synthesize('leaves',8000,123,{duration:.2}),/Invalid sound tuning/);
});

test('browser sound options control buffer omission, gains, playback speed and polyphony',async()=>{
 const {WebAudioSink}=await import('../src/audio/web-audio');
 const parameters:{value:number;setTargetAtTime:(n:number)=>void}[]=[];
 const param=()=>{const p={value:0,setTargetAtTime(n:number){this.value=n;}};parameters.push(p);return p;};
 const node=()=>({connect(){},disconnect(){}});
 const sources:{playbackRate:ReturnType<typeof param>;buffer?:unknown;onended?:()=>void;start:()=>void;stop:()=>void}[]=[];
 let buffers=0;
 const context={currentTime:0,state:'running',destination:{},resume:async()=>{},close:async()=>{},
  createGain:()=>({...node(),gain:param()}),createStereoPanner:()=>({...node(),pan:param()}),
  createDynamicsCompressor:()=>({...node(),threshold:param(),knee:param(),ratio:param(),attack:param(),release:param()}),
  createBuffer:(numberOfChannels:number,length:number)=>{buffers++;return{numberOfChannels,length,copyToChannel(){}};},
  createBufferSource:()=>{const s={...node(),playbackRate:param(),onended:undefined as undefined|(()=>void),start(){},stop(){this.onended?.();}};sources.push(s);return s;}};
 const sink=new WebAudioSink(()=>context as unknown as AudioContext,{...CONFIG.audio,maxVoices:2,sampleRate:8000,recordings:{tiger:{sampleRate:8000,channels:[new Float32Array(8)],loop:false},elephant:{sampleRate:8000,channels:[new Float32Array(8)],loop:false}},sounds:{...CONFIG.audio.sounds,step:{...CONFIG.audio.sounds.step,gain:.25,speed:1.5}}});
 await sink.enable();assert.equal(buffers,15);assert.equal(sources.length,6);
 sink.apply({master:.5,beds:{leaves:0,water:0,rain:0,insects:0,hover:0,zen:0},events:[{kind:'warble',gain:1,rate:1,pan:0},...Array.from({length:4},()=>({kind:'step' as const,gain:.8,rate:1,pan:0}))]});
 assert.equal(sink.voiceCount,2);assert.equal(sources.length,8);assert.equal(sources.at(-1)!.playbackRate.value,1.5);assert.ok(parameters.some(p=>p.value===.2));sink.dispose();
});
