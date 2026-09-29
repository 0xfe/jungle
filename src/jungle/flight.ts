import type { FlightProfile } from '../agents/flight';
import type {AgentEnvironment,AgentRandom} from '../agents';
import {CONFIG} from '../config';

export const CANOPY_BIRDS:readonly string[]=['toucan','macaw','parakeet','kingfisher'];
/** Occasional bounded bank-to-bank trip ending at a real dry-land perch.
 * Airborne paths may cross water; landing destinations may not. */
export function crossingPerch(x:number,y:number,env:AgentEnvironment,random:AgentRandom,within:(x:number,y:number)=>boolean){
 if(!env.perches||random.next()>=CONFIG.world.birds.crossingChance)return;
 const candidates=env.perches(x,y,CONFIG.world.birds.crossingRange).slice(0,64).filter(p=>{
  const distance=Math.hypot(p.x-x,p.y-y);
  if(distance<.5||distance>CONFIG.world.birds.crossingRange||p.height<12||!within(p.x,p.y)||env.sample(p.x,p.y).water)return false;
  const steps=Math.ceil(distance/.15);
  for(let i=1;i<steps;i++)if(env.sample(x+(p.x-x)*i/steps,y+(p.y-y)*i/steps).water)return true;
  return false;
 });
 if(candidates.length)return candidates[Math.floor(random.next()*candidates.length)];
}
export const BIRD_FLIGHT:Readonly<Record<string,FlightProfile>>={
 hawk:{beats:2.5,burst:1.0,glide:5.5},vulture:{beats:2.0,burst:1.2,glide:4.5},
 seagull:{beats:4.2,burst:.8,glide:1.6},toucan:{beats:5.8,burst:1.2,glide:.45},
 macaw:{beats:4.6,burst:1.15,glide:.7},parakeet:{beats:7.2,burst:.9,glide:.3},kingfisher:{beats:7.8,burst:1.1,glide:.35},
};
