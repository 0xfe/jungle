import type { EnvironmentSample } from '../agents';
export const ECO_KINDS = ['monkey','wolf','giraffe','elephant','seagull','fish','whale','macaw','parakeet','kingfisher'] as const;
export type EcoKind = typeof ECO_KINDS[number] | 'crab'; // Dormant type 44 is reserved, never generated.
export type TravelMode = 'ground'|'canopy'|'air'|'shore'|'water';
export interface EcoSpec { type:number; mode:TravelMode; speed:number; stride:number; displayScale:number; directions:number; rest:number; range:number; cameraScale:number; }
export const ECO_SPECS: Record<EcoKind,EcoSpec> = {
 monkey:{type:40,mode:'canopy',speed:.4,stride:.16,displayScale:1,directions:16,rest:30,range:.8,cameraScale:25},
 wolf:{type:41,mode:'ground',speed:.24,stride:.142,displayScale:1.05,directions:16,rest:5,range:1.8,cameraScale:25},
 giraffe:{type:42,mode:'ground',speed:.12,stride:.24,displayScale:1.5,directions:16,rest:12,range:1.2,cameraScale:20},
 elephant:{type:43,mode:'ground',speed:.12,stride:.175,displayScale:1.65,directions:16,rest:9,range:1.3,cameraScale:21},
 crab:{type:44,mode:'shore',speed:.13,stride:.07,displayScale:.85,directions:8,rest:3,range:.8,cameraScale:25},
 seagull:{type:45,mode:'air',speed:.52,stride:.15,displayScale:1.1,directions:16,rest:4,range:2.6,cameraScale:24},
 fish:{type:46,mode:'water',speed:.22,stride:.12,displayScale:.9,directions:8,rest:.1,range:1.4,cameraScale:25},
 whale:{type:47,mode:'water',speed:.085,stride:.7,displayScale:1.8,directions:16,rest:.15,range:1.2,cameraScale:19},
 macaw:{type:48,mode:'air',speed:.6,stride:.15,displayScale:1.15,directions:16,rest:3,range:2.3,cameraScale:24},
 parakeet:{type:49,mode:'air',speed:.65,stride:.1,displayScale:.85,directions:8,rest:2,range:2,cameraScale:24},
 kingfisher:{type:50,mode:'air',speed:.8,stride:.1,displayScale:.9,directions:16,rest:5,range:2,cameraScale:24},
};
export const ecoClips = (kind:EcoKind):Record<string,number> => kind==='elephant'?{rest:8,travel:20,drink:24,spray:16}:kind==='wolf'?{rest:8,travel:16,run:20}:kind==='monkey'?{rest:8,travel:16,climb:16,swing:16}:kind==='whale'?{travel:12,surface:12}:ECO_SPECS[kind].mode==='air'?{rest:8,travel:24}:{rest:8,travel:16};
/** Shared habitat policy for both deterministic spawning and live movement. */
export function habitatAllows(kind:EcoKind, s:EnvironmentSample):boolean {
 if(kind==='whale')return s.water && (s.depth??0)>.5;
 if(kind==='fish')return s.water;
 if(kind==='crab')return !s.water && Boolean(s.beach);
 if(kind==='seagull')return s.water||Boolean(s.beach);
 if(kind==='giraffe')return !s.water && s.moisture<.65;
 return !s.water;
}
export function ecoDirection(kind:EcoKind, heading:number):number {const n=ECO_SPECS[kind].directions;return (Math.round(heading/(Math.PI*2)*n)%n+n)%n;}

export const MONKEY_GRIP_Z=1.2;
