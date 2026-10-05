import { BEAR_CLIPS, BEAR_MOTION } from './bear-motion';
import type { EnvironmentSample } from '../agents';
export const ECO_KINDS = ['tiger','hippo','bison','monkey','wolf','giraffe','elephant','seagull','fish','whale','macaw','parakeet','kingfisher','boa','smallSnake','squirrel','boar','beaver','crocodile','toad','blackBear','zebra','hawk','vulture'] as const;
export type EcoKind = typeof ECO_KINDS[number] | 'crab'; // Dormant type 44 is reserved, never generated.
export type TravelMode = 'ground'|'canopy'|'air'|'shore'|'water'|'amphibious';
export interface EcoSpec { type:number; mode:TravelMode; speed:number; stride:number; displayScale:number; directions:number; rest:number; range:number; cameraScale:number; runSpeed?:number; runStride?:number; groundSpeed?:number; groundStride?:number; }
export const ECO_SPECS: Record<EcoKind,EcoSpec> = {
 tiger:{type:75,mode:'ground',speed:.20,stride:.20,displayScale:1.55,directions:16,rest:18,range:1.8,cameraScale:24},
 hippo:{type:76,mode:'amphibious',speed:.115,stride:.16,displayScale:1.8,directions:16,rest:8,range:1.8,cameraScale:23},
 bison:{type:77,mode:'ground',speed:.16,stride:.20,displayScale:1.7,directions:16,rest:8,range:1.8,cameraScale:23},
 hawk:{type:61,mode:'air',speed:.65,stride:.2,displayScale:1.6,directions:16,rest:0,range:4,cameraScale:22},
 vulture:{type:62,mode:'air',speed:.55,stride:.2,displayScale:1.7,directions:16,rest:60,range:3,cameraScale:22},
 zebra:{type:59,mode:'ground',speed:.20,stride:.19,displayScale:1.3,directions:16,rest:10,range:1.5,cameraScale:23},
 blackBear:{type:58,mode:'ground',speed:BEAR_MOTION.walkSpeed,stride:BEAR_MOTION.walkStride,displayScale:BEAR_MOTION.displayScale,directions:16,rest:6,range:1.6,cameraScale:BEAR_MOTION.cameraScale,runSpeed:BEAR_MOTION.runSpeed,runStride:BEAR_MOTION.runStride},
 squirrel:{type:53,mode:'ground',speed:.38,stride:.12,displayScale:1,directions:16,rest:3,range:.8,cameraScale:20},
 boar:{type:54,mode:'ground',speed:.18,stride:.14,displayScale:1.2,directions:16,rest:8,range:1.1,cameraScale:23},
 beaver:{type:55,mode:'amphibious',speed:.18,stride:.12,displayScale:1,directions:16,rest:9,range:1.3,cameraScale:22},
 crocodile:{type:56,mode:'amphibious',speed:.10,stride:.18,displayScale:1.2,directions:16,rest:32,range:1.4,cameraScale:22},
 toad:{type:57,mode:'amphibious',speed:.2,stride:.1,displayScale:.85,directions:8,rest:4,range:.5,cameraScale:20},
 boa:{type:51,mode:'ground',speed:.065,stride:.32,displayScale:1.15,directions:16,rest:24,range:1.3,cameraScale:22},
 smallSnake:{type:52,mode:'ground',speed:.12,stride:.22,displayScale:.85,directions:16,rest:8,range:.75,cameraScale:22},
 monkey:{type:40,mode:'canopy',speed:.4,stride:.16,displayScale:1,directions:16,rest:30,range:.8,cameraScale:25},
 wolf:{type:41,mode:'ground',speed:.24,stride:.142,displayScale:1.05,directions:16,rest:5,range:1.8,cameraScale:25},
 giraffe:{type:42,mode:'ground',speed:.18,stride:.48/.68*20*1.5*Math.SQRT1_2/96,runSpeed:.65,runStride:.70/.42*20*1.5*Math.SQRT1_2/96,displayScale:1.5,directions:16,rest:12,range:1.2,cameraScale:20},
 elephant:{type:43,mode:'ground',speed:.12,stride:.175,displayScale:1.65,directions:24,rest:9,range:1.3,cameraScale:21},
 crab:{type:44,mode:'shore',speed:.13,stride:.07,displayScale:.85,directions:8,rest:3,range:.8,cameraScale:25},
 seagull:{type:45,mode:'air',groundSpeed:.14,groundStride:.35/.68*24*1.1*Math.SQRT1_2/96,speed:.52,stride:.15,displayScale:1.1,directions:16,rest:4,range:2.6,cameraScale:24},
 fish:{type:46,mode:'water',speed:.22,stride:.12,displayScale:.9,directions:16,rest:.1,range:1.4,cameraScale:25},
 whale:{type:47,mode:'water',speed:.085,stride:.7,displayScale:1.8,directions:16,rest:.15,range:1.2,cameraScale:19},
 macaw:{type:48,mode:'air',speed:.6,stride:.15,displayScale:1.15,directions:16,rest:3,range:2.3,cameraScale:24},
 parakeet:{type:49,mode:'air',speed:.65,stride:.1,displayScale:.85,directions:8,rest:2,range:2,cameraScale:24},
 kingfisher:{type:50,mode:'air',speed:.8,stride:.1,displayScale:.9,directions:16,rest:5,range:2,cameraScale:24},
};
const baseEcoClips = (kind:EcoKind):Record<string,number> => kind==='giraffe'?{rest:8,travel:24,run:24,feedDown:16,forage:16,feedUp:16}:kind==='seagull'?{rest:8,travel:24,walk:24,feedDown:16,forage:16,feedUp:16,takeoff:16,land:16}:kind==='kingfisher'?{rest:8,travel:24,dive:32,takeoff:16,land:16}:kind==='tiger'?{rest:4,travel:16,stalk:16,chase:16,roar:12,crouch:16,uncrouch:16}:kind==='hippo'?{rest:4,travel:16,graze:16,wallow:8,wade:16,feedDown:16,feedUp:16,enterWater:24,leaveWater:24}:kind==='bison'?{rest:4,travel:16,run:16,graze:16,feedDown:16,feedUp:16}:kind==='hawk'?{rest:1,travel:24,dive:32}:kind==='vulture'?{rest:1,travel:12,land:16,takeoff:16,forage:12}:kind==='zebra'?{rest:4,travel:16,run:16,graze:16,feedDown:16,feedUp:16}:kind==='blackBear'?BEAR_CLIPS:kind==='squirrel'?{rest:1,travel:12,climb:8,descend:8}:kind==='boar'?{rest:4,travel:24,run:24,feedDown:16,forage:24,feedUp:16}:kind==='toad'?{rest:1,hop:8}:kind==='beaver'?{rest:4,travel:16,swim:16,feedDown:16,forage:24,feedUp:16}:kind==='crocodile'?{rest:1,travel:12,swim:12}:kind==='boa'?{rest:1,travel:12,wrap:10,coil:1}:kind==='smallSnake'?{rest:1,travel:12}:kind==='elephant'?{rest:8,travel:24,drink:36,spray:24}:kind==='wolf'?{rest:8,travel:16,run:20}:kind==='monkey'?{rest:8,travel:16,climb:16,swing:16}:kind==='whale'?{travel:12,surface:12}:ECO_SPECS[kind].mode==='air'?{rest:8,travel:24,takeoff:16,land:16}:{rest:8,travel:16};
/** Extra activities are explicit per species, never a universal behavioral menu. */
const ACTIVITY_CLIPS:Partial<Record<EcoKind,Record<string,number>>>={
 elephant:{feed:32},wolf:{sniff:24,groom:24,play:24},tiger:{groom:24},
 monkey:{feed:24,groom:24,play:24},squirrel:{feed:24,groom:24},
 beaver:{groom:24,enterWater:24,leaveWater:24,wallow:16},crocodile:{wallow:16,bask:24,alert:24,enterWater:24,leaveWater:24},
 toad:{feed:20,rest:16},boa:{investigate:24,turnLeft:16,turnRight:16},smallSnake:{investigate:24,turnLeft:16,turnRight:16},
 macaw:{preen:24,feed:24},parakeet:{preen:24,feed:24},
 hippo:{yawn:24},fish:{feed:24},
};
const MOTION_SAMPLES:Partial<Record<EcoKind,Record<string,number>>>={
 tiger:{travel:32,stalk:24,chase:32},hippo:{travel:32,wade:32},bison:{travel:32,run:32},zebra:{travel:32,run:32},
 wolf:{travel:24,run:32},squirrel:{travel:24,climb:24,descend:24},beaver:{travel:24,swim:24},
 crocodile:{travel:24,swim:24},toad:{hop:24},boa:{travel:24,wrap:24},smallSnake:{travel:24},
 monkey:{travel:24,climb:24},fish:{travel:24},whale:{travel:32,surface:48},vulture:{travel:24},
};
export const ecoClips=(kind:EcoKind):Record<string,number>=>({...baseEcoClips(kind),...ACTIVITY_CLIPS[kind],...MOTION_SAMPLES[kind]});
/** Shared habitat policy for both deterministic spawning and live movement. */
export function habitatAllows(kind:EcoKind, s:EnvironmentSample):boolean {
 if(kind==='hippo')return s.water?(s.depth??0)<.5:Boolean(s.bank??s.beach);
 if(kind==='beaver'||kind==='crocodile'||kind==='toad')return s.water||Boolean(s.bank??s.beach);
 if(kind==='whale')return s.water && (s.depth??0)>.5;
 if(kind==='fish')return s.water;
 if(kind==='crab')return !s.water && Boolean(s.beach);
 if(kind==='seagull')return s.water||Boolean(s.beach);
 if(kind==='giraffe'||kind==='zebra'||kind==='bison')return !s.water && s.moisture<.65;
 return !s.water;
}
export function ecoDirection(kind:EcoKind, heading:number):number {const n=ECO_SPECS[kind].directions;return (Math.round(heading/(Math.PI*2)*n)%n+n)%n;}

export const MONKEY_GRIP_Z=1.2;

/** Visitors have their own encounter controller, outside the wildlife population/behavior loop. */
export const SPACE_KINDS = ['saucer', 'lander', 'scout'] as const;
export type SpaceKind = typeof SPACE_KINDS[number];
export const SPACE_SPECS = {
 saucer: {type:64, alienType:67, alien:'sprout', radius:.48},
 lander: {type:65, alienType:68, alien:'ember', radius:.43},
 scout: {type:66, alienType:69, alien:'reed', radius:.5},
} as const;
export const VISITOR_DIRECTIONS = 8;
export const VISITOR_CLIPS = {rest:1, walk:6, inspect:3} as const;
// .28 model-unit stance excursion, 60% stance; bake scale 19, display scale 1.7.
export const VISITOR_STRIDE = .28 / .6 * 19 * 1.7 * Math.SQRT1_2 / 96;
