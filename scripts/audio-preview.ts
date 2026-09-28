import {mkdir,writeFile} from 'node:fs/promises';
import {synthesize,SOUND_KINDS,type SoundBuffer} from '../src/audio';
function wav(pcm:SoundBuffer):Buffer{
 const channels=pcm.channels.length,length=pcm.channels[0]!.length,bytes=length*channels*2,b=Buffer.alloc(44+bytes);
 b.write('RIFF');b.writeUInt32LE(36+bytes,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(channels,22);b.writeUInt32LE(pcm.sampleRate,24);b.writeUInt32LE(pcm.sampleRate*channels*2,28);b.writeUInt16LE(channels*2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(bytes,40);
 for(let i=0;i<length;i++)for(let c=0;c<channels;c++)b.writeInt16LE(Math.round(Math.max(-1,Math.min(1,pcm.channels[c]![i]!))*32767),44+(i*channels+c)*2);
 return b;
}
await mkdir('artifacts/audio',{recursive:true});
for(const kind of SOUND_KINDS)await writeFile(`artifacts/audio/${kind}.wav`,wav(synthesize(kind)));
console.log('Deterministic stereo WAV previews → artifacts/audio/');
