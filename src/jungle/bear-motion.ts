/** Shared bear kinematics: the controller and offline pose baker must agree. */
export const BEAR_MOTION = {
 walkSpeed: .30, runSpeed: .76,
 walkStride: .245, runStride: .43,
 walkStance: .68, runStance: .42,
 cameraScale: 23, displayScale: 2.025, bakeScale: 26,
 standSeconds: 1.1, feedSeconds: .5,
} as const;
export const BEAR_MODEL_TO_TILE=BEAR_MOTION.cameraScale*BEAR_MOTION.displayScale*Math.SQRT1_2/96;
export const BEAR_CLIPS={rest:8,travel:32,run:32,feedDown:16,forage:24,feedUp:16,rise:24,stand:16,pick:24,lower:24,play:24} as const;
export const BEAR_ONE_SHOTS=['feedDown','feedUp','rise','lower'] as readonly string[];

/** A planted paw moves backwards at exactly the body's ground speed. */
export function bearFoot(phase:number,leg:number,running=false):{fore:number;lift:number;contact:boolean} {
 const stance=running?BEAR_MOTION.runStance:BEAR_MOTION.walkStance;
 // Walking is a rolling, lateral sequence; running pairs the hind/front pushes.
 const offsets=running?[0,.46,.08,.54]:[0,.18,.5,.68];
 const t=((phase+offsets[leg]!)%1+1)%1,u=Math.max(0,(t-stance)/(1-stance));
 const excursion=(running?BEAR_MOTION.runStride:BEAR_MOTION.walkStride)*stance/BEAR_MODEL_TO_TILE;
 return {fore:(t<stance?.5-t/stance:-.5+u*u*(3-2*u))*excursion,
  lift:Math.sin(u*Math.PI)*(running?.16:.095),contact:t<stance};
}

/** Three visible coat palettes reuse one detailed rig, retaining muzzle contrast. */
export const BEAR_COATS:readonly (readonly [number,number,number])[]=[[155,167,184],[235,199,162],[255,223,189]];
