import type { SoundBuffer } from './synthesis';

/** Decode committed PCM16 WAVs in Node or a browser; no platform decoder or runtime codec. */
export function decodePcmWav(bytes:Uint8Array):SoundBuffer {
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  const tag=(offset:number)=>String.fromCharCode(...bytes.subarray(offset,offset+4));
  if(bytes.length<12||tag(0)!=='RIFF'||tag(8)!=='WAVE'||view.getUint32(4,true)+8>bytes.length)throw new Error('Invalid or truncated PCM WAV');
  let channels=0,rate=0,offset=0,length=0;
  for(let p=12;p+8<=bytes.length;){
    const size=view.getUint32(p+4,true),start=p+8;
    if(start+size>bytes.length)throw new Error('Truncated WAV chunk');
    if(tag(p)==='fmt '){
      if(size<16||view.getUint16(start,true)!==1||view.getUint16(start+14,true)!==16)throw new Error('Expected PCM16 WAV');
      channels=view.getUint16(start+2,true);rate=view.getUint32(start+4,true);
      if(channels<1||channels>2||rate<8000||rate>96000||view.getUint16(start+12,true)!==channels*2)throw new Error('Unsupported PCM WAV format');
    }else if(tag(p)==='data'){offset=start;length=size;}
    p=start+size+(size%2);
  }
  if(!channels||!length||length%(channels*2))throw new Error('Missing or invalid PCM WAV data');
  const samples=length/(channels*2),output=Array.from({length:channels},()=>new Float32Array(samples));
  for(let i=0;i<samples;i++)for(let c=0;c<channels;c++)output[c]![i]=view.getInt16(offset+(i*channels+c)*2,true)/32768;
  return {sampleRate:rate,channels:output,loop:false};
}
