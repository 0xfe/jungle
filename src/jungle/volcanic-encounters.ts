import type { Agent, AgentEnvironment } from '../agents';
import { hash } from '../iso/math';
import { CONFIG } from '../config';
import { lavaPoint } from './volcanoes';
import { VolcanicWildlifeAgent, type VolcanoApproach } from './agents/volcanic-wildlife';
import { EcologicalAgent } from './agents/ecological-base';
import { habitatAllows } from './ecology';

/** Choose at most one adventurous walker per site, from a pre-update snapshot.
 * Fifteen-second slots with five seconds of seeded jitter give 10–20-second
 * opportunities. Actual ignition still requires walking onto the visible lava.
 */
export function volcanicApproaches(agents:readonly Agent[],previousTime:number,env:Omit<AgentEnvironment,'nearby'>):ReadonlyMap<string,VolcanoApproach>|undefined {
  if(Math.floor(previousTime)===Math.floor(env.time))return;
  const groups=new Map<string,VolcanicWildlifeAgent[]>(),result=new Map<string,VolcanoApproach>();
  for(const a of agents)if(a instanceof VolcanicWildlifeAgent){
    const group=groups.get(a.volcano.id)??[];group.push(a);groups.set(a.volcano.id,group);
  }
  for(const group of groups.values()){
    const v=group[0]!.volcano,c=CONFIG.world.volcanoes;
    const clock=env.time+v.phase,period=(c.encounterMinSeconds+c.encounterMaxSeconds)/2;
    const slot=Math.floor(clock/period),jitter=(c.encounterMaxSeconds-c.encounterMinSeconds)/2;
    if(clock<slot*period+hash(slot,v.form,v.phase)*jitter||group.some(a=>a.encounterSlot>=slot||a.approachRemaining>0))continue;
    const pool=lavaPoint(v,.82);
    const candidates=group.filter(a=>a.phase==='alive'&&a.altitude<1&&(a.encounterSlot<0||a.encounterSlot<slot-1)&&
      ['deer','zebra','wolf','boar','blackBear','giraffe','jaguar'].includes(a.kind)&&
      !['rise','stand','pick','lower','climb','swing','chase'].includes(a.animal.state)&&Math.hypot(a.x-pool.x,a.y-pool.y)<5)
      .sort((a,b)=>Math.hypot(a.x-pool.x,a.y-pool.y)-Math.hypot(b.x-pool.x,b.y-pool.y)||a.id.localeCompare(b.id)).slice(0,24);
    let chosen=false;
    for(const a of candidates){
      for(const t of [.82,.93,.7]){
        const target=lavaPoint(v,t),animal=a.animal;
        const radius=animal instanceof EcologicalAgent?(a.kind==='giraffe'?.14:a.kind==='blackBear'?.15*animal.size:0):0;
        const steps=Math.ceil(Math.hypot(a.x-target.x,a.y-target.y)/.025);
        let clear=true;
        for(let i=1;i<=steps&&clear;i++){
          const x=a.x+(target.x-a.x)*i/steps,y=a.y+(target.y-a.y)*i/steps;
          clear=env.canMove(x,y)&&(!(animal instanceof EcologicalAgent)||habitatAllows(animal.kind,env.sample(x,y)));
          if(clear&&radius)for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]])if(!env.canMove(x+dx!*radius,y+dy!*radius)){clear=false;break;}
        }
        if(!clear)continue;
        result.set(a.id,{x:target.x,y:target.y,slot});chosen=true;break;
      }
      if(chosen)break;
    }
  }
  return result;
}
