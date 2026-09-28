import { CONFIG } from '../config';
import { hash, clamp } from '../iso/math';
import type { WorldSettings } from './settings';

export interface RiverPoint { x: number; y: number }
export interface RiverPath { id: string; points: RiverPoint[]; lengths: number[]; length: number; width: number; speed: number }
interface Basin extends RiverPoint { radius: number }
interface Reach { basin: Basin; paths: RiverPath[] }
// Pure deterministic geometry with a bounded memo: no visited-coordinate history.
const reaches = new Map<string, Reach>();
const LIMIT = 128;
function basin(cx: number, cy: number, seed: number, settings: Readonly<WorldSettings>): Basin {
  const spacing = CONFIG.world.rivers.spacing;
  return { x: (cx + .3 + hash(cx, cy, seed + 881) * .4) * spacing,
    y: (cy + .3 + hash(cx, cy, seed + 882) * .4) * spacing, radius: 1.4 + settings.waterSize * 3 };
}
function reach(cx: number, cy: number, seed: number, settings: Readonly<WorldSettings>): Reach {
  const c = CONFIG.world.rivers, key = `${cx}:${cy}:${seed}:${settings.waterSize}:${c.spacing}:${c.width}:${c.speed}`;
  const cached = reaches.get(key); if (cached) return cached;
  const start = basin(cx, cy, seed, settings), paths: RiverPath[] = [];
  for (const axis of [0, 1]) {
    // Eastbound chains always connect ponds; occasional southbound tributaries join them.
    if (axis && hash(cx, cy, seed + 889) > .36) continue;
    const end = basin(cx + Number(!axis), cy + axis, seed, settings);
    const dx = end.x - start.x, dy = end.y - start.y, distance = Math.hypot(dx, dy);
    const bend = (hash(cx, cy, seed + 893 + axis) - .5) * 5;
    const points = Array.from({ length: 25 }, (_, i) => {
      const t = i / 24, curve = Math.sin(t * Math.PI) * bend + Math.sin(t * Math.PI * 4) * .7;
      return { x: start.x + dx * t - dy / distance * curve, y: start.y + dy * t + dx / distance * curve };
    });
    const lengths = [0];
    for (let i = 1; i < points.length; i++) lengths.push(lengths[i-1]! + Math.hypot(points[i]!.x-points[i-1]!.x, points[i]!.y-points[i-1]!.y));
    paths.push({ id: `${cx}:${cy}:${axis}`, points, lengths, length: lengths.at(-1)!,
      width: c.width * (.75 + hash(cx, cy, seed + 895 + axis) * .5), speed: c.speed * (.65 + hash(cx, cy, seed + 897 + axis) * .7) });
  }
  const result = { basin: start, paths };
  if (reaches.size >= LIMIT) reaches.delete(reaches.keys().next().value!);
  reaches.set(key, result); return result;
}

/** Carve connected ponds and channels into the same signed water field used by contours. */
export function riverField(x: number, y: number, seed: number, settings: Readonly<WorldSettings>): number {
  if (!settings.water) return 1;
  const spacing = CONFIG.world.rivers.spacing, cx = Math.floor(x / spacing), cy = Math.floor(y / spacing);
  let field = 1;
  for (let j = cy-1; j <= cy+1; j++) for (let i = cx-1; i <= cx+1; i++) {
    const r = reach(i,j,seed,settings), b = r.basin;
    field = Math.min(field, (Math.hypot(x-b.x,y-b.y)-b.radius) * .075);
    for (const path of r.paths) {
      const radius = path.width * (.75 + settings.water * .5);
      for (let k = 1; k < path.points.length; k++) {
        const a = path.points[k-1]!, b = path.points[k]!;
        if (x < Math.min(a.x,b.x)-radius-2 || x > Math.max(a.x,b.x)+radius+2 || y < Math.min(a.y,b.y)-radius-2 || y > Math.max(a.y,b.y)+radius+2) continue;
        const dx=b.x-a.x,dy=b.y-a.y,t=clamp(((x-a.x)*dx+(y-a.y)*dy)/(dx*dx+dy*dy),0,1);
        field = Math.min(field,(Math.hypot(x-a.x-dx*t,y-a.y-dy*t)-radius)*.28);
      }
    }
  }
  return field;
}

/** Bounded active-region geometry, regenerated only when streamed membership changes. */
export function riverPaths(bounds: {minX:number;minY:number;maxX:number;maxY:number}, seed: number, settings: Readonly<WorldSettings>): RiverPath[] {
  if (!settings.water) return [];
  const s=CONFIG.world.rivers.spacing, paths:RiverPath[]=[];
  for(let y=Math.floor(bounds.minY/s)-1;y<=Math.floor(bounds.maxY/s)+1;y++)for(let x=Math.floor(bounds.minX/s)-1;x<=Math.floor(bounds.maxX/s)+1;x++) {
    for(const path of reach(x,y,seed,settings).paths)if(path.points.some(p=>p.x>=bounds.minX-2&&p.x<=bounds.maxX+2&&p.y>=bounds.minY-2&&p.y<=bounds.maxY+2))paths.push(path);
  }
  return paths;
}

/** Arc-length travel: branches and foam share a downstream velocity, with mild surges. */
export function riverParticle(path: RiverPath, time: number, phase: number): RiverPoint & {heading:number;fade:number} {
  const travel=path.speed*(time+.8*Math.sin(time*.35)),d=((travel+phase*path.length)%path.length+path.length)%path.length;
  let i=1;while(i<path.lengths.length-1&&path.lengths[i]!<d)i++;
  const a=path.points[i-1]!,b=path.points[i]!,t=(d-path.lengths[i-1]!)/(path.lengths[i]!-path.lengths[i-1]!);
  return {x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,heading:Math.atan2(b.y-a.y,b.x-a.x),fade:Math.min(1,d/1.5,(path.length-d)/1.5)};
}

export interface RiverBank extends RiverPoint { id:string; heading:number }
/** Prepare bank anchors only when active chunks change, not on every animation frame. */
export function riverBanks(paths:readonly RiverPath[],water:number,seed:number,field:(x:number,y:number)=>number|undefined):RiverBank[] {
 const banks:RiverBank[]=[];
 for(const path of paths)for(let i=0;i<Math.ceil(path.length/.8);i++)for(const side of [-1,1]){
  const p=riverParticle(path,0,(i+.5)*.8/path.length),radius=path.width*(.75+water*.5);
  const offset=side*(radius+.07+(hash(i,side,seed)-.5)*.1);
  const x=p.x-Math.sin(p.heading)*offset,y=p.y+Math.cos(p.heading)*offset,f=field(x,y);
  if(f!==undefined&&f>=-.045&&f<=.18)banks.push({x,y,heading:p.heading,id:`bank:${path.id}:${i}:${side}`});
 }
 return banks;
}
