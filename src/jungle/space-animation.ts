import type { SpaceKind } from './ecology';

/** Offline clip contracts; headings and pose indices are shared by baker and presentation. */
export const SHIP_SPIN_FRAMES=16;
export const SHIP_BANK_FRAMES=4;
export const SHIP_LIGHT_FRAMES=3;

const TAU=Math.PI*2;
/** Rotation settles exactly onto the authored landing heading as height reaches zero. */
export function shipFlightFrame(kind:SpaceKind,heading:number,altitude:number,time:number):number {
  if(kind==='scout')return Math.floor(((time*.55%1)+1)%1*SHIP_BANK_FRAMES);
  const angle=heading+altitude/420*TAU*(kind==='saucer'?2:1);
  return ((Math.round(angle/TAU*SHIP_SPIN_FRAMES)%SHIP_SPIN_FRAMES)+SHIP_SPIN_FRAMES)%SHIP_SPIN_FRAMES;
}
