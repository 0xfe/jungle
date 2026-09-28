/** Pure PCM synthesis: usable in Node, a worker, Web Audio or an offline exporter. */
export type SoundKind='leaves'|'water'|'rain'|'insects'|'step'|'bird';
export interface SoundBuffer { sampleRate:number; channels:Float32Array[]; loop:boolean }
export function synthesize(kind:SoundKind, sampleRate=24000, seed=123):SoundBuffer {
 const loop=!['step','bird'].includes(kind),seconds=loop?12:kind==='step'?.22:.65;
 const length=Math.round(seconds*sampleRate),channels:Float32Array[]=[];
 for(let channel=0;channel<2;channel++){
  let state=(seed+channel*7591)>>>0,low=0,mid=0,phase=0;
  const samples=new Float32Array(length);
  for(let i=0;i<length;i++){
   state=(Math.imul(state,1664525)+1013904223)>>>0;const noise=state/2147483648-1,t=i/sampleRate;
   low+=(noise-low)*.013;mid+=(noise-mid)*.16;
   const slow=.65+.2*Math.sin(t*Math.PI*2/seconds*3+channel)+.15*Math.sin(t*Math.PI*2/seconds*7);
   let value=0;
   if(kind==='leaves')value=(mid-low)*.7*slow+low*.35;
   if(kind==='water')value=low*1.5*slow+(noise-mid)*.04;
   if(kind==='rain')value=(mid*.55+noise*.14)*(.8+.2*Math.sin(t*Math.PI*2/seconds*2));
   if(kind==='insects')value=Math.sin(t*Math.PI*2*3600)*Math.pow(Math.max(0,Math.sin(t*Math.PI*2*2)),12)*.025;
   if(kind==='step'){const envelope=Math.sin(Math.PI*t/seconds)**2*Math.exp(-t*22);value=(low*4+mid)*envelope;}
   if(kind==='bird'){
    const pulse=Math.max(0,Math.sin(t/seconds*Math.PI*3))**3,envelope=Math.sin(Math.PI*t/seconds)**2;
    phase+=Math.PI*2*(1700+650*Math.sin(t*17)+channel*12)/sampleRate;value=Math.sin(phase)*pulse*envelope*.18;
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
