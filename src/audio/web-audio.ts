import { BED_KINDS, SOUND_KINDS, type AudioSink, type BedKind, type SoundFrame } from './mixer';
import { synthesize, type SoundKind } from './synthesis';
/** Lazy browser adapter. One context, shared buffers, four beds and at most twelve effects. */
export class WebAudioSink implements AudioSink {
 private context?:AudioContext;private master?:GainNode;private compressor?:DynamicsCompressorNode;
 private buffers=new Map<SoundKind,AudioBuffer>();private beds=new Map<BedKind,{source:AudioBufferSourceNode;gain:GainNode}>();
 private voices=new Set<AudioBufferSourceNode>();private last?:SoundFrame;
 readonly maxVoices=12;
 constructor(private createContext:()=>AudioContext=()=>new AudioContext()){}
 async enable():Promise<void>{
  if(!this.context){
   const c=this.context=this.createContext(),master=this.master=c.createGain(),compressor=this.compressor=c.createDynamicsCompressor();
   master.gain.value=0;compressor.threshold.value=-16;compressor.knee.value=12;compressor.ratio.value=6;compressor.attack.value=.008;compressor.release.value=.3;
   master.connect(compressor);compressor.connect(c.destination);
   for(const kind of SOUND_KINDS){const pcm=synthesize(kind);const buffer=c.createBuffer(2,pcm.channels[0]!.length,pcm.sampleRate);pcm.channels.forEach((v,i)=>buffer.copyToChannel(v as Float32Array<ArrayBuffer>,i));this.buffers.set(kind,buffer);}
   for(const kind of BED_KINDS){const source=c.createBufferSource(),gain=c.createGain();source.buffer=this.buffers.get(kind)!;source.loop=true;gain.gain.value=0;source.connect(gain);gain.connect(master);source.start();this.beds.set(kind,{source,gain});}
  }
  await this.context.resume();
 }
 apply(frame:SoundFrame):void {
  const c=this.context;if(!c||!this.master)return;
  // Audio-clock smoothing prevents clicks, including mute, pause and weather changes.
  if(this.last?.master!==frame.master)this.master.gain.setTargetAtTime(frame.master,c.currentTime,.12);
  for(const [kind,{gain}] of this.beds)if(this.last?.beds[kind]!==frame.beds[kind])gain.gain.setTargetAtTime(frame.beds[kind],c.currentTime,.8);
  for(const event of frame.events){if(this.voices.size>=this.maxVoices||frame.master===0)break;
   const source=c.createBufferSource(),gain=c.createGain(),pan=c.createStereoPanner();source.buffer=this.buffers.get(event.kind)!;source.playbackRate.value=event.rate;gain.gain.value=event.gain;pan.pan.value=event.pan;
   source.connect(gain);gain.connect(pan);pan.connect(this.master);this.voices.add(source);
   source.onended=()=>{source.disconnect();gain.disconnect();pan.disconnect();this.voices.delete(source);};source.start();
  }
  this.last=frame;
 }
 get state(){return this.context?.state??'off';}
 get voiceCount(){return this.voices.size;}
 get bytes(){let bytes=0;for(const b of this.buffers.values())bytes+=b.length*b.numberOfChannels*4;return bytes;}
 dispose(){for(const s of this.voices)s.stop();for(const b of this.beds.values()){b.source.stop();b.source.disconnect();b.gain.disconnect();}this.voices.clear();this.beds.clear();this.buffers.clear();this.master?.disconnect();this.compressor?.disconnect();void this.context?.close();this.context=undefined;this.last=undefined;}
}
