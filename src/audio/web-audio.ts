import { BED_KINDS, SOUND_KINDS, type AudioSink, type BedKind, type AudioKind, type SoundFrame } from './mixer';
import { synthesize, type SoundBuffer, type SoundTuning, type SoundKind } from './synthesis';
export interface WebAudioOptions {
 sampleRate?:number;seed?:number;maxVoices?:number;masterFade?:number;environmentFade?:number;
 sounds?:Partial<Record<AudioKind,SoundTuning>>;
 /** Shared decoded recordings supplied by the application, independent of synthetic layers. */
 recordings?:Partial<Record<AudioKind,SoundBuffer>>;
}
/** Lazy browser adapter. One context, shared buffers, six beds and at most twelve effects. */
export class WebAudioSink implements AudioSink {
 private context?:AudioContext;private master?:GainNode;private compressor?:DynamicsCompressorNode;
 private buffers=new Map<AudioKind,AudioBuffer>();private beds=new Map<BedKind,{source:AudioBufferSourceNode;gain:GainNode;pan?:StereoPannerNode}>();
 private voices=new Set<AudioBufferSourceNode>();private last?:SoundFrame;
 get maxVoices(){return this.options.maxVoices??12;}
 constructor(private createContext:()=>AudioContext=()=>new AudioContext(),private readonly options:WebAudioOptions={}){}
 async enable():Promise<void>{
   for(const kind of ['elephant','tiger'] as const)if(this.options.sounds?.[kind]?.enabled&&!this.options.recordings?.[kind])throw new Error(`Missing ${kind} PCM recording; rebuild the audio assets`);
  if(!this.context){
   const c=this.context=this.createContext(),master=this.master=c.createGain(),compressor=this.compressor=c.createDynamicsCompressor();
   master.gain.value=0;compressor.threshold.value=-16;compressor.knee.value=12;compressor.ratio.value=6;compressor.attack.value=.008;compressor.release.value=.3;
   master.connect(compressor);compressor.connect(c.destination);
   for(const kind of new Set<AudioKind>([...SOUND_KINDS,...Object.keys(this.options.recordings??{}) as AudioKind[]])){const tuning=this.options.sounds?.[kind];if(tuning?.enabled===false)continue;const pcm=this.options.recordings?.[kind]??synthesize(kind as SoundKind,this.options.sampleRate,this.options.seed,tuning);const buffer=c.createBuffer(pcm.channels.length,pcm.channels[0]!.length,pcm.sampleRate);pcm.channels.forEach((v,i)=>buffer.copyToChannel(v as Float32Array<ArrayBuffer>,i));this.buffers.set(kind,buffer);}
   for(const kind of BED_KINDS){if(!this.buffers.has(kind))continue;const source=c.createBufferSource(),gain=c.createGain();source.buffer=this.buffers.get(kind)!;source.loop=true;source.playbackRate.value=this.options.sounds?.[kind]?.speed??1;gain.gain.value=0;source.connect(gain);const pan=kind==='hover'?c.createStereoPanner():undefined;if(pan){gain.connect(pan);pan.connect(master);}else gain.connect(master);source.start();this.beds.set(kind,{source,gain,pan});}
  }
  await this.context.resume();
 }
 apply(frame:SoundFrame):void {
  const c=this.context;if(!c||!this.master)return;
  // Audio-clock smoothing prevents clicks, including mute, pause and weather changes.
  if(this.last?.master!==frame.master)this.master.gain.setTargetAtTime(frame.master,c.currentTime,this.options.masterFade??.12);
  for(const [kind,{gain}] of this.beds)if(this.last?.beds[kind]!==frame.beds[kind])gain.gain.setTargetAtTime(frame.beds[kind]*(this.options.sounds?.[kind]?.gain??1),c.currentTime,kind==='hover'?.12:this.options.environmentFade??.8);
  const hover=this.beds.get('hover');if(hover?.pan&&this.last?.hoverPan!==frame.hoverPan)hover.pan.pan.setTargetAtTime(frame.hoverPan??0,c.currentTime,.12);
  for(const event of c.state==='running'?frame.events:[]){if(!this.buffers.has(event.kind))continue;if(this.voices.size>=this.maxVoices||frame.master===0)break;
   const source=c.createBufferSource(),gain=c.createGain(),pan=c.createStereoPanner();source.buffer=this.buffers.get(event.kind)!;source.playbackRate.value=event.rate*(this.options.sounds?.[event.kind]?.speed??1);gain.gain.value=event.gain*(this.options.sounds?.[event.kind]?.gain??1);pan.pan.value=event.pan;
   source.connect(gain);gain.connect(pan);pan.connect(this.master);this.voices.add(source);
   source.onended=()=>{source.disconnect();gain.disconnect();pan.disconnect();this.voices.delete(source);};source.start();
  }
  this.last=frame;
 }
 get state(){return this.context?.state??'off';}
 get voiceCount(){return this.voices.size;}
 get bytes(){let bytes=0;for(const b of this.buffers.values())bytes+=b.length*b.numberOfChannels*4;return bytes;}
 dispose(){for(const s of this.voices)s.stop();for(const b of this.beds.values()){b.source.stop();b.source.disconnect();b.gain.disconnect();b.pan?.disconnect();}this.voices.clear();this.beds.clear();this.buffers.clear();this.master?.disconnect();this.compressor?.disconnect();void this.context?.close();this.context=undefined;this.last=undefined;}
}
