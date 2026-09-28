import type { SoundScene, SoundEmitter } from '../audio';
import { DeerAgent, WildlifeAgent, PlantAgent } from './agents';
import { InfiniteWorld } from './infinite';
import { TerrainKind } from './terrain';
/** Scene adapter: isometric x-y determines stereo pan in the reusable planner. */
export function jungleSound(world:InfiniteWorld,x:number,y:number):SoundScene{
 let water=0,trees=0,total=0;const emitters:SoundEmitter[]=[];
 for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){const tile=world.tileAt(x+dx,y+dy);if(tile){total++;water+=Number(tile.materialAt(x+dx,y+dy)>=TerrainKind.Shallow);}}
 for(const a of world.agents){if(Math.hypot(a.x-x,a.y-y)>5)continue;
  if(a instanceof PlantAgent){trees+=Number(a.kind==='tree');continue;}
  if(!(a instanceof DeerAgent||a instanceof WildlifeAgent))continue;
  const bird=['toucan','macaw','parakeet','kingfisher','seagull'].includes(a.kind);
  if(!bird&&['whale','fish','monkey','crab'].includes(a.kind))continue;
  emitters.push({id:a.id,x:a.x,y:a.y,speed:a.speed,phase:a.gait,bird});
 }
 return {x,y,water:total?water/total:0,canopy:Math.min(1,trees/18),rain:world.weather==='rain'?1:0,night:world.weather==='dusk'?1:0,emitters};
}
