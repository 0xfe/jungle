import { CONFIG } from '../config';
import { clamp } from '../iso/math';
export interface WorldSettings { water:number; waterSize:number; barren:number; meadow:number; hills:number; plants:number; animals:number }
export const DEFAULT_SETTINGS:Readonly<WorldSettings>=Object.freeze({...CONFIG.world.settings});
export const SETTING_KEYS=(Object.keys(DEFAULT_SETTINGS) as (keyof WorldSettings)[]);
export function normalizeSettings(input:Partial<WorldSettings>={}):Readonly<WorldSettings>{
 const result={...DEFAULT_SETTINGS};
 for(const k of SETTING_KEYS){const n=input[k];result[k]=Number.isFinite(n)?clamp(n!,0,k==='animals'?CONFIG.world.limits.animals:k==='plants'?CONFIG.world.limits.plants:CONFIG.world.limits.landscape):DEFAULT_SETTINGS[k];}
 return Object.freeze(result);
}
