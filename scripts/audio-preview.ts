import { CONFIG } from '../src/config';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {synthesize,SOUND_KINDS,Soundscape,type AudioKind,decodePcmWav,type SoundBuffer} from '../src/audio';
function wav(pcm:SoundBuffer):Buffer{
 const channels=pcm.channels.length,length=pcm.channels[0]!.length,bytes=length*channels*2,b=Buffer.alloc(44+bytes);
 b.write('RIFF');b.writeUInt32LE(36+bytes,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(channels,22);b.writeUInt32LE(pcm.sampleRate,24);b.writeUInt32LE(pcm.sampleRate*channels*2,28);b.writeUInt16LE(channels*2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(bytes,40);
 for(let i=0;i<length;i++)for(let c=0;c<channels;c++)b.writeInt16LE(Math.round(Math.max(-1,Math.min(1,pcm.channels[c]![i]!))*32767),44+(i*channels+c)*2);
 return b;
}
await mkdir('artifacts/audio',{recursive:true});
for(const kind of SOUND_KINDS)await writeFile(`artifacts/audio/${kind}.wav`,wav(synthesize(kind,CONFIG.audio.sampleRate,CONFIG.audio.seed,CONFIG.audio.sounds[kind])));
console.log('Deterministic WAV previews → artifacts/audio/');

// A 30-second layered audition, including independent callers and default levels.
const rate=CONFIG.audio.sampleRate,block=Math.round(rate*.1),length=rate*30,channels=[new Float32Array(length),new Float32Array(length)];
const bank=new Map<AudioKind,SoundBuffer>(SOUND_KINDS.map(kind=>[kind,synthesize(kind,rate,CONFIG.audio.seed,CONFIG.audio.sounds[kind])])),planner=new Soundscape(CONFIG.audio);
const elephant=decodePcmWav(await readFile('public/assets/audio/elephant-trumpet.wav'));
bank.set('elephant',elephant);await writeFile('artifacts/audio/elephant.wav',wav(elephant));
const scene={x:0,y:0,canopy:.7,water:.2,rain:0,night:0,emitters:[
 {id:'elephant-preview',x:2,y:1,speed:0,phase:0,bird:false,call:'elephant' as const},
 {id:'parakeet-preview',x:1,y:0,speed:0,phase:0,bird:true,call:'trill' as const},
 {id:'toucan-preview',x:-1,y:1,speed:0,phase:0,bird:true,call:'bird' as const},
]};
for(let tick=0;tick<300;tick++){
 const frame=planner.update(scene,.1,CONFIG.audio.levels);
 for(const [kind,gain] of Object.entries(frame.beds)){const voice=CONFIG.audio.sounds[kind as typeof SOUND_KINDS[number]];if(!voice.enabled)continue;const pcm=bank.get(kind as typeof SOUND_KINDS[number])!;
  for(let i=tick*block;i<(tick+1)*block;i++)for(let c=0;c<2;c++)channels[c]![i]!+=pcm.channels[c%pcm.channels.length]![Math.floor(i*voice.speed*pcm.sampleRate/rate)%pcm.channels[c%pcm.channels.length]!.length]!*gain*voice.gain*frame.master;
 }
 for(const event of frame.events){const voice=CONFIG.audio.sounds[event.kind];if(!voice.enabled)continue;const pcm=bank.get(event.kind)!,start=tick*block,speed=event.rate*voice.speed;
  for(let j=0;j<pcm.channels[0]!.length/speed*rate/pcm.sampleRate&&start+j<length;j++)for(let c=0;c<2;c++){
   const pan=c===0?Math.sqrt((1-event.pan)/2):Math.sqrt((1+event.pan)/2);
   channels[c]![start+j]!+=pcm.channels[c%pcm.channels.length]![Math.min(pcm.channels[0]!.length-1,Math.floor(j*speed*pcm.sampleRate/rate))]!*event.gain*voice.gain*frame.master*pan;
  }
 }
}
// Fade the exported excerpt at both ends; the live planner remains continuous.
for(let i=0;i<length;i++)for(const c of channels)c[i]!*=Math.min(1,i/(rate*.3),(length-1-i)/(rate*.5));
await writeFile('artifacts/audio/forest-chorus.wav',wav({sampleRate:rate,channels,loop:false}));
