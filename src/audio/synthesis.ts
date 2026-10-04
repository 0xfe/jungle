/** Pure PCM synthesis: usable in Node, a worker, Web Audio or an offline exporter. */
export const BIRD_KINDS=['bird','trill','warble','woodpecker','chatter','gull'] as const;
export type BirdKind=typeof BIRD_KINDS[number];
export type SoundKind='leaves'|'water'|'rain'|'insects'|'step'|'hover'|'alien'|'zen'|BirdKind;
/** Shared controls for every sound; values in src/config.ts are the application's defaults. */
export interface SoundTuning {
 /** False removes this sound from playback and the browser's buffer bank. */
 enabled:boolean;
 /** Linear volume multiplier (0 silences it, 1 preserves the authored level). */
 gain:number;
 /** Playback speed multiplier; changes both pitch and duration (1 is normal). */
 speed:number;
 /** Synthesized length in seconds; looping beds must exceed the 0.5-second crossfade. */
 duration:number;
 /** Pitch/brightness multiplier independent of clip length; positive, 1 is authored pitch. */
 pitch:number;
 /** Internal pulse/gust/modulation speed multiplier; positive, 1 is authored rhythm. */
 rhythm:number;
 /** Noise/rasp multiplier; 0 removes noise, 1 preserves it; tonal-only sounds ignore this. */
 texture:number;
 /** Bird call-gap multiplier; >1 is less frequent. Also scales step spacing; beds ignore it. */
 intervalScale:number;
}
export interface SoundBuffer { sampleRate:number; channels:Float32Array[]; loop:boolean }
export function synthesize(kind:SoundKind, sampleRate=24000, seed=123, tuning:Partial<SoundTuning>={}):SoundBuffer {
 // This low-register bed needs no ultrasonic bandwidth; share compact PCM everywhere.
 if(kind==='zen')sampleRate=Math.min(sampleRate,8000);
 const loop=['leaves','water','rain','insects','hover','zen'].includes(kind);
 const durations:Record<string,number>={step:.22,bird:1.25,trill:1.8,warble:2.1,woodpecker:1.4,chatter:1.35,gull:1.7,alien:.85};
 const seconds=tuning.duration??(kind==='zen'?6:kind==='hover'?1.5:loop?11:durations[kind]!),pitch=tuning.pitch??1,rhythm=tuning.rhythm??1,texture=tuning.texture??1;
 if(!Number.isFinite(seconds)||seconds<=(loop?.5:0)||!Number.isFinite(pitch)||pitch<=0||!Number.isFinite(rhythm)||rhythm<=0||!Number.isFinite(texture)||texture<0)throw new Error(`Invalid sound tuning: ${kind}`);
 const length=Math.round(seconds*sampleRate),channels:Float32Array[]=[];
 for(let channel=0;channel<(kind==='zen'?1:2);channel++){
  let state=(seed+channel*7591)>>>0,low=0,mid=0,phase=0,whistle=0;
  const samples=new Float32Array(length);
  for(let i=0;i<length;i++){
   state=(Math.imul(state,1664525)+1013904223)>>>0;const noise=(state/2147483648-1)*texture,t=i/sampleRate,rt=t*rhythm;
   low+=(noise-low)*Math.min(1,.013*pitch);mid+=(noise-mid)*Math.min(1,.16*pitch);
   const slow=.65+.2*Math.sin(rt*Math.PI*2/seconds*3+channel)+.15*Math.sin(rt*Math.PI*2/seconds*7);
   let value=0;
   if(kind==='leaves')value=(mid-low)*.7*slow+low*.35;
   if(kind==='water')value=low*1.5*slow+(noise-mid)*.04;
   if(kind==='rain')value=(mid*.55+noise*.14)*(.8+.2*Math.sin(rt*Math.PI*2/seconds*2));
   if(kind==='insects')value=Math.sin(t*Math.PI*2*3600*pitch)*Math.pow(Math.max(0,Math.sin(rt*Math.PI*2*2)),12)*.025;
   if(kind==='step'){const envelope=Math.sin(Math.PI*t/seconds)**2*Math.exp(-rt*22);value=(low*4+mid)*envelope;}
   const envelope=Math.sin(Math.PI*t/seconds)**2;
   if(kind==='bird'){
    const syllable=Math.max(0,Math.sin(rt/seconds*Math.PI*5))**2;
    phase+=Math.PI*2*(1600+850*Math.sin(rt*12)+channel*8)*pitch/sampleRate;
    value=(Math.sin(phase)+.12*Math.sin(phase*2))*syllable*envelope*.21;
   }
   if(kind==='trill'){
    phase+=Math.PI*2*(2600+380*Math.sin(rt*31)+250*t)*pitch/sampleRate;
    value=Math.sin(phase)*(.3+.7*Math.max(0,Math.sin(rt*87))) *envelope*.17;
   }
   if(kind==='warble'){
    phase+=Math.PI*2*(1000+380*Math.sin(rt*9)+160*Math.sin(rt*29))*pitch/sampleRate;
    value=(Math.sin(phase)+.18*Math.sin(phase*2))*(.45+.55*Math.sin(rt*13)**2)*envelope*.21;
   }
   if(kind==='woodpecker'){
    // Accelerating, then relaxing wooden taps; damped resonances plus a noisy attack.
    const clock=rt*15+1.1*Math.sin(rt*2),tap=clock%1;
    const decay=Math.exp(-tap*16),attack=Math.min(1,tap*70);
    value=(Math.sin(t*2*Math.PI*760*pitch)*.28+Math.sin(t*2*Math.PI*1280*pitch)*.12+noise*.24)*decay*attack*envelope;
   }
   if(kind==='chatter'){
    phase+=Math.PI*2*(1250+500*Math.sin(rt*42))*pitch/sampleRate;
    value=(Math.sin(phase)*.16+(noise-mid)*.09)*Math.max(0,Math.sin(rt*35))**2*envelope;
   }
   // A breathing pentatonic flute phrase over a gently decaying bowl.
   if(kind==='zen'){
    const notes=[261.626,293.665,329.628,391.995,440],note=notes[Math.floor(rt/1.1)%notes.length]!;
    phase+=Math.PI*2*note*pitch/sampleRate;
    const breath=Math.sin((rt%1.1)/1.1*Math.PI)**2;
    const bowlAge=rt%7.7,bowl=Math.exp(-bowlAge*.8)*(1-Math.exp(-bowlAge*30));
    value=(Math.sin(phase)*.075+Math.sin(phase*2)*.015+mid*.012*texture)*breath
      +(Math.sin(t*2*Math.PI*196*pitch)+.35*Math.sin(t*2*Math.PI*523*pitch))*.055*bowl;
   }
   // Soft propulsion harmonics with a fast, shallow beating texture, never a siren.
   if(kind==='hover'){
    phase+=Math.PI*2*(145+2*Math.sin(rt*6))*pitch/sampleRate;
    whistle+=Math.PI*2*(1080+45*Math.sin(rt*3))*pitch/sampleRate;
    value=Math.sin(whistle)*.025+(Math.sin(phase)*.10+Math.sin(phase*2.01)*.035+Math.sin(phase*3)*.012+low*.045)*(.88+.12*Math.sin(rt*54));
   }
   // Short conversational syllables with formant-like harmonics and tiny noisy consonants.
   if(kind==='alien'){
    const syllable=Math.max(0,Math.sin(rt*29+.3*Math.sin(rt*11)))**2;
    phase+=Math.PI*2*(430+150*Math.sin(rt*18)+55*Math.sin(rt*43))*pitch/sampleRate;
    value=(Math.sin(phase)*.12+Math.sin(phase*2.7)*.055+mid*.1)*syllable*envelope;
   }
   if(kind==='gull'){
    phase+=Math.PI*2*(650+500*Math.sin(t/seconds*Math.PI)+85*Math.sin(rt*24))*pitch/sampleRate;
    value=(Math.sin(phase)*.18+Math.sin(phase*2)*.06+mid*.12)*envelope*(.4+.6*Math.sin(rt*7)**2);
   }
   samples[i]=value;
  }
  if(loop){
   // Equal-power overlap joins independent noise ends without a silent notch.
   const overlap=Math.round(.5*sampleRate),n=length-overlap,out=new Float32Array(n);
   out.set(samples.subarray(0,n));
   for(let i=0;i<overlap;i++){const p=i/overlap*Math.PI/2;out[i]=samples[n+i]!*Math.cos(p)+samples[i]!*Math.sin(p);}
   channels.push(out);
  }else{samples[0]=samples[length-1]=0;channels.push(samples);}
 }
 return {sampleRate,channels,loop};
}
