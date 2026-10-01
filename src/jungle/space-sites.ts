import { AgentRandom, type EnvironmentSample } from '../agents';
import { CONFIG } from '../config';
import { coordinateHash } from './terrain';
import { SPACE_KINDS, type SpaceKind } from './ecology';
import type { TreeSupport } from './patches';

/** A separate per-chunk stream never changes existing wildlife or landscape placement. */
export function spacecraftCandidate(cx:number, cy:number, seed:number, animals:number):SpaceKind|undefined {
  const rng = new AgentRandom(coordinateHash(cx, cy, seed ^ 0x53504143));
  if (rng.next() >= CONFIG.world.spacecraft.frequency * Math.min(1, animals)) return;
  return SPACE_KINDS[Math.floor(rng.next() * SPACE_KINDS.length)];
}

/** Clear the whole exploration disk, including canopy margins and gently sloped dry ground.
 * Both generation and live admission call this with the same terrain/support definitions. */
export function landingClear(x:number, y:number, sample:(x:number,y:number)=>EnvironmentSample,
  supports:readonly TreeSupport[], blocked:(x:number,y:number)=>boolean):boolean {
  const radius = 1.3;
  if (supports.some(t => Math.hypot(t.x-x,t.y-y) < radius + Math.max(.3,t.scale*.38))) return false;
  let low = Infinity, high = -Infinity;
  for (let iy=-7; iy<=7; iy++) for (let ix=-7; ix<=7; ix++) {
    const dx=ix*radius/7, dy=iy*radius/7;
    if (dx*dx+dy*dy > radius*radius) continue;
    const sx=x+dx, sy=y+dy, s=sample(sx,sy);
    if (s.water || blocked(sx,sy)) return false;
    low=Math.min(low,s.elevation); high=Math.max(high,s.elevation);
    if (high-low > 5) return false;
  }
  return true;
}
