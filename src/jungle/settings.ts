import { clamp } from '../iso/math';
export interface WorldSettings { water:number; waterSize:number; barren:number; meadow:number; hills:number; plants:number; animals:number }
export const DEFAULT_SETTINGS:Readonly<WorldSettings>=Object.freeze({water:.2,waterSize:.15,barren:.08,meadow:.1,hills:.08,plants:1,animals:2.5});
export const SETTING_KEYS=(Object.keys(DEFAULT_SETTINGS) as (keyof WorldSettings)[]);
export function normalizeSettings(input:Partial<WorldSettings>={}):Readonly<WorldSettings>{
 const result={...DEFAULT_SETTINGS};
 for(const k of SETTING_KEYS){const n=input[k];result[k]=Number.isFinite(n)?clamp(n!,0,k==='animals'?5:k==='plants'?1.5:1):DEFAULT_SETTINGS[k];}
 return Object.freeze(result);
}
